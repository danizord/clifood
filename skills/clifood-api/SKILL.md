---
name: clifood-api
description: API-first iFood automation for the clifood project. Use when adding features, debugging, or running the iFood CLI, or when working with iFood discovery/search/catalog/cart APIs and related parsing logic in this repo.
---

# Clifood API Skill

## Overview

Use this skill to work on the clifood CLI and its API-first iFood integration without UI scraping. It captures auth headers from the logged-in browser session and calls iFood’s internal endpoints directly.

## Quick start

1. Ensure a logged-in browser session with a delivery address.
2. Run CLI commands from repo root.

Examples:

```bash
bun src/cli.ts restaurants --top --exclude-defaults --limit 10
bun src/cli.ts items --restaurant "Restaurante X" --query "temaki"
```

## Core workflow (API-first)

1. **Capture auth context**
   - Call `getApiContext(page)` from `src/ifood/api.ts`.
   - This reads Redux state (account + address) and captures required headers.

2. **Fetch data**
   - Discovery: `topRestaurantsApi` (home feed + category pages).
   - Search: `searchRestaurantsApi`.
   - Catalog: `getCatalog` + `extractMenuItems`.

3. **Build cart**
   - Resolve items with `buildCartItems` (uses catalog choices).
   - Create cart with `createCart`.

4. **Review checkout**
   - Use `openCart` and `openCheckout` from `src/ifood/navigation.ts`.
   - Do **not** submit the order unless explicitly requested.

## Implementation notes

- API calls must be executed via the browser context (`page.evaluate(fetch)`) to avoid bot challenges.
- Use helper parsers in `src/ifood/parsers.ts` to extract category and merchant data.
- Keep filters normalized using `normalizeText` (accent-insensitive).

## References

- `docs/architecture.md` for the full API flow.
- `docs/troubleshooting.md` for auth/anti-bot issues.
- `references/api.md` for endpoint summary.
