from .database import SessionLocal
from .models import Patient, Prescription
from .routes.patients import hash_password


PATIENTS = [
    {
        "name": "Jane Smith",
        "email": "jane@example.com",
        "password": "password123",
        "medical_history": "Asthma. Previous knee surgery in 2022.",
    },
    {
        "name": "John Doe",
        "email": "john@example.com",
        "password": "password456",
        "medical_history": "Type 2 diabetes. No known allergies.",
    },
]

PRESCRIPTIONS = [
    ("jane@example.com", "Amoxicillin", "500mg", "Take twice daily"),
    ("jane@example.com", "Ibuprofen", "200mg", "Take as needed"),
    ("john@example.com", "Metformin", "500mg", "Take once daily with food"),
]


def seed_demo_data() -> None:
    with SessionLocal() as db:
        patients = {}
        for record in PATIENTS:
            patient = db.query(Patient).filter(Patient.email == record["email"]).first()
            if patient is None:
                patient = Patient(
                    name=record["name"],
                    email=record["email"],
                    password_hash=hash_password(record["password"]),
                    medical_history=record["medical_history"],
                )
                db.add(patient)
                db.flush()
            elif not patient.password_hash.startswith("pbkdf2_sha256$"):
                patient.password_hash = hash_password(record["password"])
            patients[record["email"]] = patient

        for email, medication, dosage, instructions in PRESCRIPTIONS:
            patient = patients[email]
            exists = db.query(Prescription).filter(
                Prescription.patient_id == patient.id,
                Prescription.medication == medication,
            ).first()
            if exists is None:
                db.add(Prescription(
                    patient_id=patient.id,
                    medication=medication,
                    dosage=dosage,
                    instructions=instructions,
                    active=True,
                ))

        db.commit()


if __name__ == "__main__":
    seed_demo_data()
    print("Demo patient accounts and prescriptions are up to date.")