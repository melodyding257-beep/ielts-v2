from __future__ import annotations

import asyncio
import base64
import json
import os
import re
import time
from typing import Any

import httpx
from fastapi import HTTPException

from backend.config import DOUBAO_API_KEY, DOUBAO_ENDPOINT, DOUBAO_API_URL, PARSER_PROFILE
from backend.timing import _now_ms

def get_active_model_profile() -> dict[str, str]:
    """Resolve only the selected profile so unused providers need no configuration."""
    if PARSER_PROFILE == "doubao":
        profile = {
            "profile": "doubao",
            "provider": "doubao",
            "protocol": "ark_chat_completions",
            "api_key": os.getenv("DOUBAO_API_KEY", ""),
            "api_url": DOUBAO_API_URL,
            "model": os.getenv("DOUBAO_ENDPOINT", ""),
        }
        required = ("api_key", "model")
    elif PARSER_PROFILE in {"qwen_ocr", "qwen_flash"}:
        prefix = PARSER_PROFILE.upper()
        profile = {
            "profile": PARSER_PROFILE,
            "provider": "qwen",
            "protocol": "dashscope_multimodal",
            "api_key": os.getenv(f"{prefix}_API_KEY", ""),
            "api_url": os.getenv(f"{prefix}_API_HOST", ""),
            "model": os.getenv(f"{prefix}_MODEL", ""),
            "workspace_id": os.getenv(f"{prefix}_WORKSPACE_ID", ""),
        }
        required = ("api_key", "api_url", "model")
    else:
        raise ValueError(
            f"未知PARSER_PROFILE={PARSER_PROFILE!r}；可选值为doubao、qwen_ocr、qwen_flash"
        )

    missing = [key for key in required if not profile.get(key)]
    if missing:
        names = ", ".join(missing)
        raise ValueError(f"模型配置不完整：profile={PARSER_PROFILE} 缺少 {names}")
    return profile


def _json_from_model_text(raw_text: str) -> dict[str, Any]:
    cleaned = re.sub(r"^```json\s*", "", raw_text.strip())
    cleaned = re.sub(r"\s*```$", "", cleaned.strip())
    try:
        value = json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if not match:
            raise
        value = json.loads(match.group())
    if not isinstance(value, dict):
        raise ValueError("model response is not a JSON object")
    return value


async def call_doubao(
    prompt: str,
    image_parts: list[bytes],
    page_numbers: list[int] | None = None,
) -> tuple[dict[str, Any], str, int]:
    """Run one visual extraction call and return parsed JSON, raw text and latency."""
    if not DOUBAO_API_KEY or not DOUBAO_ENDPOINT:
        raise ValueError("DOUBAO_API_KEY or DOUBAO_ENDPOINT not set")

    content: list[dict[str, Any]] = [{"type": "text", "text": prompt}]
    for page_number, image_bytes in zip(page_numbers or list(range(1, len(image_parts) + 1)), image_parts):
        content.append({"type": "text", "text": f"【第{page_number}页】"})
        encoded = base64.b64encode(image_bytes).decode("ascii")
        content.append(
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/png;base64,{encoded}",
                },
            }
        )

    started = time.perf_counter()
    raw_text = ""
    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            response = await client.post(
                DOUBAO_API_URL,
                headers={
                    "Authorization": f"Bearer {DOUBAO_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": DOUBAO_ENDPOINT,
                    "messages": [{"role": "user", "content": content}],
                    "temperature": 0,
                    "max_tokens": 12000,
                },
            )
        if response.status_code != 200:
            print(f"Doubao API error: {response.status_code}, {response.text[:500]}")
            raise HTTPException(status_code=502, detail="AI解析服务返回错误")
        result = response.json()
        raw_text = result.get("choices", [{}])[0].get("message", {}).get("content", "")
        return _json_from_model_text(raw_text), raw_text, _now_ms(started)
    except HTTPException:
        raise
    except json.JSONDecodeError as exc:
        print(f"JSON parse error: {exc}; output_length={len(raw_text)}")
        raise HTTPException(status_code=502, detail="AI未返回有效JSON") from exc
    except Exception as exc:
        print(f"Doubao call error: {type(exc).__name__}: {exc}")
        raise HTTPException(status_code=502, detail="AI解析服务连接失败") from exc


def _dashscope_response_text(response: Any) -> str:
    output = getattr(response, "output", None)
    if output is None and isinstance(response, dict):
        output = response.get("output")
    choices = getattr(output, "choices", None)
    if choices is None and isinstance(output, dict):
        choices = output.get("choices")
    if not choices:
        return ""
    choice = choices[0]
    message = getattr(choice, "message", None)
    if message is None and isinstance(choice, dict):
        message = choice.get("message")
    content = getattr(message, "content", None)
    if content is None and isinstance(message, dict):
        content = message.get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            str(item.get("text", ""))
            for item in content
            if isinstance(item, dict) and item.get("text") is not None
        )
    return ""


async def call_qwen_dashscope(
    profile: dict[str, str],
    prompt: str,
    image_parts: list[bytes],
    page_numbers: list[int] | None = None,
) -> tuple[dict[str, Any], str, int]:
    """Call a Qwen vision model through the official DashScope SDK."""
    try:
        import dashscope
        from dashscope import MultiModalConversation
    except ImportError as exc:
        raise HTTPException(
            status_code=500,
            detail="Qwen profile需要DashScope SDK，请重新安装backend/requirements.txt",
        ) from exc

    content: list[dict[str, str]] = []
    for page_number, image_bytes in zip(page_numbers or list(range(1, len(image_parts) + 1)), image_parts):
        encoded = base64.b64encode(image_bytes).decode("ascii")
        content.append({"text": f"【第{page_number}页】"})
        content.append({"image": f"data:image/png;base64,{encoded}"})
    content.append({"text": prompt})
    messages = [{"role": "user", "content": content}]

    dashscope.base_http_api_url = profile["api_url"].rstrip("/")
    started = time.perf_counter()
    raw_text = ""
    try:
        response = await asyncio.to_thread(
            MultiModalConversation.call,
            api_key=profile["api_key"],
            model=profile["model"],
            workspace=profile.get("workspace_id") or None,
            messages=messages,
            result_format="message",
            temperature=0,
            max_tokens=12000,
        )
        status_code = getattr(response, "status_code", 200)
        if status_code != 200:
            request_id = getattr(response, "request_id", "unknown")
            code = getattr(response, "code", "unknown")
            message = getattr(response, "message", "DashScope request failed")
            print(
                f"Qwen API error: status={status_code}, code={code}, "
                f"request_id={request_id}, message={str(message)[:500]}"
            )
            raise HTTPException(status_code=502, detail="千问视觉解析服务返回错误")
        raw_text = _dashscope_response_text(response)
        if not raw_text:
            raise ValueError("DashScope response contains no assistant text")
        return _json_from_model_text(raw_text), raw_text, _now_ms(started)
    except HTTPException:
        raise
    except json.JSONDecodeError as exc:
        print(f"Qwen JSON parse error: {exc}; output_length={len(raw_text)}")
        raise HTTPException(status_code=502, detail="千问未返回有效JSON") from exc
    except Exception as exc:
        print(f"Qwen call error: {type(exc).__name__}: {exc}")
        raise HTTPException(status_code=502, detail="千问视觉解析服务连接失败") from exc


async def call_active_model(
    profile: dict[str, str],
    prompt: str,
    image_parts: list[bytes],
    page_numbers: list[int] | None = None,
) -> tuple[dict[str, Any], str, int]:
    if profile["provider"] == "doubao":
        return await call_doubao(prompt, image_parts, page_numbers)
    if profile["provider"] == "qwen":
        return await call_qwen_dashscope(profile, prompt, image_parts, page_numbers)
    raise HTTPException(status_code=500, detail="当前模型供应商未实现")
