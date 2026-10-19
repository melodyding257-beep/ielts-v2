from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Keep the existing local model-profile override behavior.
load_dotenv(dotenv_path=Path(__file__).with_name(".env"), override=True)

ALLOWED_ORIGINS = [origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",") if origin.strip()]
MAX_PAGES = int(os.getenv("MAX_PARSE_PAGES", "10"))
PARSER_VERSION = "6"
PROMPT_VERSION = "7"
DOUBAO_API_KEY = os.getenv("DOUBAO_API_KEY")
DOUBAO_ENDPOINT = os.getenv("DOUBAO_ENDPOINT")
DOUBAO_API_URL = "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
PARSER_PROFILE = os.getenv("PARSER_PROFILE", "doubao").strip().lower() or "doubao"

if MAX_PAGES <= 0:
    raise ValueError("MAX_PARSE_PAGES must be a positive integer")
