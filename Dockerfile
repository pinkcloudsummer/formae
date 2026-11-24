# Stage 1: Build the React/Vite PWA
FROM node:20-alpine AS frontend-builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY index.html tsconfig.json tsconfig.node.json vite.config.ts ./
COPY public ./public
COPY src ./src
RUN npm run build

# Stage 2: FastAPI NAS Sync Server + Built PWA
FROM python:3.11-slim

WORKDIR /app

COPY server/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY server/main.py ./main.py
COPY --from=frontend-builder /app/dist ./static

ENV FORMAE_DB_PATH=/data/formae.db
ENV FORMAE_STATIC_DIR=/app/static
EXPOSE 8787

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8787"]
