from fastapi import APIRouter, Depends
from fastapi import HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from ..audit import record_patient_change
from ..database import SessionLocal
from ..demo_prescriptions import DEMO_REPLACEMENT_OPTIONS_BY_KEY
from ..models import Patient, Prescription

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class DemoPrescriptionCreate(BaseModel):
    patient_id: int = Field(gt=0)
    replacement_key: str


@router.post("", status_code=201)
def create_demo_prescription(
    request: DemoPrescriptionCreate,
    db: Session = Depends(get_db),
):
    patient = db.get(Patient, request.patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    option = DEMO_REPLACEMENT_OPTIONS_BY_KEY.get(request.replacement_key)
    if option is None:
        raise HTTPException(status_code=422, detail="Unknown synthetic prescription")

    prescription = Prescription(
        patient_id=patient.id,
        medication=option["medication"],
        dosage=option["dosage"],
        instructions=option["instructions"],
        active=True,
    )
    db.add(prescription)
    try:
        db.flush()
        record_patient_change(
            db,
            patient_id=patient.id,
            actor_source="docupdate",
            action="prescription.created",
            entity_type="prescription",
            entity_id=prescription.id,
            changes={
                "medication": prescription.medication,
                "dosage": prescription.dosage,
                "instructions": prescription.instructions,
                "active": prescription.active,
            },
        )
        db.commit()
        db.refresh(prescription)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Unable to create demo prescription")

    return {
        "id": prescription.id,
        "patient_id": prescription.patient_id,
        "medication": prescription.medication,
        "dosage": prescription.dosage,
        "instructions": prescription.instructions,
        "active": prescription.active,
    }


@router.get("/{patient_id}")
def get_prescriptions(
    patient_id: int,
    db: Session = Depends(get_db)
):
    prescriptions = db.query(Prescription).filter(
        Prescription.patient_id == patient_id,
        Prescription.active.is_(True),
    ).all()

    return prescriptions