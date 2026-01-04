# iFood API Summary

## Auth + headers

Use `getApiContext(page)` from `src/ifood/api.ts` to capture headers and address/account data. It listens for any iFood API request after loading `/restaurantes` and extracts required headers.

## Endpoints used

- Discovery feed: `GET https://cw-marketplace.ifood.com.br/v2/bm/home?alias=HOME_FOOD_DELIVERY&latitude=...&longitude=...`
- Category page: `GET https://cw-marketplace.ifood.com.br/v1/bm/page/{categoryId}?latitude=...&longitude=...`
- Search: `GET https://cw-marketplace.ifood.com.br/v2/cardstack/search/results?alias=SEARCH_RESULTS_MERCHANT_TAB_GLOBAL&term=...`
- Merchant catalog: `GET https://cw-marketplace.ifood.com.br/v1/bm/merchants/{merchantId}/catalog?latitude=...&longitude=...`
- Cart creation: `POST https://cw-marketplace.ifood.com.br/v1/carts`

## Data extraction helpers

- `extractHomeData` / `extractMerchantsFromPage` in `src/ifood/parsers.ts`
- `extractMenuItems` in `src/ifood/api.ts`
- `buildCartItems` in `src/ifood/api.ts`

## Safety

Do not submit orders unless explicitly requested. The default flow stops after opening checkout.
