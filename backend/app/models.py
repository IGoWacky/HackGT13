from datetime import datetime

from sqlalchemy import Column, Date, DateTime, Integer, String, Boolean, ForeignKey, JSON
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    date_of_birth = Column(Date, nullable=True)
    medical_history = Column(String)

class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    medication = Column(String, nullable=False)
    dosage = Column(String)
    instructions = Column(String)
    active = Column(Boolean, default=True)

class PrescriptionIssueReport(Base):
    __tablename__ = "prescription_issue_reports"

    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"), nullable=False)
    new_prescription_id = Column(Integer, ForeignKey("prescriptions.id"), nullable=True)
    issue = Column(String, nullable=False)
    status = Column(String, nullable=False, default="Submitted")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

class RxRescueMessageData(Base):
    __tablename__ = "message_data"

    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"))
    cause = Column(String)

class PatientAuditLog(Base):
    __tablename__ = "patient_audit_logs"

    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    actor_source = Column(String, nullable=False)
    action = Column(String, nullable=False)
    entity_type = Column(String, nullable=False)
    entity_id = Column(Integer, nullable=True)
    changes = Column(JSON, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)