"""Neusic Agent backend — FastAPI bridge for Hermes, Ollama, and memory.
Run locally:  uvicorn app.main:app --reload --port 8000"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import ALLOWED_ORIGINS
from .routes import health, hermes, memory, providers

app = FastAPI(title="Neusic Agent Backend", version="1.0.0-blite")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "X-Neusic-Key"],
)

app.include_router(health.router)
app.include_router(hermes.router)
app.include_router(memory.router)
app.include_router(providers.router)
