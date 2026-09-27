from fastapi import FastAPI
from sqlalchemy import inspect, text

from .database import engine
from .models import Base
from .routes import patients, prescriptions, message_data

Base.metadata.create_all(bind=engine)
patient_columns = {column["name"] for column in inspect(engine).get_columns("patients")}
if "date_of_birth" not in patient_columns:
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE patients ADD COLUMN date_of_birth DATE"))

app = FastAPI()

app.include_router(
    patients.router,
    prefix="/patients",
    tags=["patients"]
)

app.include_router(
    prescriptions.router,
    prefix="/prescriptions",
    tags=["prescriptions"]
)

app.include_router(
    message_data.router,
    prefix="/message-data",
    tags=["message data"]
)

@app.get("/")
def root():
    return {"message": "Patient Portal API is running"}