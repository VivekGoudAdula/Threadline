"""Threadline: an in-memory API for stitched customer journeys and break risk."""

from collections import defaultdict
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from data import CUSTOMERS, EVENTS, KNOWN_IDENTITIES
from detectors import RISK_WEIGHTS, detect_breaks, risk_score, update_risk_weights

app = FastAPI(title="Threadline", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
last_recalculated: str | None = None


class RiskWeightSettings(BaseModel):
    """Validated scoring weights submitted by the prototype settings screen."""

    contradiction: int = Field(ge=0, le=10)
    fee_mismatch: int = Field(ge=0, le=10)
    repeat_contact: int = Field(ge=0, le=10)


def resolve_identities(events: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """Resolve channel-specific IDs into canonical customer groups using phone evidence."""
    grouped_events: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for event in events:
        resolved_event = deepcopy(event)
        phone = resolved_event["payload"].get("phone")
        canonical_id = KNOWN_IDENTITIES.get(phone, resolved_event["customer_id"])
        resolved_event["source_customer_id"] = resolved_event["customer_id"]
        resolved_event["customer_id"] = canonical_id
        resolved_event["identity_resolution"] = {"matched_on": "phone" if phone in KNOWN_IDENTITIES else "source_customer_id", "confidence": 0.98 if phone in KNOWN_IDENTITIES else 0.50}
        grouped_events[canonical_id].append(resolved_event)
    return dict(grouped_events)


def describe_event(event: dict[str, Any]) -> str:
    """Convert a raw journey event into a concise human-readable timeline entry."""
    payload = event["payload"]
    if event["event_type"] == "fee_quote":
        return f"Received a ${payload['quoted_fee']} {payload['issue']} fee quote via {event['channel']}."
    if event["event_type"] == "support_contact":
        return f"Contacted {event['channel']} about an unresolved {payload['issue']} issue."
    if event["event_type"] == "coverage_information":
        answer = "eligible" if payload["coverage_eligible"] else "not eligible"
        return f"Was told they were {answer} for {payload['issue']} coverage via {event['channel']}."
    return f"Completed a {event['channel']} journey activity."


def stitch_timeline(customer_id: str, matched_events: list[dict[str, Any]]) -> dict[str, Any]:
    """Sort events, annotate their breaks, and return one complete customer timeline."""
    ordered = sorted(matched_events, key=lambda event: datetime.fromisoformat(event["timestamp"].replace("Z", "+00:00")))
    breaks = detect_breaks(ordered)
    timeline = []
    for event in ordered:
        item = {key: event[key] for key in ("event_id", "timestamp", "channel", "event_type", "payload", "identity_resolution")}
        item["description"] = describe_event(event)
        item["detected_breaks"] = _breaks_for_event(event, breaks)
        timeline.append(item)
    return {"customer_id": customer_id, "event_count": len(timeline), "risk_score": risk_score(breaks), "detected_breaks": breaks, "timeline": timeline}


def _breaks_for_event(event: dict[str, Any], breaks: list[dict[str, str]]) -> list[dict[str, str]]:
    """Place each detected break at the event type where it becomes apparent."""
    payload = event["payload"]
    relevant = {
        "fee_mismatch": "quoted_fee" in payload,
        "repeat_contact": payload.get("status") == "unresolved",
        "contradiction": "coverage_eligible" in payload,
    }
    return [break_ for break_ in breaks if relevant[break_["type"]]]


def _all_timelines() -> dict[str, dict[str, Any]]:
    """Resolve and stitch the static in-memory event dataset for API responses."""
    return {customer_id: stitch_timeline(customer_id, events) for customer_id, events in resolve_identities(EVENTS).items()}


@app.get("/settings")
def get_settings() -> dict[str, Any]:
    """Return the current in-memory risk-weight configuration and refresh time."""
    return {"weights": dict(RISK_WEIGHTS), "last_recalculated": last_recalculated}


@app.post("/settings/recalculate")
def recalculate_all_risk_scores(settings: RiskWeightSettings) -> dict[str, Any]:
    """Apply new weights and immediately re-score every in-memory customer journey."""
    global last_recalculated
    update_risk_weights(settings.model_dump())
    timelines = _all_timelines()
    last_recalculated = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    return {"weights": dict(RISK_WEIGHTS), "last_recalculated": last_recalculated, "customers_recalculated": len(timelines)}


def replay_with_fix(customer_id: str, matched_events: list[dict[str, Any]]) -> dict[str, Any]:
    """Copy a broken journey, apply one corrective action, and re-score it."""
    original = stitch_timeline(customer_id, matched_events)
    if not original["detected_breaks"]:
        raise ValueError("No detected break is available to replay")

    fixed_events = deepcopy(matched_events)
    break_type = original["detected_breaks"][0]["type"]
    if break_type == "fee_mismatch":
        first_fee = next(event["payload"]["quoted_fee"] for event in fixed_events if "quoted_fee" in event["payload"])
        for event in fixed_events:
            if "quoted_fee" in event["payload"]:
                event["payload"]["quoted_fee"] = first_fee
    elif break_type == "repeat_contact":
        for event in fixed_events:
            if event["event_type"] == "support_contact":
                event["payload"]["status"] = "resolved"
    elif break_type == "contradiction":
        first_answer = next(event["payload"]["coverage_eligible"] for event in fixed_events if "coverage_eligible" in event["payload"])
        for event in fixed_events:
            if "coverage_eligible" in event["payload"]:
                event["payload"]["coverage_eligible"] = first_answer

    fixed = stitch_timeline(customer_id, fixed_events)
    return {"customer_id": customer_id, "applied_fix": break_type, "original": original, "fixed": fixed, "projected_outcome": "Estimated to prevent escalation and retain customer."}


@app.get("/health")
def health() -> dict[str, str]:
    """Report that the Threadline in-memory API is ready."""
    return {"status": "ok"}


@app.get("/customers")
def get_customers() -> list[dict[str, Any]]:
    """List customers ordered from highest to lowest detected journey risk."""
    timelines = _all_timelines()
    return sorted(
        (
            {
                "id": customer["id"],
                "name": customer["name"],
                "risk_score": timelines[customer["id"]]["risk_score"],
                "break_count": len(timelines[customer["id"]]["detected_breaks"]),
                "break_types": [break_["type"] for break_ in timelines[customer["id"]]["detected_breaks"]],
            }
            for customer in CUSTOMERS
        ),
        key=lambda customer: customer["risk_score"],
        reverse=True,
    )


@app.get("/timeline/{customer_id}")
def get_timeline(customer_id: str) -> dict[str, Any]:
    """Return one customer’s chronological timeline, detected breaks, and risk score."""
    timeline = _all_timelines().get(customer_id)
    if timeline is None:
        raise HTTPException(status_code=404, detail="Customer timeline not found")
    return timeline


@app.post("/replay/{customer_id}")
def replay(customer_id: str) -> dict[str, Any]:
    """Return original and counterfactual fixed journeys for a broken customer."""
    matched_events = resolve_identities(EVENTS).get(customer_id)
    if matched_events is None:
        raise HTTPException(status_code=404, detail="Customer timeline not found")
    try:
        return replay_with_fix(customer_id, matched_events)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
