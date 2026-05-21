# ============================================
# STAGE 1: Backend Dependencies
# ============================================
FROM python:3.11-slim AS backend-builder

WORKDIR /backend

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libgomp1 \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --retries 5 --timeout 200 -r requirements.txt

# ============================================
# STAGE 2: Frontend Build
# ============================================
FROM node:20-slim AS frontend-builder

WORKDIR /frontend

# Copy frontend files
COPY frontend/package*.json ./

RUN npm config set registry https://registry.npmmirror.com && \
    npm install --no-audit --progress=false || npm install --no-audit --progress=false

COPY frontend/ ./

# Build Angular app
RUN npx ng build --configuration production

# ============================================
# STAGE 3: Runtime (NGINX + FASTAPI)
# ============================================
FROM python:3.11-slim

# Install runtime packages
RUN apt-get update && apt-get install -y \
    nginx \
    supervisor \
    curl \
    libpq-dev \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Python packages from backend-builder
COPY --from=backend-builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=backend-builder /usr/local/bin /usr/local/bin

# Copy backend application code
COPY alembic ./alembic
COPY app ./app
COPY alembic.ini .
COPY .env .

# Create necessary directories
RUN mkdir -p templates generated_docs logs

# Copy frontend build
COPY --from=frontend-builder /frontend/dist/frontend/browser /var/www/html

# ============================================
# NGINX CONFIGURATION
# ============================================
RUN echo 'server { \
    listen 80; \
    server_name _; \
    root /var/www/html; \
    index index.html; \
    \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    \
    location /api/ { \
        proxy_pass http://127.0.0.1:8000; \
        proxy_http_version 1.1; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
        proxy_set_header X-Forwarded-Proto $scheme; \
    } \
    \
    location /docs { \
        proxy_pass http://127.0.0.1:8000/docs; \
        proxy_set_header Host $host; \
    } \
    \
    location /openapi.json { \
        proxy_pass http://127.0.0.1:8000/openapi.json; \
        proxy_set_header Host $host; \
    } \
}' > /etc/nginx/sites-available/default

RUN rm -f /etc/nginx/sites-enabled/default && \
    ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/ && \
    rm -f /etc/nginx/conf.d/default.conf && \
    nginx -t

# ============================================
# SUPERVISOR CONFIGURATION
# ============================================
RUN echo '[supervisord]\nnodaemon=true\nlogfile=/app/logs/supervisord.log\npidfile=/tmp/supervisord.pid\n\
[program:backend]\ncommand=uvicorn app.main:app --host 0.0.0.0 --port 8000\ndirectory=/app\nautorestart=true\nstdout_logfile=/app/logs/backend.log\nstderr_logfile=/app/logs/backend.err\n\
[program:nginx]\ncommand=nginx -g "daemon off;"\nautorestart=true\nstdout_logfile=/app/logs/nginx.log\nstderr_logfile=/app/logs/nginx.err' \
> /etc/supervisor/conf.d/app.conf

# ============================================
# ENTRYPOINT SCRIPT
# ============================================
RUN echo '#!/bin/bash\n\
echo "========================================="\n\
echo "🚀 Starting Document Automation System"  \n\
echo "========================================="\n\
\n\
# Wait for PostgreSQL if using\n\
if [ ! -z "$DATABASE_URL" ]; then\n\
  echo "⏳ Waiting for database..."\n\
  while ! nc -z postgres 5432 2>/dev/null; do\n\
    sleep 0.5\n\
  done\n\
  echo "✅ Database is ready!"\n\
fi\n\
\n\
# Initialize database\n\
echo "📦 Initializing database..."\n\
python -c "from app.database import init_db; init_db(); print('\''✅ Database initialized!'\'')" 2>/dev/null || echo "⚠️ Database init skipped (no database module)"\n\
\n\
# Start supervisor\n\
echo "🎯 Starting services..."\n\
supervisord -n -c /etc/supervisor/supervisord.conf' > /entrypoint.sh

RUN chmod +x /entrypoint.sh

EXPOSE 80 8000

ENTRYPOINT ["/entrypoint.sh"]