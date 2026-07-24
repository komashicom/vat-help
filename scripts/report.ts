/* ==================================================================
 *  REVIEW SHEET — generates a review.md into every country's
 *  folder: the engine's results from that country's SELLER perspective,
 *  for the representative transaction types. This is what the local
 *  tax expert signs off on.
 *  Run with: npm run reports  (best run after generate)
 * ================================================================== */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Country } from "../src/schema/country";
import type { ScenarioKey } from "../src/schema/result";
import { normalizeKey } from "../src/search/key";
import { ratesText } from "../src/lib/rates";
import { computeResult } from "./engine";
import en from "../src/locales/en.json";

/* The records carry language-independent keys — we resolve them to text
 * with a plain lookup over the en dictionary. (The sheet is a gitignored,
 * generated artifact for review, not part of the shipped app.)
 * NOTE: this script is the only consumer of en.json's `badges.*` section —
 * don't delete those keys in an app-side unused-strings sweep. */
const lookup = (key: string): string | undefined => {
  let v: unknown = en;
  for (const part of key.split(".")) v = (v as Record<string, unknown> | undefined)?.[part];
  return typeof v === "string" ? v : undefined;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dataset = JSON.parse(readFileSync(join(root, "src", "data", "countries.json"), "utf8"));
const countries: Country[] = dataset.countries;
const outRoot = join(root, "countries");

const raw = (o: Partial<ScenarioKey> & { from: string; to: string; supply: "product" | "service"; b2b: boolean }): ScenarioKey =>
  normalizeKey({
    serviceKind: "na", goodsLeave: "na", overThreshold: "na", onsiteLocation: "na", ...o,
  } as ScenarioKey);

function partnersFor(c: Country): { eu: string; third: string } {
  // EU partner: DE (if the country itself is DE, then FR); non-EU: US (if US, then AU)
  const eu = c.code === "DE" ? "FR" : "DE";
  const third = c.code === "US" ? "AU" : "US";
  return { eu, third };
}

function line(countriesArr: Country[], k: ScenarioKey, label: string): string {
  const r = computeResult(countriesArr, k);
  const rate = r.needsState ? "state-dependent" : `${r.rate}%`;
  const extra = r.buyerRate != null ? ` · buyer side ${r.buyerRate}%` : "";
  return `| ${label} | ${rate} | ${lookup(`badges.${r.badge}`) ?? r.badge}${extra} | \`${r.ruleId}\` | ${lookup(`rules.${r.ruleKey}.name`) ?? r.ruleKey} |`;
}

let n = 0;
for (const c of countries) {
  const dir = join(outRoot, c.code);
  if (!existsSync(dir)) continue;
  const { eu, third } = partnersFor(c);
  const euC = countries.find((x) => x.code === eu)!;
  const thirdC = countries.find((x) => x.code === third)!;

  const rows: string[] = [];
  rows.push(line(countries, raw({ from: c.code, to: c.code, supply: "product", b2b: true }), `Domestic goods (B2B)`));
  rows.push(line(countries, raw({ from: c.code, to: c.code, supply: "service", b2b: false, serviceKind: "general" }), `Domestic service (B2C)`));
  rows.push(line(countries, raw({ from: c.code, to: eu, supply: "product", b2b: true, goodsLeave: true }), `Goods B2B → ${euC.name} (goods leave)`));
  rows.push(line(countries, raw({ from: c.code, to: eu, supply: "product", b2b: false, overThreshold: true }), `Goods B2C → ${euC.name} (over threshold)`));
  rows.push(line(countries, raw({ from: c.code, to: eu, supply: "product", b2b: false, overThreshold: false }), `Goods B2C → ${euC.name} (under threshold)`));
  rows.push(line(countries, raw({ from: c.code, to: third, supply: "product", b2b: true, goodsLeave: true }), `Goods B2B → ${thirdC.name}`));
  rows.push(line(countries, raw({ from: c.code, to: eu, supply: "service", b2b: true, serviceKind: "digital" }), `Digital service B2B → ${euC.name}`));
  rows.push(line(countries, raw({ from: c.code, to: eu, supply: "service", b2b: false, serviceKind: "digital", overThreshold: true }), `Digital service B2C → ${euC.name} (over threshold)`));
  rows.push(line(countries, raw({ from: c.code, to: third, supply: "service", b2b: true, serviceKind: "digital" }), `Digital service B2B → ${thirdC.name}`));
  rows.push(line(countries, raw({ from: c.code, to: eu, supply: "service", b2b: false, serviceKind: "general" }), `General service B2C → ${euC.name}`));
  rows.push(line(countries, raw({ from: c.code, to: eu, supply: "service", b2b: true, serviceKind: "onsite", onsiteLocation: "customer" }), `On-site service → ${euC.name} (performed there)`));
  rows.push(line(countries, raw({ from: c.code, to: eu, supply: "service", b2b: true, serviceKind: "onsite", onsiteLocation: "seller" }), `On-site service → ${euC.name} (performed at home)`));

  const md = `# ${c.flag} ${c.name} — review sheet (generated)

**Do NOT edit** — this is generated from \`country.json\` and the global
rule engine. It exists for review: are the results below professionally
correct from ${c.name}'s seller perspective?

Data state: v${dataset.version}. Rates: ${ratesText(c, (k) => lookup(k) ?? k)}${c.threshold ? ` · foreign registration threshold: ${c.threshold}` : ""}.

| Transaction | Rate | Treatment | Rule ID | Rule |
|-------------|------|-----------|---------|------|
${rows.join("\n")}

*If any row is wrong: please report it referencing the row's Rule ID,
stating the correct treatment and its source. Fix rate data in
\`country.json\`.*
`;
  writeFileSync(join(dir, "review.md"), md);
  n++;
}
console.log(`Review sheets generated: ${n} countries.`);
