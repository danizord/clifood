# Architecture

## Goals

- API-first: no DOM scraping for data.
- Use the authenticated browser session to pass iFood anti-bot checks.
- Keep checkout confirmation explicit and opt-in.

## Auth strategy

The CLI opens a Playwright page (either a persistent profile or a CDP-connected Chrome). It reads the Redux state for account + address data and listens for any iFood API request to capture required auth headers. Those headers are reused for subsequent API calls.

Key headers captured (example):
- `authorization`
- `x-ifood-device-id`
- `x-ifood-session-id`
- `x-ifood-user-id`
- `x-client-application-key`
- `access_key`, `secret_key`
- `x-px-cookies`

All API calls are executed via `page.evaluate(fetch)` to inherit the browser’s context and avoid bot challenges.

## Core endpoints

- Search: `GET /v2/cardstack/search/results`
- Discovery feed: `GET /v2/bm/home?alias=HOME_FOOD_DELIVERY`
- Category page: `GET /v1/bm/page/{id}`
- Merchant catalog: `GET /v1/bm/merchants/{id}/catalog`
- Cart creation: `POST /v1/carts`

## Command flows

### `restaurants`

- `--top`: fetch discovery feed + category pages, filter locally.
- `--query`: use search endpoint.

### `items`

- Resolve merchant by URL or search.
- Fetch merchant catalog.
- Filter catalog items locally.

### `order`

- Resolve merchant by URL or search.
- Fetch catalog, resolve item IDs, and build required sub-items.
- `POST /v1/carts` to create cart.
- Open `https://www.ifood.com.br/carrinho` and `https://www.ifood.com.br/checkout` to review.
- Only submit if `--confirm` is explicitly provided.

## Safety

- Checkout is never submitted unless `--confirm` is provided.
- If iFood challenges with anti-bot, the user must solve the challenge in the browser once.
