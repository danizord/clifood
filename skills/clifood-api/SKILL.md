---
name: clifood-api
description: API-first iFood automation for the clifood project. Use when an AI agent needs to find restaurants/items, build carts, prep orders, or extend iFood API integrations in this repo.
---

# Clifood Agent Skill

## Purpose

This skill is for AI agents that want to order food on iFood via the CLI: search restaurants, search items, build carts, and prepare checkout. It uses the authenticated browser session to call iFood APIs directly (no UI scraping).

## Quick start (agent usage)

1. Ensure a logged-in browser session with a delivery address.
2. Run CLI commands from repo root.

Examples:

```bash
bun src/cli.ts restaurants --top --exclude-defaults --limit 10
bun src/cli.ts items --restaurant "Restaurante X" --query "temaki"
bun src/cli.ts order --restaurant "Restaurante X" --item "Temaki de salmão:2"
```

## Core workflow (agent-friendly)

1. **Open session + auth**
   - The CLI opens a Playwright browser context and reads Redux state (account + address).
   - `getApiContext(page)` captures required headers from live API calls.

2. **Find restaurants / items**
   - Restaurants: `restaurants` command (search or `--top` discovery feed).
   - Items: `items` command (reads merchant catalog).

3. **Build cart + prep order**
   - `order` command resolves items with `buildCartItems` and creates a cart via API.
   - It opens cart + checkout for review.

4. **Checkout safety**
   - The CLI does **not** submit orders unless `--confirm` is provided.
   - Agents should stop at checkout unless explicitly asked to place the order.

## Tracking orders

Order tracking is not implemented yet. If you need it:
- Add an API call in `src/ifood/api.ts`.
- Update the CLI with a `track` command.
- Document the endpoint in `references/api.md`.

## Implementation notes (when extending)

- Discovery and category APIs require a POST body (see `references/api.md`).
- Catalog API requires `access_key` / `secret_key` captured from a merchant page.
- Use parser helpers in `src/ifood/parsers.ts` and `normalizeText` for filtering.

## References

- `docs/architecture.md` for the full API flow.
- `docs/troubleshooting.md` for auth/anti-bot issues.
- `references/api.md` for endpoint summary.
