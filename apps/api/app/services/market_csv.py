"""Validated, idempotent CSV import of official market prices (shared by the UI and n8n)."""
import csv
import io
from datetime import date

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.models import MarketPrice

MAX_BYTES = 5 * 1024 * 1024
REQUIRED_COLS = {"commodity", "market", "price_date", "price_lkr_per_kg", "source"}


class CsvError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status, self.code = status, code


def import_csv(db: Session, filename: str, raw: bytes, imported_by=None) -> dict:
    if not filename.lower().endswith(".csv"):
        raise CsvError(415, "unsupported_file", "Upload a .csv file")
    if len(raw) > MAX_BYTES:
        raise CsvError(413, "file_too_large", "CSV must be ≤ 5 MB")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise CsvError(422, "bad_encoding", "CSV must be UTF-8")
    reader = csv.DictReader(io.StringIO(text))
    cols = {c.strip() for c in (reader.fieldnames or [])}
    if not REQUIRED_COLS <= cols:
        raise CsvError(422, "missing_columns", f"Required columns: {sorted(REQUIRED_COLS)}; optional: district, price_type")
    good, errors = [], []
    for i, row in enumerate(reader, start=2):
        try:
            price = float(row["price_lkr_per_kg"])
            if not (0 < price < 100000):
                raise ValueError("price out of range")
            good.append({"commodity": row["commodity"].strip().lower().replace(" ", "_")[:60], "market": row["market"].strip()[:100],
                         "district": (row.get("district") or "").strip()[:60] or None,
                         "price_date": date.fromisoformat(row["price_date"].strip()),
                         "price_type": (row.get("price_type") or "wholesale").strip()[:20],
                         "price_lkr_per_kg": price, "source": row["source"].strip()[:200], "imported_by": imported_by})
        except (ValueError, KeyError, AttributeError) as e:
            errors.append({"line": i, "error": str(e)[:200]})
        if len(errors) > 200:
            break
    if good:
        stmt = pg_insert(MarketPrice).values(good)
        stmt = stmt.on_conflict_do_update(index_elements=["commodity", "market", "price_date", "price_type", "source"],
                                          set_={"price_lkr_per_kg": stmt.excluded.price_lkr_per_kg, "district": stmt.excluded.district})
        db.execute(stmt)
    return {"upserted": len(good), "errors": errors[:200]}
