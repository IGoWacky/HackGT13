import os
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session, aliased
from sqlalchemy.exc import SQLAlchemyError

from ..database import SessionLocal
from ..demo_prescriptions import DEMO_REPLACEMENT_OPTIONS
from ..models import Patient, Prescription, PrescriptionIssueReport, RxRescueMessageData

router = APIRouter()
DEMO_PATIENT_EMAILS = ("jane@example.com", "john@example.com")


class ReportCreate(BaseModel):
    prescription_id: int
    issue: Literal["Too expensive", "No insurance coverage", "Medical conflicts"]


class ReportResolve(BaseModel):
    replacement_key: str | None = None


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def serialize_report(
    report: PrescriptionIssueReport,
    prescription: Prescription,
    replacement: Prescription | None = None,
):
    medication = prescription.medication
    if prescription.dosage:
        medication = f"{medication} · {prescription.dosage}"

    def prescription_details(item: Prescription | None):
        if item is None:
            return None
        return {
            "id": item.id,
            "medication": item.medication,
            "dosage": item.dosage,
            "instructions": item.instructions,
            "active": item.active,
        }

    return {
        "id": report.id,
        "prescription_id": report.prescription_id,
        "medication": medication,
        "original_prescription": prescription_details(prescription),
        "replacement_prescription": prescription_details(replacement),
        "issue": report.issue,
        "status": report.status,
        "created_at": report.created_at,
    }


@router.get("/open")
def get_open_reports(db: Session = Depends(get_db)):
    rows = db.query(PrescriptionIssueReport, Patient, Prescription).join(
        Patient, Patient.id == PrescriptionIssueReport.patient_id
    ).join(
        Prescription, Prescription.id == PrescriptionIssueReport.prescription_id
    ).filter(
        PrescriptionIssueReport.status.notin_(("Resolved", "Prescription sent"))
    ).order_by(PrescriptionIssueReport.created_at.asc()).all()

    return [
        {
            "id": report.id,
            "patient_id": patient.id,
            "patient_name": patient.name,
            "prescription_id": prescription.id,
            "medication": serialize_report(report, prescription)["medication"],
            "original_prescription": serialize_report(report, prescription)["original_prescription"],
            "issue": report.issue,
            "status": report.status,
            "created_at": report.created_at,
        }
        for report, patient, prescription in rows
    ]


@router.get("/replacement-options")
def get_replacement_options():
    return DEMO_REPLACEMENT_OPTIONS


@router.get("/patients")
def get_docupdate_patients(db: Session = Depends(get_db)):
    return [
        {"id": patient.id, "name": patient.name, "email": patient.email}
        for patient in db.query(Patient).order_by(Patient.name.asc()).all()
    ]


@router.get("/{patient_id}")
def get_reports(patient_id: int, db: Session = Depends(get_db)):
    patient = db.query(Patient.id).filter(Patient.id == patient_id).first()
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    replacement = aliased(Prescription)
    rows = db.query(PrescriptionIssueReport, Prescription, replacement).join(
        Prescription, PrescriptionIssueReport.prescription_id == Prescription.id
    ).outerjoin(
        replacement, PrescriptionIssueReport.new_prescription_id == replacement.id
    ).filter(
        PrescriptionIssueReport.patient_id == patient_id
    ).order_by(PrescriptionIssueReport.created_at.desc()).all()

    return [
        serialize_report(report, prescription, replacement_prescription)
        for report, prescription, replacement_prescription in rows
    ]


@router.post("/{patient_id}", status_code=201)
def create_report(
    patient_id: int,
    report_data: ReportCreate,
    db: Session = Depends(get_db),
):
    prescription = db.query(Prescription).filter(
        Prescription.id == report_data.prescription_id,
        Prescription.patient_id == patient_id,
        Prescription.active.is_(True),
    ).first()
    if prescription is None:
        raise HTTPException(status_code=404, detail="Active prescription not found")

    report = PrescriptionIssueReport(
        patient_id=patient_id,
        prescription_id=prescription.id,
        issue=report_data.issue,
    )
    rescue_message_data = RxRescueMessageData(
        patient_id=patient_id,
        prescription_id=prescription.id,
        cause=report_data.issue,
    )
    db.add_all([report, rescue_message_data])
    db.commit()
    db.refresh(report)
    return serialize_report(report, prescription)


@router.patch("/{report_id}/resolve")
def resolve_report(
    report_id: int,
    resolution: ReportResolve,
    db: Session = Depends(get_db),
):
    report = db.query(PrescriptionIssueReport).filter_by(id=report_id).first()
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")

    if report.status in ("Resolved", "Prescription sent"):
        raise HTTPException(status_code=409, detail="Report is already closed")

    original = db.get(Prescription, report.prescription_id)
    if original is None or original.patient_id != report.patient_id:
        raise HTTPException(status_code=409, detail="Original prescription is unavailable")

    replacement = None
    if resolution.replacement_key is not None:
        replacement_option = next(
            (option for option in DEMO_REPLACEMENT_OPTIONS if option["key"] == resolution.replacement_key),
            None,
        )
        if replacement_option is None:
            raise HTTPException(status_code=422, detail="Unknown replacement prescription")

        replacement = Prescription(
            patient_id=report.patient_id,
            medication=replacement_option["medication"],
            dosage=replacement_option["dosage"],
            instructions=replacement_option["instructions"],
            active=True,
        )
        original.active = False
        db.add(replacement)

    try:
        if replacement is not None:
            db.flush()
            report.new_prescription_id = replacement.id
        report.status = "Resolved"
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Unable to resolve this request")

    db.refresh(report)
    db.refresh(original)
    if replacement is not None:
        db.refresh(replacement)

    return serialize_report(report, original, replacement)
@router.post("/demo/reset")
def reset_demo_reports(db: Session = Depends(get_db)):
    patient_rows = db.query(Patient.id).filter(Patient.email.in_(DEMO_PATIENT_EMAILS)).all()
    patient_ids = [patient_id for (patient_id,) in patient_rows]
    if not patient_ids:
        return {"deleted_reports": 0, "deleted_message_data": 0}

    deleted_message_data = db.query(RxRescueMessageData).filter(
        RxRescueMessageData.patient_id.in_(patient_ids)
    ).delete(synchronize_session=False)
    deleted_reports = db.query(PrescriptionIssueReport).filter(
        PrescriptionIssueReport.patient_id.in_(patient_ids)
    ).delete(synchronize_session=False)
    db.commit()
    return {
        "deleted_reports": deleted_reports,
        "deleted_message_data": deleted_message_data,
    }


# This destructive demo helper is off unless explicitly enabled on a local server.
def demo_reset_enabled(request: Request) -> bool:
    return (
        os.environ.get("RXRESCUE_ENABLE_DEMO_RESET") == "1"
        and request.client is not None
        and request.client.host in {"127.0.0.1", "::1"}
    )


@router.get("/developer/status")
def developer_status(request: Request):
    return {"report_reset_enabled": demo_reset_enabled(request)}


@router.delete("/developer/{patient_id}")
def reset_reports(patient_id: int, request: Request, db: Session = Depends(get_db)):
    if not demo_reset_enabled(request):
        raise HTTPException(status_code=404, detail="Developer reset is not enabled")
    if db.get(Patient, patient_id) is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    try:
        deleted_count = db.query(PrescriptionIssueReport).filter(
            PrescriptionIssueReport.patient_id == patient_id
        ).delete(synchronize_session=False)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Unable to reset reports. Please try again.")
    return {"patient_id": patient_id, "deleted_count": deleted_count}
