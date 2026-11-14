"""PDF rendering for Decision Simulator reports (ReportLab)."""
from datetime import UTC, datetime
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

NAVY = colors.HexColor("#061421")
EMERALD = colors.HexColor("#10B981")


def _fmt(v, nd=0):
    if v is None:
        return "—"
    return f"{v:,.{nd}f}"


def simulation_pdf(name: str, org_name: str, inputs: dict, result: dict) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm, topMargin=16 * mm, bottomMargin=16 * mm,
                            title=f"AgriIntel — {name}")
    ss = getSampleStyleSheet()
    h1, h2, body, small = ss["Title"], ss["Heading2"], ss["BodyText"], ss["BodyText"].clone("small", fontSize=8, leading=10, textColor=colors.HexColor("#475569"))
    story = [
        Paragraph("AgriIntel Sri Lanka — Decision Simulator Report", h1),
        Paragraph(f"<b>{name}</b> · {org_name} · generated {datetime.now(UTC):%Y-%m-%d %H:%M} UTC", body),
        Paragraph("<font color='#B45309'><b>HYPOTHETICAL SCENARIO</b></font> — " + result["disclaimer"], small),
        Spacer(1, 6 * mm),
        Paragraph("Scenario inputs", h2),
    ]
    b, s = result["climate"]["baseline"], result["climate"]["scenario"]
    t = Table([
        ["District", inputs["district"], "Season", inputs["season"].title()],
        ["Area (ha)", _fmt(inputs["area_ha"], 2), "Irrigation", inputs["irrigation"]],
        ["Rainfall change", f"{inputs['rain_change_pct']:+.0f}%", "Temperature change", f"{inputs['temp_change_c']:+.1f} °C"],
        ["Baseline rainfall (mm)", _fmt(b["rainfall_mm"]), "Scenario rainfall (mm)", _fmt(s["rainfall_mm"])],
        ["Baseline mean temp (°C)", _fmt(b["mean_temp_c"], 1), "Scenario mean temp (°C)", _fmt(s["mean_temp_c"], 1)],
        ["Climate baseline source", b.get("source", ""), "", ""],
    ], colWidths=[40 * mm, 45 * mm, 45 * mm, 45 * mm])
    t.setStyle(TableStyle([("FONTSIZE", (0, 0), (-1, -1), 8), ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#CBD5E1")),
                           ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F1F5F9")), ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F1F5F9")),
                           ("SPAN", (1, 5), (3, 5))]))
    story += [t, Spacer(1, 6 * mm), Paragraph("Results (ranked by net profit)", h2)]
    rows = [["#", "Crop", "Suitability", "Exp. yield t/ha", "Water deficit m³", "Revenue LKR", "Cost LKR", "Net profit LKR", "ROI %", "Risk"]]
    for r in result["results"]:
        e = r["economics"]
        rows.append([r["profit_rank"], r["name"], f"{r['suitability_scenario']:.0f} ({r['suitability_class']})",
                     _fmt(r["yield"]["expected_t_per_ha"], 2), _fmt(r["water"]["deficit_m3"]), _fmt(e["revenue_lkr"]),
                     _fmt(e["total_cost_lkr"]), _fmt(e["net_profit_lkr"]), _fmt(e["roi_pct"], 1),
                     (r["risk"]["overall"].get("level") or "—")])
    rt = Table(rows, repeatRows=1)
    rt.setStyle(TableStyle([("FONTSIZE", (0, 0), (-1, -1), 7), ("BACKGROUND", (0, 0), (-1, 0), NAVY), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#CBD5E1")), ("ALIGN", (3, 1), (-2, -1), "RIGHT")]))
    story += [rt, Spacer(1, 5 * mm), Paragraph("Key constraints", h2)]
    for r in result["results"]:
        story.append(Paragraph(f"<b>{r['name']}</b>: " + ("; ".join(r["constraints"]) or "No major constraints flagged."), body))
    story += [Spacer(1, 5 * mm), Paragraph("Assumptions", h2)]
    for k, v in result["assumptions"].items():
        story.append(Paragraph(f"<b>{k.replace('_', ' ')}</b>: {v}", small))
    story += [Spacer(1, 4 * mm), Paragraph(
        "Climate baseline data: NASA Langley Research Center POWER Project (when source is NASA POWER). "
        "Risk indicators are decision-support estimates, not underwriting or credit decisions.", small)]
    doc.build(story)
    return buf.getvalue()
