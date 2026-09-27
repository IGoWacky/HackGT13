from typing import Any

from sqlalchemy.orm import Session

from .models import PatientAuditLog


def record_patient_change(
    db: Session,
    *,
    patient_id: int,
    actor_source: str,
    action: str,
    entity_type: str,
    entity_id: int | None,
    changes: dict[str, Any],
) -> None:
    db.add(PatientAuditLog(
        patient_id=patient_id,
        actor_source=actor_source,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        changes=changes,
    ))