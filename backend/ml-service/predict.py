from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import pickle
import numpy as np
from datetime import datetime
import os

app = FastAPI(title="FinTrack SecureAI Fraud API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")
_bundle = None

def get_model():
    global _bundle
    if _bundle is None:
        if not os.path.exists(MODEL_PATH):
            raise RuntimeError("model.pkl not found. Run train_model.py")
        with open(MODEL_PATH, "rb") as f:
            _bundle = pickle.load(f)
    return _bundle["scaler"], _bundle["iso_model"], _bundle["xgb_model"], _bundle["explainer"]

class PredictRequest(BaseModel):
    amount: float
    timestamp: str
    user_id: int
    device_id: str
    location: str

@app.post("/predict")
def predict_fraud(tx: PredictRequest):
    scaler, iso, xgb_model, explainer = get_model()
    
    hour = 12
    if tx.timestamp:
        try:
            dt = datetime.fromisoformat(tx.timestamp.replace("Z", "+00:00"))
            hour = dt.hour
        except Exception:
            pass
            
    # Assuming standard freq for single request, in real production we would look at database freq.
    freq = 1.0 
    
    features = np.array([[tx.amount, hour, freq]])
    features_scaled = scaler.transform(features)
    
    iso_score = iso.decision_function(features_scaled)
    # The Isolation forest score logic -> append to make X_hybrid
    x_hybrid = np.column_stack((features_scaled, iso_score))
    
    prob = xgb_model.predict_proba(x_hybrid)[0][1] # probability of fraud
    
    # SHAP explanations
    shap_values = explainer.shap_values(x_hybrid)
    # feature names: amount, hour, freq, iso_score
    feature_names = ["amount", "hour", "freq", "anomaly_score"]
    
    # Find top contributing features to the prediction
    shap_contributions = zip(feature_names, shap_values[0])
    reason_parts = []
    for fn, sv in sorted(shap_contributions, key=lambda x: abs(x[1]), reverse=True):
        if abs(sv) > 0.5:
            direction = "High" if sv > 0 else "Low"
            reason_parts.append(f"{direction} risk due to {fn}")
            
    reason = ", ".join(reason_parts) if reason_parts else "Normal transaction behavior"
            
    fraud_score = float(prob)
    if fraud_score > 0.7:
        fraud_label = "FRAUD"
        if not reason_parts: reason = "High anomaly detected"
    elif fraud_score > 0.3:
        fraud_label = "SUSPICIOUS" 
    else:
        fraud_label = "SAFE"
        
    return {
        "fraud_score": round(fraud_score, 4),
        "fraud_label": fraud_label,
        "reason": reason
    }

@app.get("/health")
def health():
    return {"status": "ok"}
