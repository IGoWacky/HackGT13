from fastapi import FastAPI

from .database import engine
from .models import Base
from .routes import patients, prescriptions

Base.metadata.create_all(bind=engine)

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

@app.get("/")
def root():
    return {"message": "Patient Portal API is running"}