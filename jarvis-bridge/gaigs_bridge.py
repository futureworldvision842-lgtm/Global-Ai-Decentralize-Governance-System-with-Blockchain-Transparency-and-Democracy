"""Safe JARVIS bridge for GAIGS.

This service intentionally exposes civic intelligence only. It never imports or
forwards the PC-control, command execution, screenshot, file, WhatsApp, or
desktop automation endpoints from Muhammad's private JARVIS installation.
"""
import hashlib
import hmac
import json
import os
import time
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="GAIGS JARVIS Bridge", version="1.0.0")
origins = [x.strip() for x in os.getenv("GAIGS_ALLOWED_ORIGINS", "http://localhost:8000,http://127.0.0.1:8000").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False, allow_methods=["GET", "POST"], allow_headers=["Authorization", "Content-Type"])

BRIDGE_TOKEN = os.getenv("GAIGS_JARVIS_BRIDGE_TOKEN", "")
RATE: dict[str, list[float]] = {}

class AskRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=3000)
    uid: str = Field(min_length=1, max_length=128)
    scope: str = Field(pattern="^(personal|society|city|country|global)$")
    context: dict = Field(default_factory=dict)

def authorize(header: str | None) -> None:
    if not BRIDGE_TOKEN:
        raise HTTPException(503, "Bridge token is not configured")
    supplied = (header or "").removeprefix("Bearer ")
    if not hmac.compare_digest(supplied, BRIDGE_TOKEN):
        raise HTTPException(401, "Unauthorized")

def rate_limit(uid: str) -> None:
    now = time.time()
    bucket = [t for t in RATE.get(uid, []) if now - t < 60]
    if len(bucket) >= 20:
        raise HTTPException(429, "Rate limit exceeded")
    bucket.append(now)
    RATE[uid] = bucket

def safe_context(raw: dict) -> dict:
    allowed = {"city", "country", "community", "skills", "proposal", "treasurySummary", "emergencySummary", "view"}
    return {k: v for k, v in raw.items() if k in allowed}

@app.get("/health")
def health():
    return {"ok": True, "service": "gaigs-jarvis-bridge", "pcControlExposed": False}

@app.post("/v1/ask")
def ask(req: AskRequest, authorization: str | None = Header(default=None)):
    authorize(authorization)
    rate_limit(req.uid)
    context = safe_context(req.context)
    system = (
        "You are JARVIS inside GAIGS. Explain civic records, compare evidence, "
        "help draft posts/proposals and find relevant services. AI assists; humans decide. "
        "Never cast votes, approve identity, move money, claim legal authority, or expose private data. "
        f"User scope: {req.scope}. Context: {json.dumps(context, ensure_ascii=False)[:5000]}"
    )
    try:
        import google.genai as genai
        key_path = Path(os.getenv("JARVIS_KEYS_FILE", r"E:\jarvis\config\api_keys.json"))
        key = os.getenv("GEMINI_KEY")
        if not key and key_path.exists():
            key = json.loads(key_path.read_text(encoding="utf-8")).get("gemini_api_key")
        if not key:
            raise RuntimeError("Gemini key not configured")
        client = genai.Client(api_key=key)
        result = client.models.generate_content(model="gemini-2.5-flash", contents=system + "\n\nUSER:\n" + req.prompt)
        answer = (result.text or "").strip()
    except Exception:
        answer = "JARVIS is available in safe offline mode. I can help structure this issue, identify evidence, and prepare a proposal, but I cannot vote or move funds."
    audit_id = hashlib.sha256(f"{req.uid}:{req.scope}:{time.time_ns()}".encode()).hexdigest()[:20]
    return {"answer": answer, "auditId": audit_id, "allowedActions": ["explain", "compare", "draft", "search"]}

