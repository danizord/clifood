#!/usr/bin/env node
import { Command } from "commander";
import { loadConfig, saveConfig, parseConfigValue, configPath } from "./lib/config.js";
import { openSession } from "./lib/browser.js";
import { parseItemSpec, isUrl } from "./lib/utils.js";
import { openHome, openCart, openCheckout, finalizeOrder } from "./ifood/navigation.js";
import {
  buildCartItems,
  ensureOnHome,
  extractMenuItems,
  getApiContext,
  getCatalog,
  searchRestaurantsApi,
  createCart,
  topRestaurantsApi,
} from "./ifood/api.js";

const program = new Command();

program
  .name("clifood")
  .description("CLI automation for iFood using Playwright")
  .option("--cdp-url <url>", "Connect to an existing Chrome DevTools endpoint")
  .option("--profile-dir <path>", "User data directory for persistent profile")
  .option("--headless [boolean]", "Run browser in headless mode (true/false)")
  .option("--slow-mo <ms>", "Slow down Playwright actions")
  .option("--timeout <ms>", "Default timeout for Playwright actions");

function resolveConfig(opts: Record<string, string | boolean | undefined>) {
  return loadConfig().then((config) => {
    let headlessOverride: boolean | undefined;
    if (typeof opts.headless === "string") {
      headlessOverride = ["1", "true", "yes"].includes(opts.headless.toLowerCase());
    } else if (typeof opts.headless === "boolean") {
      headlessOverride = opts.headless;
    }

    return {
      ...config,
      cdpUrl: typeof opts.cdpUrl === "string" ? opts.cdpUrl : config.cdpUrl,
      profileDir: typeof opts.profileDir === "string" ? opts.profileDir : config.profileDir,
      headless: typeof headlessOverride === "boolean" ? headlessOverride : config.headless,
      slowMo:
        typeof opts.slowMo === "string" && Number.isFinite(Number.parseInt(opts.slowMo, 10))
          ? Number.parseInt(opts.slowMo, 10)
          : config.slowMo,
      timeoutMs:
        typeof opts.timeout === "string" && Number.isFinite(Number.parseInt(opts.timeout, 10))
          ? Number.parseInt(opts.timeout, 10)
          : config.timeoutMs,
    };
  });
}

function printOutput(data: unknown, json?: boolean) {
  if (json) {
    console.log(JSON.stringify(data, null, 2));
  } else if (Array.isArray(data)) {
    data.forEach((entry, idx) => {
      if (typeof entry === "string") {
        console.log(`${idx + 1}. ${entry}`);
      } else if (entry && typeof entry === "object") {
        const record = entry as Record<string, unknown>;
        const name = record.name ? String(record.name) : "(unnamed)";
        const id = record.id ? ` [${record.id}]` : "";
        const url = record.url ? ` — ${record.url}` : "";
        const info = record.info ? ` (${record.info})` : "";
        const price = record.priceText
          ? ` ${record.priceText}`
          : typeof record.price === "number"
            ? ` R$ ${record.price.toFixed(2)}`
            : "";
        const section = record.section ? ` — ${record.section}` : "";
        console.log(`${idx + 1}. ${name}${id}${price}${info}${section}${url}`);
      }
    });
  } else if (data && typeof data === "object") {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(data ?? "");
  }
}

function parseRestaurantUrl(input: string) {
  if (!isUrl(input)) return null;
  const match = input.match(/\/delivery\/([^/]+)\/([0-9a-f-]{36})/i);
  if (!match) return null;
  return { slug: match[1], id: match[2], url: input, name: match[1] };
}

program
  .command("config")
  .description("View or update CLI config")
  .argument("[action]", "show or set", "show")
  .argument("[key]", "config key to update")
  .argument("[value]", "value to set")
  .action(async (action, key, value) => {
    if (action === "show") {
      const config = await loadConfig();
      console.log(`Config path: ${configPath()}`);
      console.log(JSON.stringify(config, null, 2));
      return;
    }

    if (action === "set") {
      if (!key || !value) throw new Error("Usage: clifood config set <key> <value>");
      const update = parseConfigValue(key, value);
      const next = await saveConfig(update);
      console.log(JSON.stringify(next, null, 2));
      return;
    }

    throw new Error(`Unknown config action: ${action}`);
  });

program
  .command("open")
  .description("Open iFood in the connected browser (use to login or set address)")
  .option("--no-wait", "Do not wait for Enter before exiting")
  .action(async (opts) => {
    const globalOpts = program.opts();
    const config = await resolveConfig(globalOpts);
    const session = await openSession(config);

    try {
      await openHome(session.page);
      if (opts.wait) {
        console.log("Browser opened. Press Enter to close.");
        await new Promise<void>((resolve) => {
          process.stdin.resume();
          process.stdin.once("data", () => resolve());
        });
      }
    } finally {
      await session.close();
    }
  });

program
  .command("restaurants")
  .description("Search restaurants")
  .option("-q, --query <query>", "Search query", "a")
  .option("-l, --limit <n>", "Limit results", "10")
  .option("--exclude <term>", "Exclude category/name containing term", (val, acc: string[]) => {
    acc.push(val);
    return acc;
  }, [])
  .option("--exclude-defaults", "Exclude pizza, hamburger, sweets")
  .option("--top", "Return top restaurants (uses discovery feed)")
  .option("--json", "Output JSON")
  .action(async (opts) => {
    const globalOpts = program.opts();
    const config = await resolveConfig(globalOpts);
    const session = await openSession(config);

    try {
      const limit = Number.parseInt(opts.limit, 10);
      await ensureOnHome(session.page);
      const ctx = await getApiContext(session.page);
      const excludeTerms = [
        ...(opts.exclude as string[]),
        ...(opts.excludeDefaults
          ? [
              "pizza",
              "hamburg",
              "hamburguer",
              "burger",
              "burguer",
              "lanches",
              "doce",
              "doces",
              "sobremesa",
              "sobremesas",
              "acai",
              "açai",
              "sorvete",
              "sorvetes",
              "bolo",
              "bolos",
            ]
          : []),
      ];
      const restaurants = opts.top
        ? await topRestaurantsApi(ctx, session.page, limit, excludeTerms)
        : await searchRestaurantsApi(ctx, opts.query, limit, {
            excludeCategories: excludeTerms.length ? excludeTerms : undefined,
          });
      printOutput(restaurants, opts.json);
    } finally {
      await session.close();
    }
  });

program
  .command("items")
  .description("Search items in a restaurant")
  .requiredOption("-r, --restaurant <nameOrUrl>", "Restaurant name or URL")
  .option("-q, --query <query>", "Item query")
  .option("-l, --limit <n>", "Limit results", "10")
  .option("--json", "Output JSON")
  .action(async (opts) => {
    const globalOpts = program.opts();
    const config = await resolveConfig(globalOpts);
    const session = await openSession(config);

    try {
      const limit = Number.parseInt(opts.limit, 10);
      await ensureOnHome(session.page);
      const ctx = await getApiContext(session.page);
      const fromUrl = parseRestaurantUrl(opts.restaurant);
      let merchant = fromUrl;
      if (!merchant) {
        const restaurants = await searchRestaurantsApi(ctx, opts.restaurant, 10, { page: session.page });
        if (!restaurants.length || !restaurants[0].id) {
          throw new Error(`No restaurants found for query: ${opts.restaurant}`);
        }
        merchant = {
          id: restaurants[0].id!,
          slug: restaurants[0].slug ?? "",
          url: restaurants[0].url ?? "",
          name: restaurants[0].name,
        };
      }
      if (!merchant) {
        throw new Error(`No restaurants found for query: ${opts.restaurant}`);
      }
      if (!merchant.url) {
        throw new Error("Restaurant URL missing. Try passing the restaurant URL instead.");
      }
      const catalog = await getCatalog(ctx, merchant.id, { page: session.page, url: merchant.url });
      const items = extractMenuItems(catalog, opts.query ?? undefined, limit);
      printOutput(items, opts.json);
    } finally {
      await session.close();
    }
  });

program
  .command("order")
  .description("Place an order (requires --confirm to submit)")
  .requiredOption("-r, --restaurant <nameOrUrl>", "Restaurant name or URL")
  .option("-i, --item <itemSpec>", "Item name with optional quantity (e.g. 'Pizza:2')", (val, acc: string[]) => {
    acc.push(val);
    return acc;
  }, [])
  .option("--confirm", "Submit the order on the final screen")
  .option("--json", "Output JSON")
  .action(async (opts) => {
    const globalOpts = program.opts();
    const config = await resolveConfig(globalOpts);
    const session = await openSession(config);

    const items = (opts.item as string[]).map(parseItemSpec);
    if (!items.length) {
      throw new Error("At least one --item is required.");
    }

    try {
      await ensureOnHome(session.page);
      const ctx = await getApiContext(session.page);
      const fromUrl = parseRestaurantUrl(opts.restaurant);
      let restaurant = fromUrl;
      if (!restaurant) {
        const results = await searchRestaurantsApi(ctx, opts.restaurant, 10);
        if (!results.length || !results[0].id) {
          throw new Error(`No restaurants found for query: ${opts.restaurant}`);
        }
        const normalized = opts.restaurant.toLowerCase();
        const match = results.find((r) => r.name.toLowerCase().includes(normalized)) ?? results[0];
        restaurant = { id: match.id!, slug: match.slug ?? "", url: match.url ?? "", name: match.name };
      }
      if (!restaurant) {
        throw new Error(`No restaurants found for query: ${opts.restaurant}`);
      }

      if (!restaurant.url) {
        throw new Error("Restaurant URL missing. Try passing the restaurant URL instead.");
      }
      const catalog = await getCatalog(ctx, restaurant.id, { page: session.page, url: restaurant.url });
      const cartItems = buildCartItems(catalog, items);
      const cart = await createCart(ctx, { id: restaurant.id, name: restaurant.name }, cartItems);

      await openCart(session.page);
      await openCheckout(session.page);

      if (opts.confirm) {
        await finalizeOrder(session.page);
      }

      const result = {
        restaurant,
        items,
        confirmed: Boolean(opts.confirm),
        cartId: cart?.cartResponse?.id ?? cart?.cartResponse?.cartResponse?.id ?? null,
        checkoutUrl: session.page.url(),
      };
      printOutput(result, opts.json);
    } finally {
      await session.close();
    }
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
