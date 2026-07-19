"""Rule-based break-point detectors for a stitched customer timeline."""

from collections import defaultdict
from datetime import datetime
from typing import Any

RISK_WEIGHTS = {"contradiction": 4, "fee_mismatch": 3, "repeat_contact": 2}


def detect_fee_mismatch(timeline: list[dict[str, Any]]) -> dict[str, str] | None:
    """Find different fee quotes for the same issue across channels."""
    quotes: dict[str, set[tuple[Any, str]]] = defaultdict(set)
    for event in timeline:
        payload = event["payload"]
        if "quoted_fee" in payload:
            quotes[payload.get("issue", "unknown")].add((payload["quoted_fee"], event["channel"]))
    for issue, values in quotes.items():
        if len({fee for fee, _ in values}) > 1 and len({channel for _, channel in values}) > 1:
            fees = ", ".join(f"${fee}" for fee in sorted({fee for fee, _ in values}))
            return {"type": "fee_mismatch", "explanation": f"Different {issue} fees were quoted across channels: {fees}.", "severity": "high"}
    return None


def detect_repeat_unresolved_contact(timeline: list[dict[str, Any]]) -> dict[str, str] | None:
    """Find three unresolved contacts about one issue within a seven-day period."""
    unresolved: dict[str, list[datetime]] = defaultdict(list)
    for event in timeline:
        if event["payload"].get("status") == "unresolved":
            unresolved[event["payload"].get("issue", "unknown")].append(_timestamp(event))
    for issue, timestamps in unresolved.items():
        timestamps.sort()
        for start in range(len(timestamps) - 2):
            if (timestamps[start + 2] - timestamps[start]).days <= 7:
                return {"type": "repeat_contact", "explanation": f"The customer made at least three unresolved contacts about {issue} within seven days.", "severity": "medium"}
    return None


def detect_contradiction(timeline: list[dict[str, Any]]) -> dict[str, str] | None:
    """Find conflicting coverage eligibility information supplied across channels."""
    answers: dict[str, set[tuple[bool, str]]] = defaultdict(set)
    for event in timeline:
        payload = event["payload"]
        if "coverage_eligible" in payload:
            answers[payload.get("issue", "unknown")].add((payload["coverage_eligible"], event["channel"]))
    for issue, values in answers.items():
        if len({answer for answer, _ in values}) > 1 and len({channel for _, channel in values}) > 1:
            severity = "critical" if any(event["payload"].get("contradiction_severity") == "critical" for event in timeline if "coverage_eligible" in event["payload"]) else "high"
            return {"type": "contradiction", "explanation": f"Conflicting eligibility information about {issue} was given across channels.", "severity": severity}
    return None


def _timestamp(event: dict[str, Any]) -> datetime:
    """Parse an event timestamp consistently for time-window rules."""
    return datetime.fromisoformat(event["timestamp"].replace("Z", "+00:00"))


def detect_breaks(timeline: list[dict[str, Any]]) -> list[dict[str, str]]:
    """Run every rule detector and return only the breaks that were found."""
    return [result for result in (detect_fee_mismatch(timeline), detect_repeat_unresolved_contact(timeline), detect_contradiction(timeline)) if result]


def risk_score(breaks: list[dict[str, str]]) -> int:
    """Calculate a capped score from weights plus a critical-evidence uplift."""
    base_score = sum(RISK_WEIGHTS[break_["type"]] for break_ in breaks)
    critical_uplift = sum(1 for break_ in breaks if break_["severity"] == "critical")
    return min(10, base_score + critical_uplift)


def update_risk_weights(weights: dict[str, int]) -> None:
    """Replace in-memory rule weights used by every subsequent timeline score."""
    RISK_WEIGHTS.update(weights)
