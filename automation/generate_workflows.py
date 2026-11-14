"""Generates the importable n8n workflow JSON files in ./n8n-workflows.

Run:  python automation/generate_workflows.py
All workflows call the AgriIntel API server-to-server with the X-Automation-Key header, stored as an
n8n "Header Auth" credential — the key never reaches the browser or the React app.
"""
import json
import uuid
from pathlib import Path

OUT = Path(__file__).parent / "n8n-workflows"
CRED_KEY = {"httpHeaderAuth": {"id": "agriintel-automation-key", "name": "AgriIntel automation key (X-Automation-Key)"}}
CRED_SMTP = {"smtp": {"id": "agriintel-smtp", "name": "AgriIntel SMTP"}}
DAY = "{{ $now.setZone('Asia/Colombo').toFormat('yyyy-LL-dd') }}"
WEEK = "{{ $now.setZone('Asia/Colombo').toFormat('kkkk-WW') }}"


def sched(cron):
    return {"parameters": {"rule": {"interval": [{"field": "cronExpression", "expression": cron}]}}, "name": "Schedule",
            "type": "n8n-nodes-base.scheduleTrigger", "typeVersion": 1.2, "position": [0, 0]}


def run_job(kind, params, idem):
    body = {"kind": kind, "params": params, "idempotency_key": idem, "wait": True}
    return {"parameters": {"method": "POST", "url": "={{ $env.AGRIINTEL_API_URL }}/automation/run",
                           "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth",
                           "sendBody": True, "specifyBody": "json", "jsonBody": "=" + json.dumps(body),
                           "options": {"timeout": 600000, "response": {"response": {"neverError": True}}}},
            "name": "Run AgriIntel job", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [260, 0],
            "retryOnFail": True, "maxTries": 3, "waitBetweenTries": 30000, "credentials": CRED_KEY}


def if_node(name, conditions, combinator="or", x=520):
    return {"parameters": {"conditions": {"options": {"caseSensitive": True, "typeValidation": "loose"}, "combinator": combinator,
                                          "conditions": conditions}},
            "name": name, "type": "n8n-nodes-base.if", "typeVersion": 2, "position": [x, 0]}


def failed_check():
    return if_node("Job failed?", [
        {"leftValue": "={{ $json.status }}", "rightValue": "failed", "operator": {"type": "string", "operation": "equals"}},
        {"leftValue": "={{ $json.error }}", "rightValue": "", "operator": {"type": "string", "operation": "exists"}}])


def mail(subject, x=780):
    return {"parameters": {"fromEmail": "={{ $env.AGRIINTEL_ALERT_FROM }}", "toEmail": "={{ $env.AGRIINTEL_ALERT_TO }}",
                           "subject": subject, "emailFormat": "text", "text": "={{ JSON.stringify($json, null, 2) }}"},
            "name": "Alert platform admin", "type": "n8n-nodes-base.emailSend", "typeVersion": 2.1, "position": [x, -100], "credentials": CRED_SMTP}


def chain(*names, branch_last_true=True):
    c = {}
    for a, b in zip(names, names[1:]):
        c[a] = {"main": [[{"node": b, "type": "main", "index": 0}]]}
    if branch_last_true and len(names) >= 2:
        c[names[-2]]["main"].append([])  # IF node: false branch does nothing
    return c


def workflow(name, nodes, connections, description, error_workflow=True):
    for n in nodes:
        n["id"] = str(uuid.uuid5(uuid.NAMESPACE_URL, name + n["name"]))
    settings = {"executionOrder": "v1", "saveManualExecutions": True}
    if error_workflow:
        settings["errorWorkflow"] = "AgriIntel 08 - Failure alerts"  # re-select after import (n8n stores workflow IDs)
    return {"name": name, "nodes": nodes, "connections": connections, "active": False, "settings": settings,
            "meta": {"description": description}, "tags": [{"name": "agriintel"}]}


def job_flow(name, cron, kind, params, idem, description):
    nodes = [sched(cron), run_job(kind, params, idem), failed_check(), mail(f"[AgriIntel] {kind} failed")]
    return workflow(name, nodes, chain("Schedule", "Run AgriIntel job", "Job failed?", "Alert platform admin"), description)


FLOWS = {
    "01-daily-nasa-power-sync.json": job_flow(
        "AgriIntel 01 - Daily NASA POWER sync", "17 6 * * *", "sync_power_daily", {"days": 10}, f"power-{DAY}",
        "Fetches the last 10 days of NASA POWER daily weather and soil wetness for all 25 districts. Idempotent per day."),
    "02-rainfall-refresh-gpm.json": job_flow(
        "AgriIntel 02 - GPM IMERG rainfall refresh", "43 7 * * *", "discover_granules", {"product": "gpm_imerg_final", "days": 7}, f"gpm-{DAY}",
        "Discovers new GPM IMERG Final daily granules over Sri Lanka via NASA CMR and records them for processing."),
    "03-soil-moisture-smap.json": job_flow(
        "AgriIntel 03 - SMAP soil moisture processing", "11 8 * * *", "discover_granules", {"product": "smap_l3_enhanced", "days": 7}, f"smap-{DAY}",
        "Discovers SMAP L3 enhanced granules via NASA CMR. Raster processing requires EARTHDATA_TOKEN (see docs/nasa-data.md)."),
    "05-risk-alert-generation.json": job_flow(
        "AgriIntel 05 - Agricultural risk alerts", "29 9 * * *", "risk_alerts", {"threshold_pct": -40, "days": 30}, f"risk-{DAY}",
        "Creates deduplicated in-app alerts for orgs with farms in districts whose 30-day rainfall is 40% or more below normal."),
    "06-weekly-intelligence-report.json": job_flow(
        "AgriIntel 06 - Weekly intelligence report", "7 8 * * 1", "weekly_report", {}, f"weekly-{WEEK}",
        "Emails each organization admin a weekly summary. Idempotent per ISO week."),
    "07-organization-email-notifications.json": job_flow(
        "AgriIntel 07 - Organization email notifications", "*/30 * * * *", "email_notifications", {}, None,
        "Emails new alerts to org admins every 30 minutes; each alert is emailed exactly once (notifications.emailed_at)."),
}

_market_nodes = [
    sched("37 10 * * 1"),
    {"parameters": {"url": "={{ $env.AGRIINTEL_MARKET_CSV_URL }}", "options": {"response": {"response": {"responseFormat": "file"}}}},
     "name": "Download official price CSV", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [260, 0], "retryOnFail": True, "maxTries": 3},
    {"parameters": {"method": "POST", "url": "={{ $env.AGRIINTEL_API_URL }}/automation/market-import", "authentication": "genericCredentialType",
                    "genericAuthType": "httpHeaderAuth", "sendBody": True, "contentType": "multipart-form-data",
                    "bodyParameters": {"parameters": [{"parameterType": "formBinaryData", "name": "file", "inputDataFieldName": "data"}]}, "options": {}},
     "name": "Import into AgriIntel", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [520, 0], "retryOnFail": True, "maxTries": 3,
     "credentials": CRED_KEY},
    if_node("Rows rejected?", [{"leftValue": "={{ $json.errors.length }}", "rightValue": 0, "operator": {"type": "number", "operation": "gt"}}], "and", 780),
    mail("[AgriIntel] Market import had rejected rows", 1040),
]
FLOWS["04-market-price-import.json"] = workflow(
    "AgriIntel 04 - Market price import", _market_nodes,
    chain("Schedule", "Download official price CSV", "Import into AgriIntel", "Rows rejected?", "Alert platform admin"),
    "Downloads a CSV you are authorized to use (AGRIINTEL_MARKET_CSV_URL, AgriIntel column format) and upserts it. Re-running is safe.")

_err_nodes = [{"parameters": {}, "name": "On workflow error", "type": "n8n-nodes-base.errorTrigger", "typeVersion": 1, "position": [0, 0]},
              mail("=[AgriIntel] n8n workflow failed: {{ $json.workflow.name }}", 260)]
FLOWS["08-failure-alerts.json"] = workflow(
    "AgriIntel 08 - Failure alerts", _err_nodes, {"On workflow error": {"main": [[{"node": "Alert platform admin", "type": "main", "index": 0}]]}},
    "Error workflow: the other AgriIntel workflows point here, so any failed execution emails the platform admin.", error_workflow=False)

if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    for fname, wf in FLOWS.items():
        (OUT / fname).write_text(json.dumps(wf, indent=2) + "\n")
    print("\n".join(sorted(FLOWS)))
