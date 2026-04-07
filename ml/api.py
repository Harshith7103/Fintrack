"""
Fraud Detection FastAPI (Phase 2)
Run: uvicorn api:app --host 0.0.0.0 --port 8000 --reload

Endpoint: POST /predict-fraud
Body: { "amount": float, "user_id": int, "transaction_datetime": str (optional) }
Response: { "prediction": "Safe"|"Suspicious"|"Fraud", "score": float, "confidence": float }
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import pickle
import numpy as np
from datetime import datetime
import os

app = FastAPI(title="FinTrack Fraud Detection API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model
MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")
_bundle = None

def get_model():
    global _bundle
    if _bundle is None:
        if not os.path.exists(MODEL_PATH):
            raise RuntimeError("model.pkl not found. Run: python fraud_model.py")
        with open(MODEL_PATH, "rb") as f:
            _bundle = pickle.load(f)
    return _bundle["model"], _bundle["scaler"]


class TransactionInput(BaseModel):
    amount: float
    user_id: Optional[int] = None
    transaction_datetime: Optional[str] = None
    # Optional extra features
    transactions_last_hour: Optional[int] = 1


@app.get("/")
def root():
    return {"status": "FinTrack ML API running", "endpoint": "POST /predict-fraud"}


@app.post("/predict-fraud")
def predict_fraud(tx: TransactionInput):
    model, scaler = get_model()

    # Extract hour from datetime
    hour = 12  # default
    if tx.transaction_datetime:
        try:
            dt = datetime.fromisoformat(tx.transaction_datetime.replace("Z", "+00:00"))
            hour = dt.hour
        except Exception:
            pass

    features = np.array([[tx.amount, hour, tx.transactions_last_hour or 1]])
    features_scaled = scaler.transform(features)

    raw_pred = model.predict(features_scaled)[0]       # 1 = normal, -1 = anomaly
    raw_score = model.score_samples(features_scaled)[0]  # more negative = more anomalous

    # Map to risk score 0-100 (higher = more risky)
    # score_samples typically ranges from -0.7 to 0.1
    normalized = max(0.0, min(1.0, (-raw_score + 0.1) / 0.8))
    risk_score = int(normalized * 100)

    # Determine prediction label
    if raw_pred == -1:
        if risk_score >= 70:
            prediction = "Fraud"
        else:
            prediction = "Suspicious"
    else:
        prediction = "Safe"

    return {
        "prediction": prediction,
        "score": risk_score,
        "confidence": round(normalized, 3),
        "raw_isolation_score": round(float(raw_score), 4)
    }


@app.get("/health")
def health():
    try:
        get_model()
        return {"status": "healthy", "model_loaded": True}
    except Exception as e:
        return {"status": "degraded", "error": str(e)}
