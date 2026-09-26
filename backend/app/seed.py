from .database import SessionLocal
from .models import Patient, Prescription


db = SessionLocal()

# Create dummy patients
patient1 = Patient(
    name="Jane Smith",
    email="jane@example.com",
    password_hash="password123",
    medical_history="Asthma. Previous knee surgery in 2022."
)

patient2 = Patient(
    name="John Doe",
    email="john@example.com",
    password_hash="password456",
    medical_history="Type 2 diabetes. No known allergies."
)

db.add(patient1)
db.add(patient2)

# Save patients first so they get IDs
db.commit()

# Create dummy prescriptions
prescription1 = Prescription(
    patient_id=patient1.id,
    medication="Amoxicillin",
    dosage="500mg",
    instructions="Take twice daily",
    active=True
)

prescription2 = Prescription(
    patient_id=patient1.id,
    medication="Ibuprofen",
    dosage="200mg",
    instructions="Take as needed",
    active=True
)

prescription3 = Prescription(
    patient_id=patient2.id,
    medication="Metformin",
    dosage="500mg",
    instructions="Take once daily with food",
    active=True
)

db.add(prescription1)
db.add(prescription2)
db.add(prescription3)

db.commit()
db.close()

print("Dummy data added!")