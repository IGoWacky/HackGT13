from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import Prescription

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/{patient_id}")
def get_prescriptions(
    patient_id: int,
    db: Session = Depends(get_db)
):
    prescriptions = db.query(Prescription).filter(
        Prescription.patient_id == patient_id
    ).all()

    return prescriptions