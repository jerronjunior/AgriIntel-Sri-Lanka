"""Settings from environment variables or a .env file in the working folder."""
import os
from dataclasses import dataclass
from pathlib import Path


def _load_dotenv(path: Path = Path(".env")) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


@dataclass
class Settings:
    earthdata_username: str
    earthdata_password: str
    earthdata_token: str
    db_path: str
    output_dir: str
    power_url: str
    cmr_url: str
    appeears_url: str
    timeout: float
    retries: int


def settings() -> Settings:
    _load_dotenv()
    e = os.environ.get
    return Settings(
        earthdata_username=e("EARTHDATA_USERNAME", ""), earthdata_password=e("EARTHDATA_PASSWORD", ""),
        earthdata_token=e("EARTHDATA_TOKEN", ""), db_path=e("NASA_KIT_DB", "nasa_kit.sqlite"),
        output_dir=e("NASA_KIT_OUTPUT", "output"),
        power_url=e("NASA_POWER_BASE_URL", "https://power.larc.nasa.gov/api").rstrip("/"),
        cmr_url=e("NASA_CMR_BASE_URL", "https://cmr.earthdata.nasa.gov/search").rstrip("/"),
        appeears_url=e("APPEEARS_BASE_URL", "https://appeears.earthdatacloud.nasa.gov/api").rstrip("/"),
        timeout=float(e("HTTP_TIMEOUT_SECONDS", "60")), retries=int(e("HTTP_MAX_RETRIES", "3")),
    )
