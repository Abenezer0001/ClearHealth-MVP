# Tooling and MCP Setup

## Turborepo workspace setup
- Root scripts now run with Turborepo (`npm run dev` -> `turbo dev`).
- Workspace packages:
  - `apps/web` runs Vite on `http://localhost:3001`
  - `apps/server` runs API server on `http://localhost:5000`
- In development, server supports API-only mode via:
  - `DISABLE_VITE_MIDDLEWARE=true`
- Vite proxies `/api` to `http://localhost:5000`.

## Dependencies added
```bash
npm install motion @fontsource/sora @fontsource/space-grotesk
```

## Aceternity registry setup
`components.json` now includes:

```json
"registries": {
  "@aceternity": "https://ui.aceternity.com/registry/{name}.json"
}
```

Installed component:

```bash
npx shadcn@latest add @aceternity/background-beams
```

Final component location used by app:
- `client/src/components/ui/background-beams.tsx`

## Global Codex MCP servers used
Configured in `~/.codex/config.toml`:

```toml
[mcp_servers.twentyfirst]
command = "/usr/bin/npx"
args = ["-y", "@21st-dev/magic@latest"]
env_vars = ["TWENTYFIRST_API_KEY"]
startup_timeout_sec = 30.0

[mcp_servers.shadcn]
command = "/usr/bin/npx"
args = ["-y", "shadcn@latest", "mcp"]
startup_timeout_sec = 30.0
```

Restart Codex to load MCP changes.
