import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import shap
import pickle
import os

print("Generating synthetic transaction data...")
np.random.seed(42)
n_samples = 10000

# Normal transactions
amount_normal = np.random.lognormal(mean=3, sigma=1, size=int(n_samples * 0.95))
hour_normal = np.random.randint(6, 23, size=int(n_samples * 0.95)) # Daytime
freq_normal = np.random.poisson(lam=2, size=int(n_samples * 0.95))
is_fraud_normal = np.zeros(int(n_samples * 0.95))

# Fraudulent transactions
amount_fraud = np.random.lognormal(mean=6, sigma=1.5, size=int(n_samples * 0.05))
hour_fraud = np.random.randint(0, 6, size=int(n_samples * 0.05)) # Deeper night
freq_fraud = np.random.poisson(lam=10, size=int(n_samples * 0.05)) # High frequency
is_fraud_fraud = np.ones(int(n_samples * 0.05))

amount = np.concatenate([amount_normal, amount_fraud])
hour = np.concatenate([hour_normal, hour_fraud])
freq = np.concatenate([freq_normal, freq_fraud])
is_fraud = np.concatenate([is_fraud_normal, is_fraud_fraud])

df = pd.DataFrame({
    'amount': amount,
    'hour': hour,
    'freq': freq,
    'is_fraud': is_fraud
})

X = df[['amount', 'hour', 'freq']]
y = df['is_fraud']

print("Scaling data...")
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

print("Training Isolation Forest (Anomaly Detection)...")
# Isolation forest
iso = IsolationForest(contamination=0.05, random_state=42)
iso.fit(X_scaled)
iso_scores = iso.decision_function(X_scaled) # anomaly score

# We can append iso_scores as a feature for XGBoost
X_hybrid = np.column_stack((X_scaled, iso_scores))

X_train, X_test, y_train, y_test = train_test_split(X_hybrid, y, test_size=0.2, random_state=42)

print("Training XGBoost Classifier...")
xgb_model = xgb.XGBClassifier(n_estimators=100, max_depth=4, random_state=42, use_label_encoder=False, eval_metric='logloss')
xgb_model.fit(X_train, y_train)

print("Creating SHAP explainer...")
explainer = shap.TreeExplainer(xgb_model)

bundle = {
    "scaler": scaler,
    "iso_model": iso,
    "xgb_model": xgb_model,
    "explainer": explainer
}

model_path = os.path.join(os.path.dirname(__file__), "model.pkl")
with open(model_path, "wb") as f:
    pickle.dump(bundle, f)

print(f"Hybrid model saved successfully to {model_path}.")
