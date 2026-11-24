import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

DB_PATH = Path(os.getenv("FORMAE_DB_PATH", "./data/formae.db"))
STATIC_DIR = Path(os.getenv("FORMAE_STATIC_DIR", "/app/static"))
API_TOKEN = os.getenv("FORMAE_API_TOKEN", "").strip()
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("FORMAE_CORS_ORIGINS", "*").split(",")
    if origin.strip()
]

app = FastAPI(title="FORMAE NAS Sync Server", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS else ["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                updated_at TEXT NOT NULL,
                deleted_at TEXT,
                payload TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS custom_exercises (
                id TEXT PRIMARY KEY,
                updated_at TEXT NOT NULL,
                deleted_at TEXT,
                payload TEXT NOT NULL
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_exercises_updated ON custom_exercises(updated_at)"
        )
        conn.commit()


@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def verify_token(authorization: Optional[str] = Header(default=None)) -> None:
    if not API_TOKEN:
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    provided = authorization[len("Bearer ") :].strip()
    if provided != API_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid API token")


@app.on_event("startup")
def on_startup() -> None:
    init_db()


class SyncPushRequest(BaseModel):
    sessions: List[Dict[str, Any]] = []
    exercises: List[Dict[str, Any]] = []


@app.get("/api/health", dependencies=[Depends(verify_token)])
def health_check() -> Dict[str, Any]:
    return {
        "status": "ok",
        "service": "formae-nas-sync",
        "serverTime": datetime.now(timezone.utc).isoformat(),
    }


def _upsert_records(
    conn: sqlite3.Connection, table: str, records: List[Dict[str, Any]]
) -> List[str]:
    acked: List[str] = []
    for record in records:
        rec_id = record.get("id")
        updated_at = record.get("updatedAt")
        if not rec_id or not updated_at:
            continue

        row = conn.execute(
            f"SELECT updated_at FROM {table} WHERE id = ?", (rec_id,)
        ).fetchone()

        # Last-Write-Wins (LWW) based on ISO-8601 UTC updatedAt timestamp
        if row is None or updated_at >= row["updated_at"]:
            normalized = dict(record)
            normalized["syncStatus"] = "synced"
            conn.execute(
                f"""
                INSERT INTO {table} (id, updated_at, deleted_at, payload)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    updated_at = excluded.updated_at,
                    deleted_at = excluded.deleted_at,
                    payload = excluded.payload
                """,
                (
                    rec_id,
                    updated_at,
                    record.get("deletedAt"),
                    json.dumps(normalized),
                ),
            )
        acked.append(rec_id)
    return acked


@app.post("/api/sync/push", dependencies=[Depends(verify_token)])
def sync_push(body: SyncPushRequest) -> Dict[str, Any]:
    with get_conn() as conn:
        ack_sessions = _upsert_records(conn, "sessions", body.sessions)
        ack_exercises = _upsert_records(conn, "custom_exercises", body.exercises)

    return {
        "ackSessionIds": ack_sessions,
        "ackExerciseIds": ack_exercises,
        "serverTime": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/sync/pull", dependencies=[Depends(verify_token)])
def sync_pull(
    since: Optional[str] = Query(default=None, description="ISO-8601 UTC cursor")
) -> Dict[str, Any]:
    with get_conn() as conn:
        if since:
            s_rows = conn.execute(
                "SELECT payload FROM sessions WHERE updated_at > ? ORDER BY updated_at ASC",
                (since,),
            ).fetchall()
            e_rows = conn.execute(
                "SELECT payload FROM custom_exercises WHERE updated_at > ? ORDER BY updated_at ASC",
                (since,),
            ).fetchall()
        else:
            s_rows = conn.execute(
                "SELECT payload FROM sessions ORDER BY updated_at ASC"
            ).fetchall()
            e_rows = conn.execute(
                "SELECT payload FROM custom_exercises ORDER BY updated_at ASC"
            ).fetchall()

    return {
        "serverTime": datetime.now(timezone.utc).isoformat(),
        "sessions": [json.loads(r["payload"]) for r in s_rows],
        "exercises": [json.loads(r["payload"]) for r in e_rows],
    }


# Serve the built React PWA when bundled into the container
if STATIC_DIR.is_dir():
    assets_dir = STATIC_DIR / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        candidate = (STATIC_DIR / full_path).resolve()
        if (
            full_path
            and candidate.is_file()
            and str(candidate).startswith(str(STATIC_DIR.resolve()))
        ):
            return FileResponse(candidate)
        return FileResponse(STATIC_DIR / "index.html")

