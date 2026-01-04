import { describe, expect, test } from "bun:test";
import {
  extractCategoryFromEntry,
  extractHomeData,
  extractMerchantsFromPage,
  parseCategoryAction,
  parseMerchantAction,
  shouldExcludeRestaurant,
} from "../src/ifood/parsers.js";

const sampleHome = {
  sections: [
    {
      cards: [
        {
          data: {
            contents: [
              {
                title: "Brasileira",
                action: "page?identifier=cat-123&title=Brasileira",
              },
              {
                name: "Restaurante X",
                action: "merchant?identifier=abc-123&slug=sao-paulo/restaurante-x",
                mainCategory: "Brasileira",
              },
            ],
          },
        },
      ],
    },
  ],
};

const samplePage = {
  sections: [
    {
      cards: [
        {
          data: {
            contents: [
              {
                name: "Sushi Y",
                action: "merchant?identifier=def-456&slug=sao-paulo/sushi-y",
                contentDescription: "Sushi Y, Tipo de comida: Japonesa, 1.2 km",
              },
            ],
          },
        },
      ],
    },
  ],
};

describe("action parsers", () => {
  test("parseCategoryAction", () => {
    expect(parseCategoryAction("page?identifier=cat-123&title=Brasileira")).toBe("cat-123");
    expect(parseCategoryAction("merchant?identifier=123")).toBeNull();
  });

  test("parseMerchantAction", () => {
    expect(parseMerchantAction("merchant?identifier=abc-123&slug=foo/bar"))
      .toEqual({ id: "abc-123", slug: "foo/bar" });
    expect(parseMerchantAction("page?identifier=cat-123")).toBeNull();
  });
});

describe("extractors", () => {
  test("extractHomeData", () => {
    const { categories, merchants } = extractHomeData(sampleHome);
    expect(categories).toEqual([{ id: "cat-123", title: "Brasileira" }]);
    expect(merchants[0]).toMatchObject({ name: "Restaurante X", slug: "sao-paulo/restaurante-x" });
  });

  test("extractMerchantsFromPage", () => {
    const merchants = extractMerchantsFromPage(samplePage);
    expect(merchants).toHaveLength(1);
    expect(merchants[0]).toMatchObject({ name: "Sushi Y", slug: "sao-paulo/sushi-y" });
  });

  test("extractCategoryFromEntry", () => {
    expect(extractCategoryFromEntry({ mainCategory: "Vegana" })).toBe("Vegana");
    expect(extractCategoryFromEntry({ contentDescription: "Tipo de comida: Árabe, 2 km" })).toBe("Árabe");
  });
});

describe("filters", () => {
  test("shouldExcludeRestaurant", () => {
    expect(
      shouldExcludeRestaurant({ name: "Pizza Place", info: "Italiana", url: "" }, ["pizza"])
    ).toBe(true);
    expect(
      shouldExcludeRestaurant({ name: "Sushi Bar", info: "Japonesa", url: "" }, ["pizza"])
    ).toBe(false);
  });
});
