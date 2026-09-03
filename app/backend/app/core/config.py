import logging
from dotenv import load_dotenv
import os
from pathlib import Path

# Search for .env from repo root
repo_root = Path(__file__).resolve().parent.parent.parent.parent.parent
load_dotenv(repo_root / ".env", override=False)

class Config:
    DATABASE_URL = os.getenv('DATABASE_URL')
    DB_ECHO = os.getenv('DB_ECHO', 'false').lower() == 'true'
    DB_POOL_SIZE = int(os.getenv('DB_POOL_SIZE', '10'))
    DB_MAX_OVERFLOW = int(os.getenv('DB_MAX_OVERFLOW', '20'))
    DB_POOL_RECYCLE = int(os.getenv('DB_POOL_RECYCLE', '3600'))
    SUPABASE_JWT_SECRET = os.getenv('SUPABASE_JWT_SECRET', '')
