from __future__ import annotations

import logging
import time
import uuid
from typing import Any

logger = logging.getLogger("uvicorn.error")

class ParseRequestTimingMiddleware:
    """Measure multipart parsing and response sending around the route handler."""

    def __init__(self, app: Any) -> None:
        self.app = app

    async def __call__(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
        if scope["type"] != "http" or scope.get("path") != "/parse" or scope.get("method") != "POST":
            await self.app(scope, receive, send)
            return

        started = time.perf_counter()
        run_id = str(uuid.uuid4())
        state = scope.setdefault("state", {})
        state["parse_run_id"] = run_id
        response_status = 0
        completed = False
        logger.info("[parse:%s] request_received", run_id)

        async def timed_send(message: dict[str, Any]) -> None:
            nonlocal response_status, completed
            if message["type"] == "http.response.start":
                response_status = message["status"]
            await send(message)
            if message["type"] == "http.response.body" and not message.get("more_body", False) and not completed:
                completed = True
                finished = time.perf_counter()
                handler_started = state.get("parse_handler_started")
                handler_finished = state.get("parse_handler_finished")
                pre_handler_ms = round((handler_started - started) * 1000) if handler_started else None
                after_handler_ms = round((finished - handler_finished) * 1000) if handler_finished else None
                logger.info(
                    "[parse:%s] http_complete status=%s total_ms=%s pre_handler_ms=%s after_handler_ms=%s",
                    run_id, response_status, round((finished - started) * 1000),
                    pre_handler_ms, after_handler_ms,
                )

        try:
            await self.app(scope, receive, timed_send)
        except Exception as exc:
            logger.error("[parse:%s] request_failed error_type=%s", run_id, type(exc).__name__)
            raise
        finally:
            if not completed:
                logger.warning(
                    "[parse:%s] http_incomplete elapsed_ms=%s status=%s",
                    run_id, round((time.perf_counter() - started) * 1000), response_status,
                )


def _now_ms(started: float) -> int:
    return round((time.perf_counter() - started) * 1000)


def _log_step(run_id: str, name: str, started: float, **details: Any) -> int:
    elapsed_ms = _now_ms(started)
    suffix = " ".join(f"{key}={value}" for key, value in details.items())
    logger.info("[parse:%s] step=%s elapsed_ms=%s %s", run_id, name, elapsed_ms, suffix)
    return elapsed_ms
