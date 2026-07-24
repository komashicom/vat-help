/* ==================================================================
 *  MERGER — builds src/data/countries.json from the
 *  countries/{CODE}/country.json files (in deterministic order).
 *  Part of the build chain: runs before npm run generate.
 * ================================================================== */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Country } from "../src/schema/country";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const srcRoot = join(root, "countries");
const target = join(root, "src", "data", "countries.json");

if (!existsSync(srcRoot)) {
  console.log("countries/ folder not found — keeping the existing src/data/countries.json.");
  process.exit(0);
}

const collator = new Intl.Collator("en");
const list: Country[] = [];
const reviewed: string[] = [];
const draft: string[] = [];

for (const code of readdirSync(srcRoot).sort()) {
  const file = join(srcRoot, code, "country.json");
  if (!existsSync(file)) continue;
  const doc = JSON.parse(readFileSync(file, "utf8"));
  const c = doc.country as Country;
  if (c.code !== code) throw new Error(`Code mismatch: folder=${code}, country.code=${c.code}`);
  list.push(c);
  (doc.meta?.status === "reviewed" ? reviewed : draft).push(code);
}

// deterministic order: EU members first by name, then the rest by name
list.sort((a, b) => (Number(b.eu) - Number(a.eu)) || collator.compare(a.name, b.name));

const dataset = {
  _comments: [
    "This file is generated automatically by `npm run generate` (scripts/merge-countries.ts).",
    "Do not edit — edit countries/<CODE>/country.json instead and regenerate.",
  ],
  version: "2026-01",
  currencyList: ["EUR", "HUF", "USD", "GBP", "AUD", "CHF"],
  countries: list,
};
writeFileSync(target, JSON.stringify(dataset, null, 2) + "\n");
console.log(`countries.json merged: ${list.length} countries (${reviewed.length} reviewed, ${draft.length} draft).`);
if (draft.length) console.log("  Draft:", draft.join(", "));
