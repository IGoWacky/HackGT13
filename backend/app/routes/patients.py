import base64
import hashlib
import hmac
import secrets
from datetime import date

from fastapi import APIRouter, Depends
from fastapi import HTTPException
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..audit import record_patient_change
from ..database import SessionLocal
from ..models import Patient, PatientAuditLog, Prescription

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


class PatientLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PASSWORD_HASH_ITERATIONS
    )
    salt_text = base64.urlsafe_b64encode(salt).decode("ascii")
    digest_text = base64.urlsafe_b64encode(digest).decode("ascii")
    return f"pbkdf2_sha256${PASSWORD_HASH_ITERATIONS}${salt_text}${digest_text}"


def verify_password(password: str, encoded_hash: str) -> bool:
    try:
        algorithm, iterations_text, salt_text, digest_text = encoded_hash.split("$")
        iterations = int(iterations_text)
        if algorithm != "pbkdf2_sha256" or not 100_000 <= iterations <= 2_000_000:
            return False
        salt = base64.b64decode(salt_text, altchars=b"-_", validate=True)
        expected_digest = base64.b64decode(digest_text, altchars=b"-_", validate=True)
    except (ValueError, UnicodeError):
        return False

    actual_digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, iterations
    )
    return hmac.compare_digest(actual_digest, expected_digest)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/login")
def login_patient(credentials: PatientLogin, db: Session = Depends(get_db)):
    email = str(credentials.email).lower()
    patient = db.query(Patient).filter(Patient.email == email).first()
    if patient is None or not verify_password(credentials.password, patient.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return {
        "id": patient.id,
        "name": patient.name,
        "email": patient.email,
        "date_of_birth": patient.date_of_birth,
    }


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
        db.flush()
        record_patient_change(
            db,
            patient_id=patient.id,
            actor_source="patient_portal",
            action="patient.created",
            entity_type="patient",
            entity_id=patient.id,
            changes={
                "name": patient.name,
                "email": patient.email,
                "date_of_birth": patient.date_of_birth.isoformat(),
            },
        )
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


@router.get("/{patient_id}/audit-log")
def get_patient_audit_log(patient_id: int, db: Session = Depends(get_db)):
    if db.get(Patient, patient_id) is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    entries = db.query(PatientAuditLog).filter(
        PatientAuditLog.patient_id == patient_id
    ).order_by(
        PatientAuditLog.created_at.desc(), PatientAuditLog.id.desc()
    ).all()

    return [
        {
            "id": entry.id,
            "patient_id": entry.patient_id,
            "actor_source": entry.actor_source,
            "action": entry.action,
            "entity_type": entry.entity_type,
            "entity_id": entry.entity_id,
            "changes": entry.changes,
            "created_at": entry.created_at,
        }
        for entry in entries
    ]


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