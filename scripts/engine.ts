/* ==================================================================
 *  BUILD-TIME RULE ENGINE — used only by the generator.
 *  The app does NOT import this. This is what populates the static JSON.
 *  It maps out the records defined by the rulebook (vat-rulebook.md).
 *
 *  LANGUAGE-INDEPENDENT: no human-readable text goes into the records,
 *  only keys (badge, ruleKey, note keys, jurisdiction code) — the text
 *  itself comes from the display layer's i18n dictionary (src/locales/).
 * ================================================================== */
import type { Country } from "../src/schema/country";
import type { ScenarioKey, ResultRecord, ComplianceNote, Jurisdiction } from "../src/schema/result";
import { keyOf } from "../src/search/key";

const BR_DEFAULT_STATE = 18;

function byCode(countries: Country[], code: string): Country {
  const c = countries.find((x) => x.code === code);
  if (!c) throw new Error("Unknown country: " + code);
  return c;
}

interface Local { rate: number; juris: Jurisdiction; federal: number | null; state: number | null; sys: boolean; needsState: boolean; noTax: boolean; }
function localRate(c: Country): Local {
  if (c.system === "us") return { rate: 0, juris: { country: c.code, mod: "state" }, federal: null, state: null, sys: true, needsState: true, noTax: false };
  if (c.system === "ca") return { rate: c.std, juris: { country: c.code, mod: "province" }, federal: null, state: null, sys: true, needsState: true, noTax: false };
  if (c.system === "br") return { rate: (c.federal ?? 9.25) + BR_DEFAULT_STATE, juris: { country: c.code, mod: "state" }, federal: c.federal ?? 9.25, state: BR_DEFAULT_STATE, sys: true, needsState: true, noTax: false };
  if (c.system === "au") return { rate: c.std, juris: { country: c.code, mod: null }, federal: null, state: null, sys: true, needsState: false, noTax: false };
  if (c.system === "none") return { rate: 0, juris: { country: c.code, mod: null }, federal: null, state: null, sys: true, needsState: false, noTax: true };
  return { rate: c.std, juris: { country: c.code, mod: null }, federal: null, state: null, sys: false, needsState: false, noTax: false };
}

function computeBase(countries: Country[], key: ScenarioKey): ResultRecord {
  const p = byCode(countries, key.from);
  const c = byCode(countries, key.to);
  const same = p.code === c.code;
  const b2b = key.b2b;

  const notes: ComplianceNote[] = [];
  const r: ResultRecord = {
    key: keyOf(key), scenario: key,
    rate: 0, jurisdiction: { country: c.code, mod: null },
    reverseCharge: false, oss: false, exportZero: false, outsideScope: false, needsState: false, stateCountry: null,
    federal: null, state: null, buyerRate: null, buyerCountry: null,
    registrationThreshold: (!same && c.threshold) ? c.code : null,
    invoiceCode: null,
    badge: "domestic", ruleId: "", ruleKey: "", notes,
  };

  const applyLocal = (x: Country) => {
    const L = localRate(x);
    r.rate = L.rate; r.jurisdiction = L.juris; r.federal = L.federal; r.state = L.state;
    r.needsState = L.needsState;
    r.stateCountry = L.needsState ? x.code : null;
    if (x.system === "br") notes.push({ tone: "info", key: "brModel" });
    if (L.needsState) notes.push({ tone: "info", key: "pickState" });
    return L;
  };

  const isService = key.supply === "service";

  /* ===== GOODS ===== */
  if (!isService) {
    if (same) {
      applyLocal(c);
      r.badge = "domestic"; r.ruleId = "P-DOM";
      r.ruleKey = b2b ? "P-DOM-B2B" : "P-DOM-B2C";
      return r;
    }
    if (b2b) {
      if (key.goodsLeave === false) {
        applyLocal(p);
        r.badge = "domestic"; r.ruleId = "P-B2B-STAY"; r.ruleKey = "P-B2B-STAY";
      } else if (p.eu && c.eu) {
        r.rate = 0; r.reverseCharge = true; r.jurisdiction = { country: c.code, mod: null }; r.buyerRate = c.std; r.buyerCountry = c.code;
        r.badge = "reverseCharge"; r.ruleId = "P-B2B-EU-EU"; r.ruleKey = "P-B2B-EU-EU";
        notes.push({ tone: "info", key: "viesCheck" });
      } else if (p.eu && !c.eu) {
        r.rate = 0; r.exportZero = true; r.jurisdiction = { country: c.code, mod: "import" };
        r.badge = "exportZero"; r.ruleId = "P-B2B-EU-3"; r.ruleKey = "P-B2B-EU-3";
        notes.push({ tone: "info", key: "exportDocs" });
      } else if (!p.eu && c.eu) {
        r.rate = c.std; r.jurisdiction = { country: c.code, mod: "importVat" };
        r.badge = "importVat"; r.ruleId = "P-B2B-3-EU"; r.ruleKey = "P-B2B-3-EU";
      } else {
        const L = applyLocal(c);
        r.jurisdiction = L.sys ? r.jurisdiction : { country: c.code, mod: "import" };
        r.badge = L.sys ? "destination" : "importVat"; r.ruleId = "P-B2B-3-3"; r.ruleKey = "P-B2B-3-3";
      }
      return r;
    }
    // B2C goods — if the goods don't leave the country: local purchase,
    // the seller's country's domestic rate applies (the threshold is irrelevant).
    if (key.goodsLeave === false) {
      applyLocal(p);
      r.badge = "domestic"; r.ruleId = "P-B2C-STAY"; r.ruleKey = "P-B2C-STAY";
      return r;
    }
    if (p.eu && c.eu) {
      if (key.overThreshold === true) {
        r.rate = c.std; r.jurisdiction = { country: c.code, mod: null }; r.oss = true;
        r.badge = "destinationOss"; r.ruleId = "P-B2C-EU-EU-OVER"; r.ruleKey = "P-B2C-EU-EU-OVER";
      } else {
        r.rate = p.std; r.jurisdiction = { country: p.code, mod: null };
        r.badge = "origin"; r.ruleId = "P-B2C-EU-EU-UNDER"; r.ruleKey = "P-B2C-EU-EU-UNDER";
      }
    } else if (p.eu && !c.eu) {
      r.rate = p.std; r.jurisdiction = { country: p.code, mod: null };
      r.badge = "origin"; r.ruleId = "P-B2C-EU-3"; r.ruleKey = "P-B2C-EU-3";
    } else if (!p.eu && c.eu) {
      r.rate = c.std; r.jurisdiction = { country: c.code, mod: "importVat" };
      r.badge = "importVat"; r.ruleId = "P-B2C-3-EU"; r.ruleKey = "P-B2C-3-EU";
    } else {
      applyLocal(p);
      r.badge = "originLocal"; r.ruleId = "P-B2C-3-3"; r.ruleKey = "P-B2C-3-3";
    }
    return r;
  }

  /* ===== SERVICE ===== */
  if (same) {
    applyLocal(c);
    r.badge = "domestic"; r.ruleId = "S-DOM";
    r.ruleKey = b2b ? "S-DOM-B2B" : "S-DOM-B2C";
    return r;
  }

  if (key.serviceKind === "onsite") {
    const atCustomer = key.onsiteLocation === "customer";
    const loc = atCustomer ? c : p;
    applyLocal(loc);
    r.badge = "onsite"; r.ruleId = "S-ONSITE"; r.ruleKey = "S-ONSITE";
    return r;
  }

  if (b2b) {
    if (p.eu && c.eu) {
      r.rate = 0; r.reverseCharge = true; r.jurisdiction = { country: c.code, mod: null }; r.buyerRate = c.std; r.buyerCountry = c.code;
      r.badge = "reverseCharge"; r.ruleId = "S-B2B-EU-EU"; r.ruleKey = "S-B2B-EU-EU";
    } else if (p.eu && !c.eu) {
      r.rate = 0; r.outsideScope = true; r.jurisdiction = { country: c.code, mod: null };
      r.badge = "outsideEuVat"; r.ruleId = "S-B2B-EU-3"; r.ruleKey = "S-B2B-EU-3";
    } else {
      const buyerHasTax = c.std > 0 && c.system !== "none" && c.system !== "us";
      r.rate = 0; r.outsideScope = true; r.jurisdiction = { country: c.code, mod: null };
      r.badge = "exportZero"; r.ruleId = "S-B2B-3-X";
      if (buyerHasTax) {
        r.reverseCharge = true; r.buyerRate = c.std; r.buyerCountry = c.code;
        r.ruleKey = "S-B2B-3-X-RC";
      } else {
        r.ruleKey = "S-B2B-3-X-NOTAX";
      }
      notes.push({ tone: "warn", key: "sellerExportRule" });
    }
    return r;
  }

  // B2C service
  if (key.serviceKind === "digital") {
    if (p.eu && c.eu) {
      if (key.overThreshold === true) {
        r.rate = c.std; r.jurisdiction = { country: c.code, mod: null }; r.oss = true;
        r.badge = "destinationOss"; r.ruleId = "S-B2C-DIG-EU-EU-OVER"; r.ruleKey = "S-B2C-DIG-EU-EU-OVER";
      } else {
        r.rate = p.std; r.jurisdiction = { country: p.code, mod: null };
        r.badge = "origin"; r.ruleId = "S-B2C-DIG-EU-EU-UNDER"; r.ruleKey = "S-B2C-DIG-EU-EU-UNDER";
      }
    } else if (p.eu && !c.eu) {
      r.rate = 0; r.outsideScope = true; r.jurisdiction = { country: c.code, mod: null };
      r.badge = "outsideEuVat"; r.ruleId = "S-B2C-DIG-EU-3"; r.ruleKey = "S-B2C-DIG-EU-3";
    } else if (!p.eu && c.eu) {
      r.rate = c.std; r.jurisdiction = { country: c.code, mod: null }; r.oss = true;
      r.badge = "destinationOss"; r.ruleId = "S-B2C-DIG-3-EU"; r.ruleKey = "S-B2C-DIG-3-EU";
      notes.push({ tone: "warn", key: "noEuThreshold" });
    } else {
      applyLocal(c);
      r.badge = "destination"; r.ruleId = "S-B2C-DIG-3-3"; r.ruleKey = "S-B2C-DIG-3-3";
    }
    return r;
  }

  // B2C general (non-digital)
  if (p.eu) {
    r.rate = p.std; r.jurisdiction = { country: p.code, mod: null };
    r.badge = "origin"; r.ruleId = "S-B2C-GEN-EU";
    r.ruleKey = c.eu ? "S-B2C-GEN-EU-EU" : "S-B2C-GEN-EU-3";
  } else {
    applyLocal(p);
    r.badge = "originLocal"; r.ruleId = "S-B2C-GEN-3"; r.ruleKey = "S-B2C-GEN-3";
  }
  return r;
}

/* ------------------------------------------------------------------
 * INVOICE CODE — what the SELLER puts on a 0% line.
 *
 * The seller country's catalogue lives in country.json
 * (reducedCategories, rate 0, `type`: code → English label). This map
 * says which EN 16931 category belongs to which relation; it is the
 * same in every country, because it follows from the VAT Directive.
 * A country that uses the standard letters gets its code here for free.
 *
 * Countries with a NATIONAL code list (HU "EUFAD37", IT "N3.2", PL
 * "0 WDT"…) have no "K"/"G"/"AE"/"O" in their catalogue, so nothing is
 * attached here — their own countries/{CODE}/engine.ts does it, and
 * runs after this.
 * ------------------------------------------------------------------ */
const EN16931_BY_RULE: Record<string, string> = {
  "P-B2B-EU-EU": "K",       // intra-Community supply of goods
  "P-B2B-EU-3": "G",        // export of goods
  "S-B2B-EU-EU": "AE",      // B2B service, reverse charge
  "S-B2B-EU-3": "O",        // place of supply outside the EU
  "S-B2C-DIG-EU-3": "O",    // digital service to a non-EU consumer
  "S-B2B-3-X": "G",         // non-EU seller's service export
};

/** The seller's own 0% code catalogue, from country.json. */
export function zeroCatalogue(seller: Country): Record<string, string> {
  return seller.reducedCategories?.find((r) => r.rate === 0)?.type ?? {};
}

function attachEn16931(seller: Country, r: ResultRecord): void {
  if (r.rate !== 0) return;
  const code = EN16931_BY_RULE[r.ruleId];
  if (!code) return;
  const label = zeroCatalogue(seller)[code];
  if (!label) return;
  r.invoiceCode = { code, label };
}

/** Global engine + the seller-side invoice code. */
export function computeResult(countries: Country[], key: ScenarioKey): ResultRecord {
  const r = computeBase(countries, key);
  attachEn16931(byCode(countries, key.from), r);
  return r;
}
