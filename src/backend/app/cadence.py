from typing import List, Dict


NEVER_ANSWERED_STEPS: List[Dict[str, str | int]] = [
    {"day": 2, "channel": "sms"},
    {"day": 5, "channel": "email"},
    {"day": 9, "channel": "email"},
    {"day": 12, "channel": "email"},
    {"day": 17, "channel": "email"},
    {"day": 20, "channel": "email"},
    {"day": 23, "channel": "email"},
    {"day": 28, "channel": "email"},
]


RETARGETING_NO_ANSWER: List[Dict[str, str | int]] = [
    {"day": 60, "channel": "sms"},
]


def get_cadence_definition(cadence_id: str) -> List[Dict[str, str | int]]:
    if cadence_id == "never_answered":
        return NEVER_ANSWERED_STEPS
    if cadence_id == "retargeting_no_answer":
        return RETARGETING_NO_ANSWER
    return []


