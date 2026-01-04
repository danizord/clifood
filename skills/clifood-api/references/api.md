# iFood API Summary

## Auth + headers

Use `getApiContext(page)` from `src/ifood/api.ts` to capture headers and address/account data. It reads Redux state (account + address) and captures required headers from a live API request.

## Endpoints used

- Discovery feed: `POST https://cw-marketplace.ifood.com.br/v2/bm/home?alias=HOME_MULTICATEGORY&latitude=...&longitude=...&channel=IFOOD&size=...`
- Category page: `POST https://cw-marketplace.ifood.com.br/v1/bm/page/{categoryId}?latitude=...&longitude=...&channel=IFOOD`
- Search: `POST https://cw-marketplace.ifood.com.br/v2/cardstack/search/results?alias=SEARCH_RESULTS_MERCHANT_TAB_GLOBAL&term=...&latitude=...&longitude=...&channel=IFOOD&size=...`
- Merchant catalog: `GET https://cw-marketplace.ifood.com.br/v1/bm/merchants/{merchantId}/catalog?latitude=...&longitude=...`
- Cart creation: `POST https://cw-marketplace.ifood.com.br/v1/carts`

## Data extraction helpers

- `extractHomeData` / `extractMerchantsFromPage` in `src/ifood/parsers.ts`
- `extractMenuItems` in `src/ifood/api.ts`
- `buildCartItems` in `src/ifood/api.ts`

## Safety

Do not submit orders unless explicitly requested. The default flow stops after opening checkout.
