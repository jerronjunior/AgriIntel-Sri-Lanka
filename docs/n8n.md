# n8n automation

1. `docker compose up n8n` and open http://localhost:5678.
2. Create credentials:
   * **Header Auth** named `AgriIntel automation key (X-Automation-Key)`: name `X-Automation-Key`, value = `AUTOMATION_API_KEY`.
   * **SMTP** named `AgriIntel SMTP`.
3. Import every file in `automation/n8n-workflows/` (Workflows → Import from file), re-select the credentials on
   each HTTP/Email node, then set workflow 08 as the error workflow in each workflow's settings and activate them.

| # | Workflow | Schedule (Asia/Colombo) | Calls |
|---|---|---|---|
| 01 | Daily NASA POWER sync | 06:17 daily | `sync_power_daily` |
| 02 | GPM IMERG rainfall refresh | 07:43 daily | `discover_granules` (gpm) |
| 03 | SMAP soil moisture processing | 08:11 daily | `discover_granules` (smap) |
| 04 | Market price import | Mon 10:37 | downloads `AGRIINTEL_MARKET_CSV_URL` → `/automation/market-import` |
| 05 | Risk alerts | 09:29 daily | `risk_alerts` |
| 06 | Weekly intelligence report | Mon 08:07 | `weekly_report` |
| 07 | Email notifications | every 30 min | `email_notifications` |
| 08 | Failure alerts | on error | emails `AGRIINTEL_ALERT_TO` |

Idempotency: daily/weekly jobs send an `idempotency_key`; repeated calls return the existing job. Failed jobs can be
retried with the same key. Regenerate the JSON with `python automation/generate_workflows.py`.
Use either n8n **or** the Celery beat profile for scheduling, not both.
