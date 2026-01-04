import { describe, expect, test } from "bun:test";
import { normalizeText, parseItemSpec } from "../src/lib/utils.js";

describe("normalizeText", () => {
  test("lowercases and removes accents", () => {
    expect(normalizeText("Açaí")).toBe("acai");
    expect(normalizeText(" Hambúrguer ")).toBe("hamburguer");
  });
});

describe("parseItemSpec", () => {
  test("parses quantity separators", () => {
    expect(parseItemSpec("Pizza:2")).toEqual({ name: "Pizza", qty: 2 });
    expect(parseItemSpec("Combo x 3")).toEqual({ name: "Combo", qty: 3 });
  });

  test("defaults to qty 1", () => {
    expect(parseItemSpec("Guioza")).toEqual({ name: "Guioza", qty: 1 });
  });
});
