# ClearHealth NaironAI-Aligned Design System

## Objective
Preserve the existing ClearHealth analysis workflow and backend logic, while replacing UI styling and component strategy with a curated design-system approach.

## Applied visual direction
- Dark-first shell with readable high-contrast text.
- Cool cyan primary actions with green accent support.
- Rounded cards, soft blur surfaces, and subtle atmospheric gradients.
- Spacious layout rhythm for long-form claim analysis content.

## Core tokens
Defined in `client/src/index.css`:
- `--background`, `--foreground`, `--card`, `--card-border`
- `--primary`, `--secondary`, `--accent`
- `--muted`, `--destructive`, `--ring`
- `--radius`

## Typography
- Headings: `Sora`
- Body/UI: `Space Grotesk`

## Component sourcing strategy
1. Continue using existing shadcn component primitives.
2. Use Aceternity registry blocks for visually rich sections.
3. Use 21st MCP for rapid component ideation and generation.

## Added routes for design-system workflow
- `/design-system`
- `/components-lab`
- `/motion`
- `/resources`

These are additive and do not modify or remove existing business routes:
- `/`
- `/analysis/:id`
- `/history`
- `/admin`
