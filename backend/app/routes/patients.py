from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import Patient, Prescription

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/{patient_id}")
def get_patient(patient_id: int, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(
        Patient.id == patient_id
    ).first()

    if patient is None:
        return {"error": "Patient not found"}

    prescriptions = db.query(Prescription).filter(
        Prescription.patient_id == patient_id
    ).all()

    return {
        "id": patient.id,
        "name": patient.name,
        "email": patient.email,
        "medical_history": patient.medical_history,
        "prescriptions": [
            {
                "id": p.id,
                "medication": p.medication,
                "dosage": p.dosage,
                "instructions": p.instructions,
                "active": p.active
            }
            for p in prescriptions
        ]
    }