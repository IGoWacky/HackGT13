import base64
import hashlib
import secrets
from datetime import date

from fastapi import APIRouter, Depends
from fastapi import HTTPException
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import Patient, Prescription

router = APIRouter()
PASSWORD_HASH_ITERATIONS = 600_000


class PatientCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    date_of_birth: date
    password: str = Field(min_length=8, max_length=128)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Name must not be blank")
        return cleaned

    @field_validator("date_of_birth")
    @classmethod
    def validate_date_of_birth(cls, value: date) -> date:
        if value >= date.today():
            raise ValueError("Date of birth must be in the past")
        return value


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PASSWORD_HASH_ITERATIONS
    )
    salt_text = base64.urlsafe_b64encode(salt).decode("ascii")
    digest_text = base64.urlsafe_b64encode(digest).decode("ascii")
    return f"pbkdf2_sha256${PASSWORD_HASH_ITERATIONS}${salt_text}${digest_text}"


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("", status_code=201)
def create_patient(patient_data: PatientCreate, db: Session = Depends(get_db)):
    email = str(patient_data.email).lower()
    if db.query(Patient).filter(Patient.email == email).first() is not None:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    patient = Patient(
        name=patient_data.name,
        email=email,
        password_hash=hash_password(patient_data.password),
        date_of_birth=patient_data.date_of_birth,
    )
    db.add(patient)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    db.refresh(patient)
    return {
        "id": patient.id,
        "name": patient.name,
        "email": patient.email,
        "date_of_birth": patient.date_of_birth,
    }


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