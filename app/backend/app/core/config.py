import logging
from dotenv import load_dotenv
import os
from pathlib import Path

# Search for .env from repo root
repo_root = Path(__file__).resolve().parent.parent.parent.parent.parent
load_dotenv(repo_root / ".env", override=False)

class Config:
    DATABASE_URL = os.getenv('DATABASE_URL')
