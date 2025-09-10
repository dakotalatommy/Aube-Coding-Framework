from __future__ import annotations
from typing import Dict, List, Tuple


def _contains_any(text: str, needles: List[str]) -> bool:
    t = text.lower()
    return any(n in t for n in needles)


def detect_mode(user_text: str) -> Dict[str, object]:
    """Lightweight, zero‑cost detector for context mode based on the last user turn.
    Returns { mode: str|"", reasons: [str], confidence: float }.
    Only heuristics — keep conservative (favor empty mode when unsure).
    """
    text = (user_text or "").strip().lower()
    if not text:
        return {"mode": "", "reasons": [], "confidence": 0.0}

    reasons: List[str] = []
    scores: List[Tuple[str, float]] = []

    # Support / confusion markers
    if _contains_any(text, [
        "i'm confused", "im confused", "i am confused",
        "i don't understand", "i dont understand", "do not understand",
        "this is confusing", "help me understand", "not sure what to do",
        "where do i start", "what do i do", "how do i start",
    ]):
        scores.append(("support", 0.95))
        reasons.append("confusion markers")

    # Messaging intent
    if _contains_any(text, [
        "draft", "reply", "respond", "send", "caption", "script",
        "write a message", "compose", "sms", "email",
    ]):
        scores.append(("messaging", 0.75))
        reasons.append("messaging verbs")

    # Scheduler intent
    if _contains_any(text, [
        "schedule", "reschedule", "move appointment", "cancel appointment",
        "openings", "slots", "book me", "calendar",
    ]):
        scores.append(("scheduler", 0.75))
        reasons.append("scheduling phrases")

    # Analysis intent
    if _contains_any(text, [
        "how many", "list", "top ", "show me", "revenue", "rate", "cohort",
        "count", "breakdown", "segment", "metrics",
    ]):
        scores.append(("analysis", 0.7))
        reasons.append("analysis keywords")

    # Train intent (brand/voice refinement)
    if _contains_any(text, [
        "tone", "voice", "brand profile", "refine", "style", "palette", "scaffolds",
    ]):
        scores.append(("train", 0.6))
        reasons.append("training terms")

    # To‑Do intent
    if _contains_any(text, [
        "todo", "task", "remind", "follow up", "assign",
    ]):
        scores.append(("todo", 0.6))
        reasons.append("todo terms")

    if not scores:
        return {"mode": "", "reasons": [], "confidence": 0.0}

    # Pick highest score; if tie, prefer support > messaging > scheduler > analysis > train > todo
    preference = {"support": 6, "messaging": 5, "scheduler": 4, "analysis": 3, "train": 2, "todo": 1}
    scores.sort(key=lambda x: (x[1], preference.get(x[0], 0)), reverse=True)
    mode, conf = scores[0]
    return {"mode": mode, "reasons": reasons, "confidence": float(conf)}

