"""
main.py — Root compatibility shim re-exporting app.main:app.
Recommended: Run with `python run.py` or `uvicorn app.main:app --reload`
"""
from app.main import app  # noqa: F401
