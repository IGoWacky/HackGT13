from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import Patient, Prescription, PrescriptionIssueReport, RxRescueMessageData

router = APIRouter()
DEMO_PATIENT_EMAILS = ("jane@example.com", "john@example.com")


class ReportCreate(BaseModel):
    prescription_id: int
    issue: Literal["Too expensive", "No insurance coverage", "Medical conflicts"]


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def serialize_report(report: PrescriptionIssueReport, prescription: Prescription):
    medication = prescription.medication
    if prescription.dosage:
        medication = f"{medication} · {prescription.dosage}"

    return {
        "id": report.id,
        "prescription_id": report.prescription_id,
        "medication": medication,
        "issue": report.issue,
        "status": report.status,
        "created_at": report.created_at,
    }


@router.get("/{patient_id}")
def get_reports(patient_id: int, db: Session = Depends(get_db)):
    patient = db.query(Patient.id).filter(Patient.id == patient_id).first()
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    rows = db.query(PrescriptionIssueReport, Prescription).join(
        Prescription, PrescriptionIssueReport.prescription_id == Prescription.id
    ).filter(
        PrescriptionIssueReport.patient_id == patient_id
    ).order_by(PrescriptionIssueReport.created_at.desc()).all()

    return [serialize_report(report, prescription) for report, prescription in rows]


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