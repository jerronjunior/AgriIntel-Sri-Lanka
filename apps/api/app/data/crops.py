"""Indicative crop requirement parameters for the rules-based suitability model.

IMPORTANT — these are *indicative, configurable defaults* assembled from general agronomic
ranges of the kind published in FAO ECOCROP / FAO Irrigation & Drainage Paper 33 & 56.
They have NOT been calibrated for Sri Lankan varieties or agro-ecological zones. Before
operational use they must be reviewed against Department of Agriculture Sri Lanka
recommendations and edited via the admin API (`crop_requirements.reviewed = true`).

Fields
  temp_opt / temp_abs   : seasonal mean air temperature, °C (optimal / absolute limits)
  water_mm              : seasonal crop water requirement, mm  (min, max) of optimal band
  water_abs_min_mm      : below this, crop failure is likely without irrigation
  waterlog_tolerant     : tolerance of excess water / flooding
  elev_max_m            : practical upper elevation for the crop
  duration_days         : typical field duration
  ky                    : FAO-33 yield response factor; `ky_source` says whether it is FAO-33 or a default
"""

CROPS: dict[str, dict] = {
    "paddy": {"name": "Paddy (rice)", "local_name": "Vee", "category": "cereal",
              "temp_opt": [22, 32], "temp_abs": [16, 38], "water_mm": [900, 1500], "water_abs_min_mm": 600,
              "waterlog_tolerant": True, "elev_max_m": 1500, "duration_days": [105, 120],
              "ky": 1.0, "ky_source": "default (not tabulated in FAO-33) — calibrate"},
    "maize": {"name": "Maize", "local_name": "Iringu", "category": "cereal",
              "temp_opt": [18, 32], "temp_abs": [10, 40], "water_mm": [500, 800], "water_abs_min_mm": 350,
              "waterlog_tolerant": False, "elev_max_m": 1800, "duration_days": [100, 120],
              "ky": 1.25, "ky_source": "FAO-33 (total growing period)"},
    "green_gram": {"name": "Green gram", "local_name": "Mung", "category": "pulse",
                   "temp_opt": [25, 35], "temp_abs": [15, 40], "water_mm": [300, 450], "water_abs_min_mm": 200,
                   "waterlog_tolerant": False, "elev_max_m": 1000, "duration_days": [60, 75],
                   "ky": 1.0, "ky_source": "default (not tabulated in FAO-33) — calibrate"},
    "groundnut": {"name": "Groundnut", "local_name": "Rata kaju", "category": "oilseed",
                  "temp_opt": [22, 30], "temp_abs": [15, 38], "water_mm": [450, 700], "water_abs_min_mm": 300,
                  "waterlog_tolerant": False, "elev_max_m": 1200, "duration_days": [100, 120],
                  "ky": 0.70, "ky_source": "FAO-33 (total growing period)"},
    "sesame": {"name": "Sesame", "local_name": "Thala", "category": "oilseed",
               "temp_opt": [25, 32], "temp_abs": [18, 40], "water_mm": [300, 500], "water_abs_min_mm": 200,
               "waterlog_tolerant": False, "elev_max_m": 1000, "duration_days": [85, 100],
               "ky": 1.0, "ky_source": "default (not tabulated in FAO-33) — calibrate"},
    "chili": {"name": "Chili", "local_name": "Miris", "category": "vegetable/condiment",
              "temp_opt": [20, 30], "temp_abs": [15, 35], "water_mm": [500, 800], "water_abs_min_mm": 350,
              "waterlog_tolerant": False, "elev_max_m": 1500, "duration_days": [120, 150],
              "ky": 1.1, "ky_source": "FAO-33 (pepper, total growing period)"},
    "onion": {"name": "Big onion", "local_name": "Lunu", "category": "vegetable",
              "temp_opt": [18, 28], "temp_abs": [10, 35], "water_mm": [350, 550], "water_abs_min_mm": 250,
              "waterlog_tolerant": False, "elev_max_m": 1500, "duration_days": [100, 120],
              "ky": 1.1, "ky_source": "FAO-33 (onion, total growing period)"},
    "cowpea": {"name": "Cowpea", "local_name": "Cowpea / Li me", "category": "pulse",
               "temp_opt": [25, 35], "temp_abs": [15, 40], "water_mm": [300, 500], "water_abs_min_mm": 200,
               "waterlog_tolerant": False, "elev_max_m": 1200, "duration_days": [70, 90],
               "ky": 1.0, "ky_source": "default (not tabulated in FAO-33) — calibrate"},
}

SOURCE_NOTE = (
    "Indicative defaults from general agronomic ranges (FAO ECOCROP-style; Ky from FAO Irrigation & "
    "Drainage Paper 33 where tabulated). Not calibrated for Sri Lankan varieties — review before operational use."
)

# Sri Lanka's two cultivation seasons. Months are 1-12.
SEASONS = {
    "maha": {"name": "Maha", "months": [10, 11, 12, 1, 2], "note": "North-east monsoon season, approx. Sep/Oct – Feb/Mar"},
    "yala": {"name": "Yala", "months": [4, 5, 6, 7, 8], "note": "South-west monsoon season, approx. Apr/May – Aug/Sep"},
}
