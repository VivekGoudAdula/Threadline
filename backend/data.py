"""Deterministic synthetic data with a realistic Threadline risk distribution."""

from datetime import datetime, timedelta, timezone
from random import Random
from typing import Any


def generate_synthetic_data(customer_count: int = 200, seed: int = 42) -> dict[str, Any]:
    """Create 200 varied journeys with known clean, moderate, and severe cases.

    The default fixture has 50% clean customers, 30% with one break, 15% with
    two breaks, and 5% with all three. Break combinations are intentionally
    rotated so no single type dominates the risk-ranked customer list.
    """
    if customer_count != 200:
        raise ValueError("Phase 2 fixture is designed for exactly 200 customers")

    rng = Random(seed)
    channels = ["app", "web", "call_center", "branch"]
    # 100 clean / 60 single / 30 dual / 10 severe customer definitions.
    break_sets = ([()] * 100
        + [("fee_mismatch",), ("repeat_contact",), ("contradiction",)] * 20
        + [("fee_mismatch", "repeat_contact"), ("fee_mismatch", "contradiction"), ("repeat_contact", "contradiction")] * 10
        + [("fee_mismatch", "repeat_contact", "contradiction")] * 10)
    rng.shuffle(break_sets)

    events: list[dict[str, Any]] = []
    customers: list[dict[str, Any]] = []
    identities: dict[str, str] = {}
    labels: dict[str, bool] = {}
    base_time = datetime(2026, 6, 1, 9, 0, tzinfo=timezone.utc)

    for index, breaks in enumerate(break_sets):
        customer_id = f"cust_{index + 1:03d}"
        name = f"Customer {index + 1:03d}"
        phone = f"+155500{index + 1000:04d}"
        event_count = rng.randint(3, 6)
        base_fee = rng.choice([35, 45, 50, 60])
        event_time = base_time + timedelta(days=index % 28, minutes=index * 3)

        for event_index in range(event_count):
            channel = channels[event_index % len(channels)]
            source_id = {"app": f"loyalty_{index + 1000}", "web": f"web_{index + 1000}", "call_center": phone, "branch": f"branch_{index + 1000}"}[channel]
            payload: dict[str, Any] = {"customer_name": name, "phone": phone, "issue": "purchase_protection", "status": "resolved"}
            event_type = "journey_activity"

            # Clean journeys include consistent quotes, while a fee break makes
            # the second channel quote deliberately disagree with the first.
            if event_index < 2:
                payload["quoted_fee"] = base_fee + (15 if "fee_mismatch" in breaks and event_index == 1 else 0)
                event_type = "fee_quote"
            if "repeat_contact" in breaks and event_index < 3:
                payload["status"] = "unresolved"
                event_type = "support_contact"
            if "contradiction" in breaks and event_index < 2:
                payload["coverage_eligible"] = event_index == 0
                # Alternate evidence strength so high-risk customers are not
                # identical: some contradictions are immediately critical,
                # while others are still serious but less certain.
                payload["contradiction_severity"] = "critical" if index % 2 == 0 else "high"
                # Keep first-contact status unresolved only when a repeat break is also seeded.
                event_type = "coverage_information" if "repeat_contact" not in breaks else event_type

            events.append({
                "event_id": f"evt_{index + 1:03d}_{event_index + 1}",
                "customer_id": source_id,
                "channel": channel,
                "timestamp": (event_time + timedelta(days=event_index * 2)).isoformat().replace("+00:00", "Z"),
                "event_type": event_type,
                "payload": payload,
            })

        customers.append({"id": customer_id, "name": name, "phone": phone})
        identities[phone] = customer_id
        labels[customer_id] = bool(breaks)

    return {"events": events, "customers": customers, "identities": identities, "ground_truth": labels, "ground_truth_breaks": {customer["id"]: list(break_sets[position]) for position, customer in enumerate(customers)}}


DATASET = generate_synthetic_data()
EVENTS = DATASET["events"]
CUSTOMERS = DATASET["customers"]
KNOWN_IDENTITIES = DATASET["identities"]
GROUND_TRUTH = DATASET["ground_truth"]
GROUND_TRUTH_BREAKS = DATASET["ground_truth_breaks"]
