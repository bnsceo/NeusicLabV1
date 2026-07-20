import os
from dotenv import load_dotenv

load_dotenv()

ALLOWED_ORIGINS = [o.strip() for o in os.getenv(
    "NEUSIC_ALLOWED_ORIGINS",
    "https://bnsceo.github.io,http://localhost:8080,http://127.0.0.1:8080",
).split(",") if o.strip()]
HERMES_API_URL = os.getenv("HERMES_API_URL", "").strip()
HERMES_API_KEY = os.getenv("HERMES_API_KEY", "").strip()
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/")
OLLAMA_DEFAULT_MODEL = os.getenv("OLLAMA_DEFAULT_MODEL", "llama3.2")
MEMORY_DB_PATH = os.getenv("MEMORY_DB_PATH", "./neusic_memory.sqlite3")
