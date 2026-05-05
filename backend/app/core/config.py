import logging
from dotenv import load_dotenv
import os
from pathlib import Path

# Search for .env starting from backend/ up to repo root
backend_dir = Path(__file__).resolve().parent.parent.parent
load_dotenv(backend_dir / ".env", override=False)
# Also try parent of backend (repo root)
load_dotenv(Path(__file__).resolve().parent.parent.parent.parent / ".env", override=False)

class Config:
    MONGODB_URL = os.getenv('MONGODB_URL')
    logging.info(f"DEBUG: MongoDB URL → {MONGODB_URL}")
    DATABASE_NAME = os.getenv('DATABASE_NAME')
    logging.info(f"DEBUG: MongoDB URL → {DATABASE_NAME}")
    DATABASE_URL = os.getenv('DATABASE_URL')