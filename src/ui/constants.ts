/* The project's Gitea repo — for contributions, bug reports, editing. */
export const REPO_URL = "https://git.h1v3.com/komashi/VAT-calc";

/** Gitea's built-in web editor — on save it automatically creates a
 *  branch + pull request under the editor's name. */
export const editCountryUrl = (code: string): string =>
  `${REPO_URL}/_edit/main/countries/${code}/country.json`;

/* Eurozone members — EUR is their default currency. */
const EUROZONE = new Set([
  "AT", "BE", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR", "IE",
  "IT", "LT", "LU", "LV", "MT", "NL", "PT", "SI", "SK",
]);

const COUNTRY_CURRENCY: Record<string, string> = {
  HU: "HUF", US: "USD", GB: "GBP", AU: "AUD", CH: "CHF",
};

/**
 * The given country's currency — but only within the supported currency
 * list (countries.json currencyList); for everything else we return EUR,
 * because that's the only one with a built-in threshold exchange rate
 * (lib/threshold.ts).
 */
export function defaultCurrency(countryCode: string): string {
  if (COUNTRY_CURRENCY[countryCode]) return COUNTRY_CURRENCY[countryCode];
  if (EUROZONE.has(countryCode)) return "EUR";
  return "EUR";
}
