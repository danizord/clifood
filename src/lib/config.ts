import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { ensureParentDir, parseNumber } from "./utils.js";

const ConfigSchema = z.object({
  cdpUrl: z.string().url().optional(),
  profileDir: z.string().optional(),
  headless: z.boolean().optional(),
  slowMo: z.number().int().nonnegative().optional(),
  locale: z.string().optional(),
  timeoutMs: z.number().int().positive().optional(),
});

export type CliFoodConfig = z.infer<typeof ConfigSchema> & {
  cdpUrl?: string;
  profileDir: string;
  headless: boolean;
  slowMo: number;
  locale: string;
  timeoutMs: number;
};

const DEFAULT_CONFIG: CliFoodConfig = {
  cdpUrl: undefined,
  profileDir: join(homedir(), ".clifood", "profile"),
  headless: false,
  slowMo: 0,
  locale: "pt-BR",
  timeoutMs: 30_000,
};

export function configPath() {
  return join(homedir(), ".clifood", "config.json");
}

function envOverrides() {
  const overrides: Partial<CliFoodConfig> = {};
  if (process.env.IFOOD_CDP_URL) overrides.cdpUrl = process.env.IFOOD_CDP_URL;
  if (process.env.IFOOD_PROFILE_DIR) overrides.profileDir = process.env.IFOOD_PROFILE_DIR;
  if (process.env.IFOOD_HEADLESS) {
    overrides.headless = ["1", "true", "yes"].includes(process.env.IFOOD_HEADLESS);
  }
  if (process.env.IFOOD_SLOW_MO) overrides.slowMo = parseNumber(process.env.IFOOD_SLOW_MO, DEFAULT_CONFIG.slowMo);
  if (process.env.IFOOD_LOCALE) overrides.locale = process.env.IFOOD_LOCALE;
  if (process.env.IFOOD_TIMEOUT_MS) overrides.timeoutMs = parseNumber(process.env.IFOOD_TIMEOUT_MS, DEFAULT_CONFIG.timeoutMs);
  return overrides;
}

export async function loadConfig(): Promise<CliFoodConfig> {
  const path = configPath();
  let fileConfig: Partial<CliFoodConfig> = {};
  try {
    const raw = await fs.readFile(path, "utf-8");
    const parsed = ConfigSchema.partial().safeParse(JSON.parse(raw));
    if (parsed.success) fileConfig = parsed.data;
  } catch {
    fileConfig = {};
  }

  return {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    ...envOverrides(),
  };
}

export async function saveConfig(update: Partial<CliFoodConfig>) {
  const current = await loadConfig();
  const next = { ...current, ...update };
  const safe = ConfigSchema.partial().parse(next);
  const path = configPath();
  await ensureParentDir(path);
  await fs.writeFile(path, JSON.stringify(safe, null, 2));
  return next as CliFoodConfig;
}

export function parseConfigValue(key: string, value: string): Partial<CliFoodConfig> {
  switch (key) {
    case "cdpUrl":
      return { cdpUrl: value };
    case "profileDir":
      return { profileDir: value };
    case "headless":
      return { headless: ["1", "true", "yes"].includes(value.toLowerCase()) };
    case "slowMo":
      return { slowMo: parseNumber(value, DEFAULT_CONFIG.slowMo) };
    case "locale":
      return { locale: value };
    case "timeoutMs":
      return { timeoutMs: parseNumber(value, DEFAULT_CONFIG.timeoutMs) };
    default:
      throw new Error(`Unknown config key: ${key}`);
  }
}
