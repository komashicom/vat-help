import type { Country, CountryDataset } from "../schema/country";
import raw from "./countries.json";

/* The literal type inferred from the JSON (the `rules` keys differ per
 * country) doesn't fit the Record index signature — hence `unknown`. */
const dataset = raw as unknown as CountryDataset;

export const COUNTRIES: Country[] = dataset.countries;
export const CURRENCIES: string[] = dataset.currencyList;
export const DATA_VERSION: string = dataset.version;

export const byCode = (code: string): Country | undefined =>
  COUNTRIES.find((c) => c.code === code);
