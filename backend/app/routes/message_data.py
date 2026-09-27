from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import RxRescueMessageData

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/{message_id}")
def get_message_data(
    message_id: int,
    db: Session = Depends(get_db)
):
    message = db.query(RxRescueMessageData).filter(
        RxRescueMessageData.id == message_id
    ).first()

    if message is None:
        return {"error": "Message data not found"}

    return {
        "id": message.id,
        "patient_id": message.patient_id,
        "prescription_id": message.prescription_id,
        "cause": message.cause,
    }