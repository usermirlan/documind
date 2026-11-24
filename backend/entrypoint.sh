#!/bin/sh
set -e
echo "Waiting for database..."
until python -c "
import sqlalchemy as sa
from app.config import settings
sa.create_engine(settings.database_url).connect().close()
" 2>/dev/null; do
    sleep 2
done
alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips="*"
