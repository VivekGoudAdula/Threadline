# Threadline backend — Phase 1

Run from this directory:

```powershell
pip install -r requirements.txt
uvicorn main:app --reload
```

Then use:

- `GET /health`
- `GET /customers`
- `GET /timeline/cust_priya_sharma_001`

Interactive API docs are available at `/docs`.

Run the detector accuracy check with `pytest -s`.
