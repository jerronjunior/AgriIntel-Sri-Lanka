# Deployment

## Database
Azure Database for PostgreSQL Flexible Server (enable the `POSTGIS` extension in server parameters) or Supabase.
Run migrations as the owner role from CI or a one-off container job:
`MIGRATION_DATABASE_URL=... APP_DB_PASSWORD=<strong> alembic upgrade head && python -m app.seed --superadmin <email> <password>`.

## API — Azure Container Apps
```bash
az acr build -r <registry> -t agriintel-api:$(git rev-parse --short HEAD) -f infrastructure/docker/api.Dockerfile .
az containerapp create -n agriintel-api -g <rg> --environment <env> --image <registry>.azurecr.io/agriintel-api:<tag> \
  --target-port 8000 --ingress external --min-replicas 1 \
  --secrets jwt=<JWT_SECRET> db=<DATABASE_URL> autokey=<AUTOMATION_API_KEY> earthdata=<EARTHDATA_TOKEN> \
  --env-vars ENV=production JWT_SECRET=secretref:jwt DATABASE_URL=secretref:db AUTOMATION_API_KEY=secretref:autokey \
             EARTHDATA_TOKEN=secretref:earthdata REDIS_URL=<azure-cache-url> CORS_ORIGINS=https://<web-domain> FRONTEND_URL=https://<web-domain>
```
Add a second container app from the same image with command `celery -A app.worker worker -l info` if using Celery.
Health probe: `GET /api/v1/health`.

## Web — Vercel
Root directory `apps/web`, build command `npm run build`, env `NEXT_PUBLIC_API_URL=https://<api-domain>/api/v1`.

## Object storage
Processed rasters/tiles (future) go to Azure Blob Storage with private containers and SAS URLs issued by the API.
