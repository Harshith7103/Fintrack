"""
Fraud Detection ML Model (Phase 2)
Uses Isolation Forest from scikit-learn.
Run: python fraud_model.py  → trains and saves model.pkl
"""
import pickle
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

# ── Training data (synthetic – replace with real data from MySQL export) ──────
# Features: [amount, hour_of_day, transactions_last_hour]
NORMAL_TRANSACTIONS = [
    [500, 10, 1], [1200, 14, 2], [800, 9, 1], [2000, 11, 1],
    [350, 16, 2], [1500, 13, 1], [600, 18, 3], [900, 12, 2],
    [1100, 15, 1], [750, 10, 2], [3000, 11, 1], [2500, 14, 2],
    [400, 9, 1],  [1800, 16, 1], [650, 13, 2], [1000, 10, 1],
    [5000, 11, 1], [4500, 14, 1], [3500, 12, 2], [2800, 15, 1],
    [700, 17, 2], [1300, 10, 1], [950, 13, 1], [1600, 11, 2],
    [2200, 14, 1], [1400, 16, 1], [850, 9, 2], [1700, 12, 1],
]

SUSPICIOUS_TRANSACTIONS = [
    [55000, 2, 1], [75000, 3, 1], [100000, 1, 1], [60000, 23, 1],
    [500, 2, 8], [300, 3, 10], [200, 1, 12], [400, 23, 7],
    [80000, 14, 1], [90000, 11, 1],
]

X_normal = np.array(NORMAL_TRANSACTIONS)
X_fraud  = np.array(SUSPICIOUS_TRANSACTIONS)
X_train  = np.vstack([X_normal, X_fraud])

scaler = StandardScaler()
X_scaled = scaler.fit_transform(X_train)

model = IsolationForest(
    n_estimators=100,
    contamination=0.15,  # ~15% anomalies expected
    random_state=42
)
model.fit(X_scaled)

# Save model + scaler
with open('model.pkl', 'wb') as f:
    pickle.dump({'model': model, 'scaler': scaler}, f)

print("✅ Model trained and saved to model.pkl")

# Quick test
test_cases = [
    ([1000, 14, 1], "Normal purchase"),
    ([75000, 2, 1], "Large midnight transaction"),
    ([500, 3, 9],   "High frequency midnight"),
]
for features, label in test_cases:
    x = scaler.transform([features])
    pred = model.predict(x)[0]
    score = model.score_samples(x)[0]
    status = "Fraud/Suspicious" if pred == -1 else "Safe"
    print(f"  {label}: {status} (score={score:.3f})")
