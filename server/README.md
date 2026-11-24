# FORMAE NAS Sync Server

Lightweight local-first sync backend (FastAPI + SQLite) designed to run on a home NAS (Synology, TrueNAS, Unraid, Raspberry Pi, or any Docker host).

## Quick Start (Docker Compose)

1. Edit `docker-compose.yml` and set `FORMAE_API_TOKEN` to a strong secret string.
2. Start the container:
   ```bash
   docker compose up -d --build
   ```
3. In the FORMAE web app, open **SYSTEM** and set:
   - **NAS API Base URL:** `http://<your-nas-ip>:8787` (or your Tailscale / reverse-proxy HTTPS URL)
   - **Bearer API Token:** your `FORMAE_API_TOKEN` value
4. Click **TEST NAS LINK** and **SYNC NOW**.

## Local Development (Without Docker)

```bash
pip install -r requirements.txt
FORMAE_API_TOKEN=dev-secret uvicorn main:app --host 0.0.0.0 --port 8787 --reload
```

## Endpoints

- `GET /api/health` — Fast reachability probe
- `POST /api/sync/push` — Idempotent Last-Write-Wins upsert of sessions & custom exercises
- `GET /api/sync/pull?since=<ISO>` — Pulls records updated after the client's `lastSyncAt` cursor
