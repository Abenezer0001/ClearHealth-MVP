# Tooling and MCP Setup

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
