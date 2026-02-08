# ClearHealth MVP Doppler + CI/CD + Zero-Downtime Deployment

## 1) Doppler project/configs

Create these Doppler configs in project `clearhealth-mvp`:

- `stg`
- `prd`

At minimum, set secrets from `.env.example`:

- `AI_INTEGRATIONS_OPENAI_BASE_URL`
- `AI_INTEGRATIONS_OPENAI_API_KEY`
- `GOOGLE_GENERATIVE_AI_BASE_URL`
- `GOOGLE_GENERATIVE_AI_API_KEY`
- `GEMINI_MODEL`
- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `CORS_ORIGIN`
- `SMART_SANDBOX_FHIR_BASE_URL`
- `PORT` (optional; deploy scripts force PORT during runtime)

## 2) GitHub repository secrets

Required:

- `SSH_HOST`
- `SSH_PRIVATE_KEY`
- `SSH_USER`
- `WORK_DIR`
- `DOPPLER_TOKEN`

Optional:

- `DOPPLER_PROJECT` (default: `clearhealth-mvp`)
- `DOPPLER_CONFIG_STAGING` (default: `stg`)
- `DOPPLER_CONFIG_PROD` (default: `prd`)
- `STAGING_HEALTH_URL` (for workflow verification)
- `PROD_HEALTH_URL` (for workflow verification)
- `SUDO_PASSWORD` (only if your SSH user requires sudo password for Caddyfile update)
- `STAGING_SERVER_DOMAIN`, `PROD_SERVER_DOMAIN`
- `STAGING_PORT_A`, `STAGING_PORT_B`, `PROD_PORT_A`, `PROD_PORT_B`
- `STAGING_DEPLOY_STACK_NAME`, `PROD_DEPLOY_STACK_NAME`
- `STAGING_NETWORK_NAME`, `PROD_NETWORK_NAME`
- `STAGING_REDIS_VOLUME_NAME`, `PROD_REDIS_VOLUME_NAME`

## 3) Branch-to-environment mapping

- `staging` -> `.github/workflows/deploy-staging.yml`
- `prod` -> `.github/workflows/deploy-prod.yml`
- `main`/PRs -> `.github/workflows/ci.yml`

## 4) Server prerequisites

Install on the server:

- Docker + Docker Compose plugin
- Caddy (with admin API enabled)
- Git

Clone this repo at `WORK_DIR` and ensure workflow SSH user can run:

- `docker`
- `sudo cp` to `/etc/caddy/Caddyfile`
- `/usr/bin/caddy reload`

## 5) Caddy reverse-proxy blocks

Deployment scripts detect active ports from Caddy and switch between two ports.

Staging defaults:

- Domain: `staging.linux.achievengine.com`
- Ports: `5602 <-> 5603`

Production defaults:

- Domain: `linux.achievengine.com`
- Ports: `5600 <-> 5601`

Example block:

```caddy
linux.achievengine.com {
  reverse_proxy localhost:5600
}
```

Override defaults via environment variables before running deploy scripts:

- `SERVER_DOMAIN`
- `PORT_A`
- `PORT_B`
- `DEPLOY_STACK_NAME`
- `NETWORK_NAME`
- `REDIS_VOLUME_NAME`
- `DOPPLER_PROJECT`
- `DOPPLER_CONFIG`

## 6) Local commands

Development with Doppler:

```bash
npm run dev
```

Local fallback without Doppler:

```bash
npm run dev:local
```

Manual deployment:

```bash
npm run deploy:staging
npm run deploy:prod
```
