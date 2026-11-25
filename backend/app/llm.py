"""Thin client for an OpenAI-compatible chat API (Groq by default).

Swap providers by changing LLM_BASE_URL / LLM_MODEL / LLM_API_KEY: nothing else depends on Groq.
"""
from __future__ import annotations

import json
import os
import re
import time

import httpx


def config() -> dict:
    return {
        "api_key": os.getenv("LLM_API_KEY") or os.getenv("GROQ_API_KEY") or "",
        "base_url": os.getenv("LLM_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/"),
        "model": os.getenv("LLM_MODEL", "openai/gpt-oss-120b"),
        "fallback": os.getenv("LLM_FALLBACK_MODEL", "openai/gpt-oss-20b"),  # separate quota; "" turns it off
    }


def available() -> bool:
    return bool(config()["api_key"])


MAX_WAIT = 25  # seconds; a live screen should not hang longer than this


class LLMError(RuntimeError):
    pass


def _extract_json(text: str):
    text = text.strip()
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.M).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", text, re.S)
        if m:
            return json.loads(m.group(0))
        raise


def chat(messages: list[dict], json_mode: bool = False, temperature: float = 0.1, max_tokens: int = 4096,
         retries: int = 4) -> tuple[str, dict]:
    cfg = config()
    if not cfg["api_key"]:
        raise LLMError("No LLM API key configured")
    models = [m for m in dict.fromkeys([cfg["model"], cfg["fallback"]]) if m]
    last: object = None
    for model in models:
        body = {"model": model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens}
        if json_mode:
            body["response_format"] = {"type": "json_object"}
        effort = os.getenv("LLM_REASONING_EFFORT", "low")
        if "gpt-oss" in model and effort:
            body["reasoning_effort"] = effort  # fewer hidden reasoning tokens: fits Groq free-tier 8k TPM
        for attempt in range(retries + 1):
            t0 = time.time()
            try:
                r = httpx.post(f"{cfg['base_url']}/chat/completions", json=body,
                               headers={"Authorization": f"Bearer {cfg['api_key']}"}, timeout=90)
                if r.status_code == 429:
                    last = "rate limit reached"
                    try:
                        wait = float(r.headers.get("retry-after", "0"))
                    except ValueError:
                        wait = 0
                    if wait > MAX_WAIT or attempt == retries:
                        break  # e.g. the daily limit: waiting is pointless, use the next model
                    time.sleep(max(wait + 0.5, 2 + attempt * 3))
                    continue
                r.raise_for_status()
                data = r.json()
                content = data["choices"][0]["message"].get("content") or ""
                return content, {"model": data.get("model", model), "latency_ms": int((time.time() - t0) * 1000),
                                 "usage": data.get("usage", {}), "fallback": model != cfg["model"]}
            except (httpx.HTTPError, KeyError, ValueError) as e:
                last = e
                if attempt < min(retries, 1):
                    time.sleep(1.5)
                else:
                    break
    raise LLMError(f"AI unavailable: {last}")


def chat_json(messages: list[dict], **kw) -> tuple[dict, dict]:
    content, meta = chat(messages, json_mode=True, **kw)
    try:
        return _extract_json(content), meta
    except Exception:
        # one repair attempt
        content, meta = chat(messages + [{"role": "assistant", "content": content},
                                         {"role": "user", "content": "That was not valid JSON. Reply with ONLY the JSON object."}],
                             json_mode=True, **kw)
        return _extract_json(content), meta
