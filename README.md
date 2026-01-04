# clifood

API-first CLI for iFood. It uses your authenticated browser session to call iFood’s internal APIs directly (search, catalog, cart, discovery) and only opens pages for login/address setup and checkout review. No UI scraping is required.

## Quick start

```bash
bun install
# Optional: install Playwright's bundled browser
bunx playwright install chromium

# Run a quick restaurant search (API)
bun src/cli.ts restaurants --query "pizza" --limit 5 --json
```

## Use your existing logged-in browser (recommended)

Start Chrome with remote debugging enabled, then point the CLI to it:

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.clifood/chrome-profile"

# Then run
bun src/cli.ts restaurants --query "japonesa" --cdp-url http://127.0.0.1:9222
```

This keeps your existing iFood login and address selection. All API calls are executed from your authenticated browser context to avoid bot blocks.

## Commands

### Open iFood (manual setup)

```bash
bun src/cli.ts open --wait
```

Use this to log in or set your delivery address in the connected browser profile.

### Search restaurants

```bash
bun src/cli.ts restaurants --query "sushi" --limit 10
```

Exclude categories or names:

```bash
bun src/cli.ts restaurants --query "a" --exclude pizza --exclude hamburguer --exclude doces --limit 10
```

Shortcut:

```bash
bun src/cli.ts restaurants --query "a" --exclude-defaults --limit 10
```

Defaults cover pizza, burgers, and sweets (including lanches, açaí, sorvetes, bolos).

Top restaurants (discovery feed, no search term):

```bash
bun src/cli.ts restaurants --top --exclude-defaults --limit 10
```

### Search items in a restaurant

```bash
bun src/cli.ts items --restaurant "Restaurante X" --query "temaki" --limit 10
```

You can also pass a full iFood restaurant URL with `--restaurant`.

### Place an order

```bash
bun src/cli.ts order \
  --restaurant "Restaurante X" \
  --item "Temaki de salmão:2" \
  --item "Guioza" \
  --confirm
```

Safety: without `--confirm`, the CLI opens checkout but does **not** submit the order.

## Configuration

Config lives at `~/.clifood/config.json`. You can also override via CLI flags or environment variables.

```bash
bun src/cli.ts config show
bun src/cli.ts config set cdpUrl http://127.0.0.1:9222
bun src/cli.ts config set headless false
```

Supported keys: `cdpUrl`, `profileDir`, `headless`, `slowMo`, `locale`, `timeoutMs`.

Environment overrides:

- `IFOOD_CDP_URL`
- `IFOOD_PROFILE_DIR`
- `IFOOD_HEADLESS`
- `IFOOD_SLOW_MO`
- `IFOOD_LOCALE`
- `IFOOD_TIMEOUT_MS`

## Notes

- The CLI is API-first and depends on a valid logged-in browser session.
- Some menu items require mandatory option choices; the CLI auto-selects minimum required options from the catalog data.
- Read `docs/architecture.md` for the exact API flow and data dependencies.
- Read `docs/troubleshooting.md` if you hit auth or anti-bot issues.
