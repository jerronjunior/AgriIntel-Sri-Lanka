"""Pipeline test on SYNTHETIC data (generated here). It checks mechanics only — not real-world accuracy."""
import numpy as np
import pandas as pd

import train_yield


def synthetic(tmp_path):
    rng = np.random.default_rng(0)
    rows = []
    for d in ["Ampara", "Polonnaruwa", "Kurunegala", "Anuradhapura"]:
        base = rng.uniform(3.5, 5)
        for y in range(2005, 2021):
            rain = rng.uniform(400, 1400)
            yld = base + 0.002 * (rain - 900) + 0.02 * (y - 2005) + rng.normal(0, 0.15)
            rows.append({"district": d, "crop": "paddy", "season": "maha", "year": y, "area_ha": 1000,
                         "production_t": yld * 1000, "rain_mm": rain, "tmean_c": rng.uniform(26, 29)})
    p = tmp_path / "synthetic.csv"
    pd.DataFrame(rows).to_csv(p, index=False)
    return p


def test_holdout_years_never_in_training(tmp_path):
    rep = train_yield.main([str(synthetic(tmp_path)), "--out", str(tmp_path / "a"), "--holdout-years", "3"])
    assert rep["test_years"] == [2018, 2019, 2020]
    assert not set(rep["train_years"]) & set(rep["test_years"])
    assert rep["model_metrics"]["n"] == 12
    assert rep["beats_baseline"] is True  # synthetic signal is learnable
