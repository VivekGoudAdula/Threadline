"""Accuracy check for the deliberately seeded Threadline fixture."""

from collections import defaultdict

from data import EVENTS, GROUND_TRUTH, KNOWN_IDENTITIES
from detectors import detect_breaks


def test_detection_accuracy() -> None:
    """Verify that rule detection recovers the seeded broken-customer labels."""
    resolved = defaultdict(list)
    for event in EVENTS:
        resolved[KNOWN_IDENTITIES[event["payload"]["phone"]]].append(event)
    predictions = {customer_id: bool(detect_breaks(events)) for customer_id, events in resolved.items()}
    correct = sum(predictions[customer_id] == label for customer_id, label in GROUND_TRUTH.items())
    accuracy = correct / len(GROUND_TRUTH)
    print(f"Detection accuracy: {accuracy:.1%} ({correct}/{len(GROUND_TRUTH)})")
    assert accuracy >= 0.95
