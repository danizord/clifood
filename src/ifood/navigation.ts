import type { Page } from "playwright";

async function waitForDom(page: Page) {
  await page.waitForLoadState("domcontentloaded");
}

export async function openHome(page: Page) {
  await page.goto("https://www.ifood.com.br/inicio", { waitUntil: "domcontentloaded" });
  await waitForDom(page);
}

export async function openCart(page: Page) {
  await page.goto("https://www.ifood.com.br/carrinho", { waitUntil: "domcontentloaded" });
  await waitForDom(page);
}

export async function openCheckout(page: Page) {
  await page.goto("https://www.ifood.com.br/checkout", { waitUntil: "domcontentloaded" });
  await waitForDom(page);
}

export async function finalizeOrder(page: Page) {
  const button = page.getByRole("button", { name: /fazer pedido|confirmar pedido|finalizar pedido|finalizar compra/i });
  if (!(await button.isVisible().catch(() => false))) {
    throw new Error("Final confirmation button not found.");
  }
  await button.click();
  await waitForDom(page);
}
