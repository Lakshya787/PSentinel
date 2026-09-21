"""
app/services/alert_service.py — Notification and advisory dispatch logic.
"""
from __future__ import annotations

import logging
from sqlalchemy.orm import Session
from app.models.alert import ContainmentZone, Alert, Notification

logger = logging.getLogger("pashu.alerts")


def create_containment_alerts(db: Session, report_id: str, village_name: str, disease: str) -> list[Alert]:
    """
    Generate farmer advisories and notifications for containment zones.
    """
    zones = db.query(ContainmentZone).filter(ContainmentZone.report_id == report_id).all()
    created_alerts = []
    
    for zone in zones:
        ring = zone.ring_km
        if ring <= 3.0:
            title = f"Protection Zone Advisory - {village_name}"
            message = f"High alert: Suspected {disease} case reported near {village_name}. Restrict animal movement within 3 km."
        else:
            title = f"Surveillance Zone Notice - {village_name}"
            message = f"Surveillance warning: Monitor livestock closely for symptoms of {disease} within 10 km."
            
        alert = Alert(
            containment_zone_id=zone.id,
            language="en",
            title=title,
            message=message,
        )
        db.add(alert)
        created_alerts.append(alert)
        
    db.commit()
    logger.info(f"Dispatched {len(created_alerts)} advisories for report {report_id}")
    return created_alerts
