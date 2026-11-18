"""Yield model training pipeline with temporal hold-out evaluation.

Input CSV (one row per district × crop × season × year), e.g. from the Department of Census and
Statistics paddy / other field crops statistics joined with NASA POWER seasonal features:

    district,crop,season,year,area_ha,production_t,rain_mm,tmean_c[,tmax_c,soil_root,ndvi_mean]

Procedure
  1. Target = production_t / area_ha (t/ha).
  2. The last --holdout-years years are held out; models never see them during training.
  3. Baseline = mean historical yield for the same district × crop × season (falls back to crop × season).
  4. Candidate = LightGBM (or XGBoost / sklearn HistGradientBoosting if unavailable) on climate features
     + baseline yield + year trend.
  5. Metrics (MAE, RMSE, MAPE, R²) are computed ONLY on the held-out years and written next to the model.
  6. --register writes the model to the `ml_models` table with status "evaluated". A platform admin
     promotes it to "published" only if it beats the baseline.

Usage:  python train_yield.py data.csv --out artifacts/ [--holdout-years 3] [--register]
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

REQUIRED = ["district", "crop", "season", "year", "area_ha", "production_t", "rain_mm", "tmean_c"]
OPTIONAL = ["tmax_c", "soil_root", "ndvi_mean"]


def load(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    missing = [c for c in REQUIRED if c not in df.columns]
    if missing:
        raise SystemExit(f"Missing required columns: {missing}")
    df = df[(df.area_ha > 0) & df.production_t.notna()].copy()
    df["yield_t_ha"] = df.production_t / df.area_ha
    return df


def baseline_table(train: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    fine = train.groupby(["district", "crop", "season"]).yield_t_ha.mean().rename("baseline").reset_index()
    coarse = train.groupby(["crop", "season"]).yield_t_ha.mean().rename("baseline_cs").reset_index()
    return fine, coarse


def add_baseline(df: pd.DataFrame, fine: pd.DataFrame, coarse: pd.DataFrame) -> pd.DataFrame:
    out = df.merge(fine, on=["district", "crop", "season"], how="left").merge(coarse, on=["crop", "season"], how="left")
    out["baseline"] = out.baseline.fillna(out.baseline_cs)
    return out.drop(columns="baseline_cs")


def make_model():
    try:
        import lightgbm as lgb
        return "lightgbm", lgb.LGBMRegressor(n_estimators=400, learning_rate=0.03, num_leaves=15, min_child_samples=10, verbose=-1)
    except ImportError:
        pass
    try:
        import xgboost as xgb
        return "xgboost", xgb.XGBRegressor(n_estimators=400, learning_rate=0.03, max_depth=4)
    except ImportError:
        from sklearn.ensemble import HistGradientBoostingRegressor
        return "sklearn_hgb", HistGradientBoostingRegressor(max_iter=400, learning_rate=0.03)


def metrics(y, p) -> dict:
    y, p = np.asarray(y), np.asarray(p)
    return {"mae": float(mean_absolute_error(y, p)), "rmse": float(np.sqrt(mean_squared_error(y, p))),
            "mape_pct": float(np.mean(np.abs((y - p) / np.clip(y, 1e-6, None))) * 100), "r2": float(r2_score(y, p)), "n": int(len(y))}


def train(df: pd.DataFrame, holdout_years: int) -> dict:
    years = sorted(df.year.unique())
    if len(years) <= holdout_years + 2:
        raise SystemExit(f"Need more than {holdout_years + 2} distinct years of data; got {len(years)}")
    test_years = years[-holdout_years:]
    tr, te = df[~df.year.isin(test_years)], df[df.year.isin(test_years)]
    fine, coarse = baseline_table(tr)
    tr, te = add_baseline(tr, fine, coarse), add_baseline(te, fine, coarse)
    te = te[te.baseline.notna()]
    feats = ["baseline", "year", "rain_mm", "tmean_c"] + [c for c in OPTIONAL if c in df.columns and df[c].notna().any()]
    X_tr = pd.get_dummies(tr[feats + ["crop", "season"]], columns=["crop", "season"], dtype=float)
    X_te = pd.get_dummies(te[feats + ["crop", "season"]], columns=["crop", "season"], dtype=float).reindex(columns=X_tr.columns, fill_value=0)
    name, model = make_model()
    model.fit(X_tr, tr.yield_t_ha)
    pred = model.predict(X_te)
    resid = tr.yield_t_ha - model.predict(X_tr)
    return {"model_name": name, "model": model, "columns": list(X_tr.columns), "features": feats,
            "train_years": [int(y) for y in years if y not in test_years], "test_years": [int(y) for y in test_years],
            "baseline_metrics": metrics(te.yield_t_ha, te.baseline), "model_metrics": metrics(te.yield_t_ha, pred),
            "residual_q": [float(resid.quantile(0.1)), float(resid.quantile(0.9))], "baseline_tables": (fine, coarse)}


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("csv")
    ap.add_argument("--out", default="artifacts")
    ap.add_argument("--holdout-years", type=int, default=3)
    ap.add_argument("--register", action="store_true", help="record in ml_models (needs DATABASE_URL)")
    a = ap.parse_args(argv)
    res = train(load(a.csv), a.holdout_years)
    version = datetime.now(UTC).strftime("%Y%m%d%H%M")
    out = Path(a.out) / f"yield-{version}"
    out.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": res["model"], "columns": res["columns"], "features": res["features"], "baseline_tables": res["baseline_tables"],
                 "residual_q": res["residual_q"]}, out / "model.joblib")
    report = {k: res[k] for k in ("model_name", "features", "train_years", "test_years", "baseline_metrics", "model_metrics")}
    report["beats_baseline"] = res["model_metrics"]["mae"] < res["baseline_metrics"]["mae"]
    (out / "evaluation.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
    if a.register:
        from sqlalchemy import create_engine, text
        eng = create_engine(os.environ["DATABASE_URL"])
        with eng.begin() as c:
            c.execute(text("SELECT set_config('app.bypass_rls','on',false)"))
            c.execute(text("INSERT INTO ml_models (id,name,version,task,status,metrics,training_data,artifact_uri,created_at) "
                           "VALUES (gen_random_uuid(),:n,:v,'yield','evaluated',CAST(:m AS jsonb),CAST(:t AS jsonb),:u,now())"),
                      {"n": f"yield-{res['model_name']}", "v": version, "m": json.dumps({"holdout": res["model_metrics"], "baseline": res["baseline_metrics"]}),
                       "t": json.dumps({"source": a.csv, "train_years": res["train_years"], "test_years": res["test_years"]}), "u": str(out)})
    return report


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
