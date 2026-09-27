from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    medical_history = Column(String)

class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    medication = Column(String, nullable=False)
    dosage = Column(String)
    instructions = Column(String)
    active = Column(Boolean, default=True)

class RxRescueMessageData(Base):
    __tablename__ = "message_data"

    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"))
    sponsored_generics = Column(String)
    unsponsored_generics = Column(String)