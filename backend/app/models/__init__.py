"""
SQLAlchemy ORM models — re-exported from individual domain modules.

Import pattern:
    from app.models import User, Report, Village, Animal, ...
"""
from app.models.user import User
from app.models.village import Village
from app.models.animal import Animal, Vaccination
from app.models.report import Report
from app.models.risk import RiskAssessment
from app.models.lab import LabReferral
from app.models.alert import ContainmentZone, Alert, Notification

__all__ = [
    "User",
    "Village",
    "Animal",
    "Vaccination",
    "Report",
    "RiskAssessment",
    "LabReferral",
    "ContainmentZone",
    "Alert",
    "Notification",
]
