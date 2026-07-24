/* ==================================================================
 *  GENERATOR — builds the final result for EVERY relation at build time.
 *  Outputs:
 *    - public/data/results.json         (the app searches this, ONE file)
 *    - countries/{CODE}/generated.json  (per-country; only that country's
 *                                        records AS SELLER — for the local
 *                                        tax expert to verify)
 *  The per-country engine.ts (customize), if present, runs on that
 *  country's seller records AFTER the global engine.
 *  Run with:  npm run generate
 * ================================================================== */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import type { Country } from "../src/schema/country";
import type { ScenarioKey, ResultRecord, Supply } from "../src/schema/result";
import { SERVICE_KINDS, ONSITE_LOCATIONS } from "../src/schema/result";
import { normalizeKey, keyOf } from "../src/search/key";
import { computeResult } from "./engine";

type Customize = (record: ResultRecord, key: ScenarioKey, countries: Country[]) => ResultRecord;

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dataDir = join(root, "src", "data");
const outDir = join(root, "public", "data");
const countriesDir = join(root, "countries");
mkdirSync(outDir, { recursive: true });

const dataset = JSON.parse(readFileSync(join(dataDir, "countries.json"), "utf8")) as { version: string; countries: Country[] };
const countries = dataset.countries;

// Load per-country customize functions (if countries/{CODE}/engine.ts exists)
const custom: Record<string, Customize> = {};
for (const c of countries) {
  const file = join(countriesDir, c.code, "engine.ts");
  if (!existsSync(file)) continue;
  const mod = await import(pathToFileURL(file).href);
  if (typeof mod.customize === "function") custom[c.code] = mod.customize as Customize;
}
const customCount = Object.keys(custom).length;

const bools = [true, false];
const kinds = SERVICE_KINDS;
const locs = ONSITE_LOCATIONS;

function* rawScenarios(from: string, to: string): Generator<ScenarioKey> {
  // Goods
  for (const b2b of bools)
    for (const goodsLeave of bools)
      for (const overThreshold of bools)
        yield { from, to, supply: "product" as Supply, b2b, serviceKind: "na", goodsLeave, overThreshold, onsiteLocation: "na" };
  // Service
  for (const b2b of bools)
    for (const serviceKind of kinds)
      for (const overThreshold of bools)
        for (const onsiteLocation of locs)
          yield { from, to, supply: "service" as Supply, b2b, serviceKind, goodsLeave: "na", overThreshold, onsiteLocation };
}

const seen = new Map<string, ResultRecord>();
for (const p of countries) {
  const fn = custom[p.code];
  for (const c of countries) {
    for (const raw of rawScenarios(p.code, c.code)) {
      const norm = normalizeKey(raw);
      const k = keyOf(norm);
      if (seen.has(k)) continue;
      let rec = computeResult(countries, norm);
      if (fn) rec = fn(rec, norm, countries);
      seen.set(k, rec);
    }
  }
}

const records = [...seen.values()];
// Compact (no pretty-print): only the machine reads this file, size matters.
writeFileSync(join(outDir, "results.json"), JSON.stringify({ version: dataset.version, records }));

// Per-country generated.json — only that country's own seller records
let perCountryFiles = 0;
for (const p of countries) {
  const dir = join(countriesDir, p.code);
  if (!existsSync(dir)) continue;
  const own = records.filter((r) => r.scenario.from === p.code);
  const doc = {
    _comment: "AUTO-GENERATED — do not edit. scripts/generate.ts overwrites this on every `npm run generate` run. Source: countries/" + p.code + "/country.json + engine.ts + the global scripts/engine.ts.",
    version: dataset.version,
    country: p.code,
    records: own,
  };
  writeFileSync(join(dir, "generated.json"), JSON.stringify(doc, null, 2) + "\n");
  perCountryFiles++;
}

console.log(`Done: public/data/results.json (${records.length} records) + ${perCountryFiles} per-country generated.json files (${customCount} country-specific engine.ts loaded).`);
