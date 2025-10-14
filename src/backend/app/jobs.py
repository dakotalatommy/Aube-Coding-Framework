import json
import os
import threading
import time
from typing import Any, Dict, Optional, Tuple

from sqlalchemy.orm import Session
from sqlalchemy import text as _sql_text, bindparam
from sqlalchemy.types import JSON as _SQL_JSON

from .cache import _client as _redis_client
from . import models as dbm
from .integrations.sms_twilio import twilio_send_sms
from .integrations.email_sendgrid import sendgrid_send_email
from .ai import AIClient
from .db import get_db, engine
from .metrics_counters import WEBHOOK_EVENTS  # reuse counter infra for jobs


QUEUE_SMS = "q:sms"
QUEUE_EMAIL = "q:email"
QUEUE_AI = "q:ai"


def _get_redis():
    return _redis_client()


def _enqueue(queue: str, payload: Dict[str, Any]) -> bool:
    c = _get_redis()
    if not c:
        return False
    body = json.dumps(payload)
    try:
        c.rpush(queue, body)
        try:
            WEBHOOK_EVENTS.labels(provider=queue, status="enqueued").inc()  # type: ignore
        except Exception:
            pass
        return True
    except Exception:
        return False


def enqueue_sms_job(tenant_id: str, to_phone: str, body: str, max_attempts: int = 5) -> bool:
    return _enqueue(QUEUE_SMS, {
        "type": "sms",
        "tenant_id": tenant_id,
        "to": to_phone,
        "body": body,
        "attempts": 0,
        "max_attempts": max_attempts,
    })


def enqueue_email_job(tenant_id: str, to_email: str, subject: str, html: str, text: Optional[str] = None, max_attempts: int = 5) -> bool:
    return _enqueue(QUEUE_EMAIL, {
        "type": "email",
        "tenant_id": tenant_id,
        "to": to_email,
        "subject": subject,
        "html": html,
        "text": text or "",
        "attempts": 0,
        "max_attempts": max_attempts,
    })


def enqueue_ai_job(tenant_id: str, session_id: str, prompt: str, max_attempts: int = 3) -> bool:
    return _enqueue(QUEUE_AI, {
        "type": "ai",
        "tenant_id": tenant_id,
        "session_id": session_id,
        "prompt": prompt,
        "attempts": 0,
        "max_attempts": max_attempts,
    })


def create_job_record(tenant_id: str, kind: str, input_payload: Dict[str, Any], status: str = "queued") -> Optional[str]:
    try:
        with engine.begin() as conn:
            try:
                conn.execute(_sql_text("SELECT set_config('app.role', :role, true)"), {"role": "owner_admin"})
                conn.execute(
                    _sql_text("SELECT set_config('app.tenant_id', :tenant_id, true)"),
                    {"tenant_id": tenant_id},
                )
            except Exception:
                pass
            stmt = _sql_text(
                "INSERT INTO jobs (tenant_id, kind, status, progress, input) "
                "VALUES (CAST(:t AS uuid), :k, :s, :p, :inp) RETURNING id"
            ).bindparams(bindparam("inp", type_=_SQL_JSON))
            row = conn.execute(
                stmt,
                {"t": tenant_id, "k": kind, "s": status, "p": 0, "inp": input_payload},
            ).fetchone()
            return str(row[0]) if row else None
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.exception("create_job_record failed: %s", str(e))
        return None


def update_job_record(
    job_id: Optional[str],
    *,
    status: Optional[str] = None,
    progress: Optional[int] = None,
    result: Optional[Dict[str, Any]] = None,
    error: Optional[str] = None,
    tenant_id: Optional[str] = None,
) -> None:
    if not job_id:
        return
    try:
        fields = []
        params: Dict[str, Any] = {"id": job_id}
        result_param_used = False
        if status:
            fields.append("status = :status")
            params["status"] = status
        if progress is not None:
            fields.append("progress = :progress")
            params["progress"] = progress
        if result is not None:
            fields.append("result = :result")
            params["result"] = result
            result_param_used = True
        elif error is not None:
            fields.append("result = :result")
            params["result"] = {"error": error}
            if not status:
                fields.append("status = 'error'")
            result_param_used = True
        if not fields:
            return
        fields.append("updated_at = CURRENT_TIMESTAMP")
        with engine.begin() as conn:
            effective_tenant = tenant_id
            try:
                conn.execute(_sql_text("SELECT set_config('app.role', :role, true)"), {"role": "owner_admin"})
                if not effective_tenant:
                    row = conn.execute(
                        _sql_text("SELECT tenant_id::text FROM jobs WHERE id = :id"),
                        {"id": job_id},
                    ).fetchone()
                    if row and row[0]:
                        effective_tenant = str(row[0])
                if effective_tenant:
                    conn.execute(
                        _sql_text("SELECT set_config('app.tenant_id', :tenant_id, true)"),
                        {"tenant_id": effective_tenant},
                    )
            except Exception:
                pass
            stmt = _sql_text(f"UPDATE jobs SET {' , '.join(fields)} WHERE id = :id")
            if result_param_used:
                stmt = stmt.bindparams(bindparam("result", type_=_SQL_JSON))
            conn.execute(stmt, params)
    except Exception:
        pass


def get_job_record(job_id: str, tenant_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    try:
        with engine.begin() as conn:
            try:
                conn.execute(_sql_text("SELECT set_config('app.role', :role, true)"), {"role": "owner_admin"})
                if tenant_id:
                    conn.execute(
                        _sql_text("SELECT set_config('app.tenant_id', :tenant_id, true)"),
                        {"tenant_id": tenant_id},
                    )
            except Exception:
                pass
            row = conn.execute(
                _sql_text(
                    "SELECT id, tenant_id, kind, status, progress, input, result, created_at, updated_at "
                    "FROM jobs WHERE id = :id"
                ),
                {"id": job_id},
            ).fetchone()
            if not row:
                return None
            return {
                "id": str(row[0]),
                "tenant_id": str(row[1]) if row[1] else None,
                "kind": row[2],
                "status": row[3],
                "progress": row[4],
                "input": row[5],
                "result": row[6],
                "created_at": row[7],
                "updated_at": row[8],
            }
    except Exception:
        return None


def _record_dead_letter(db: Session, tenant_id: str, provider: str, reason: str, payload: Dict[str, Any], attempts: int) -> None:
    try:
        db.add(dbm.DeadLetter(
            tenant_id=tenant_id,
            provider=provider,
            reason=f"{reason} (attempts={attempts})",
            attempts=attempts,
            payload=json.dumps(payload)[:8000],
        ))
        db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass


def _process_job(db: Session, job: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    jtype = str(job.get("type"))
    try:
        if jtype == "sms":
            to = str(job.get("to"))
            body = str(job.get("body") or "")
            ok = twilio_send_sms(to, body)
            return (bool(ok), None if ok else "twilio_send_failed")
        if jtype == "email":
            to = str(job.get("to"))
            subject = str(job.get("subject") or "")
            html = str(job.get("html") or "")
            text = str(job.get("text") or "")
            ok = sendgrid_send_email(to, subject, html, text)
            return (bool(ok), None if ok else "sendgrid_send_failed")
        if jtype == "ai":
            tenant_id = str(job.get("tenant_id"))
            prompt = str(job.get("prompt") or "")
            try:
                import asyncio
                client = AIClient()
                text = asyncio.run(client.generate(
                    system=("You are BrandVX, a helpful assistant for beauty professionals."
                            " Keep responses concise."),
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=200,
                ))
                try:
                    if text:
                        db.add(dbm.ChatLog(tenant_id=tenant_id, session_id="jobs.ai", role="assistant", content=text))
                        db.commit()
                except Exception:
                    try: db.rollback()
                    except Exception: pass
                return (True, None)
            except Exception as e:
                return (False, str(e) or "ai_generate_failed")
        return (True, None)
    except Exception as e:
        return (False, str(e) or "exception")


def _worker_loop() -> None:
    # Only run when explicitly enabled
    if os.getenv("ENABLE_WORKER", "0") != "1":
        return
    c = _get_redis()
    if not c:
        return
    queues = [QUEUE_SMS, QUEUE_EMAIL, QUEUE_AI]
    while True:
        try:
            # Blocking pop across queues with 5s timeout
            item = None
            try:
                popped = c.blpop(queues, timeout=5)
                if popped:
                    _, data = popped
                    item = json.loads(data)
            except Exception:
                item = None

            if not item:
                time.sleep(0.5)
                continue

            # Process
            with next(get_db()) as db:  # type: ignore
                ok, err = _process_job(db, item)
                if ok:
                    try:
                        WEBHOOK_EVENTS.labels(provider=str(item.get("type") or "unknown"), status="done").inc()  # type: ignore
                    except Exception:
                        pass
                    continue
                # Retry or dead-letter
                attempts = int(item.get("attempts", 0)) + 1
                item["attempts"] = attempts
                max_attempts = int(item.get("max_attempts", 3))
                if attempts >= max_attempts:
                    _record_dead_letter(db, str(item.get("tenant_id") or ""), str(item.get("type") or "unknown"), err or "failed", item, attempts)
                    try:
                        WEBHOOK_EVENTS.labels(provider=str(item.get("type") or "unknown"), status="dead_letter").inc()  # type: ignore
                    except Exception:
                        pass
                    continue
                backoff = min(60, 2 ** attempts)  # seconds
                time.sleep(backoff)
                # requeue
                try:
                    c.rpush(QUEUE_SMS if item.get("type") == "sms" else QUEUE_EMAIL if item.get("type") == "email" else QUEUE_AI, json.dumps(item))
                except Exception:
                    _record_dead_letter(db, str(item.get("tenant_id") or ""), str(item.get("type") or "unknown"), "requeue_failed", item, attempts)
        except Exception:
            # Avoid crashing the worker
            time.sleep(1.0)


def start_job_worker_if_enabled() -> None:
    import logging
    logger = logging.getLogger(__name__)
    try:
        if os.getenv("ENABLE_WORKER", "0") != "1":
            logger.info("Worker disabled (ENABLE_WORKER != 1)")
            return
        logger.info("Starting Redis job worker thread...")
        t = threading.Thread(target=_worker_loop, daemon=True)
        t.start()
        logger.info("Redis worker thread started")
        
        if os.getenv("ENABLE_FOLLOWUPS_WORKER", "0") == "1":
            logger.info("Starting followups worker thread...")
            from .workers.followups import run_forever as run_followups_worker

            t_followups = threading.Thread(target=run_followups_worker, kwargs={"sleep_seconds": float(os.getenv("FOLLOWUPS_WORKER_SLEEP", "2"))}, daemon=True)
            t_followups.start()
            logger.info("Followups worker thread started successfully")
        else:
            logger.info("Followups worker disabled (ENABLE_FOLLOWUPS_WORKER != 1)")
    except Exception as e:
        logger.exception("CRITICAL: Worker startup failed: %s", str(e))
