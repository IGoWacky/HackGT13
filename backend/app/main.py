from fastapi import FastAPI
from sqlalchemy import inspect, text

from .database import engine
from .models import Base
from .routes import patients, prescriptions, message_data, reports

Base.metadata.create_all(bind=engine)
patient_columns = {column["name"] for column in inspect(engine).get_columns("patients")}
if "date_of_birth" not in patient_columns:
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE patients ADD COLUMN date_of_birth DATE"))
report_columns = {column["name"] for column in inspect(engine).get_columns("prescription_issue_reports")}
if "new_prescription_id" not in report_columns:
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE prescription_issue_reports ADD COLUMN new_prescription_id INTEGER REFERENCES prescriptions(id)"))

message_data_columns = {column["name"] for column in inspect(engine).get_columns("message_data")}
with engine.begin() as connection:
    if "cause" not in message_data_columns:
        connection.execute(text("ALTER TABLE message_data ADD COLUMN cause VARCHAR"))
    for column in message_data_columns:
        if column.casefold() in {"sponsoredgenerics", "unsponsoredgenerics"}:
            connection.execute(text(f'ALTER TABLE message_data DROP COLUMN "{column}"'))

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

app.include_router(
    reports.router,
    prefix="/reports",
    tags=["reports"]
)

@app.get("/")
def root():
    return {"message": "Patient Portal API is running"}