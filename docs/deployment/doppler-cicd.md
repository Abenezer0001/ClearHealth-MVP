# ClearHealth MVP Doppler + CI/CD + Zero-Downtime Deployment

## 1) Doppler project/configs

Use Doppler project `trial-atlas` with one deploy config (recommended: `prd`).

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

- `SSH_HOST` (example: `209.46.120.80`)
- `SSH_PRIVATE_KEY`
- `SSH_USER` (example: `administrator`)
- `WORK_DIR` (example: `/home/administrator/Desktop/Project/clearhealth-mvp`)
- `DOPPLER_TOKEN`

Optional:

- `DOPPLER_PROJECT` (default: `trial-atlas`)
- `DOPPLER_CONFIG` (ignored by deploy workflow; deploy is fixed to `prd`)
- `HEALTH_URL` (example: `https://linux.achievengine.com/api/health`)
- `SUDO_PASSWORD` (only if your SSH user requires sudo password for Caddyfile update)
- `SERVER_DOMAIN` (default: `linux.achievengine.com`)
- `PORT_A` / `PORT_B` (defaults: `5600` / `5601`)
- `DEPLOY_STACK_NAME`
- `NETWORK_NAME`
- `REDIS_VOLUME_NAME`

## 3) Branch-to-environment mapping

- `main` -> `.github/workflows/deploy.yml` + `.github/workflows/ci.yml`
- PRs -> `.github/workflows/ci.yml`

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

- Domain: `linux.achievengine.com`
- Ports: `5600 <-> 5601`

Example block:

```caddy
linux.achievengine.com {
  reverse_proxy localhost:5600
}
```

Override defaults via environment variables before running deploy script:

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
npm run deploy
```
