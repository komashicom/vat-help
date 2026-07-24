import { useState, useMemo } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Popover as PopoverPrimitive } from "radix-ui";
import { Search, Check, ChevronDown } from "lucide-react";
import type { Country } from "../schema/country";
import { COUNTRIES, byCode } from "../data/countries";
import { hasRegionalRates, ratesText } from "../lib/rates";
import { countryName } from "./format";
import { Hint } from "./components";
import { cn } from "@/lib/utils";

/** The rate line's tooltip — broken out line by line to show WHICH rate
 *  applies to WHAT: the standard rate gets one line, then each reduced rate
 *  gets its own line with its example categories (e.g. "reduced 5%:
 *  pharmaceuticals, books, district heating…") if that data exists —
 *  otherwise the generic explanatory text is the fallback. */
function ratesHint(c: Country, t: TFunction): ReactNode {
  if (c.system === "none") return t("countrySelect.noTaxHint");
  if (hasRegionalRates(c)) return t("countrySelect.regionsHint");
  if (!c.reduced.length) return t("countrySelect.stdRateHint");
  return (
    <div className="space-y-1.5 text-left">
      <div>
        <span className="font-semibold">{t("countrySelect.stdRate")} {c.std}%</span>
        {" — "}{t("countrySelect.stdRateHint")}
      </div>
      {c.reduced.map((r) => {
        const info = c.reducedCategories?.find((x) => x.rate === r);
        return (
          <div key={r}>
            <span className="font-semibold">{t("countrySelect.reducedRate")} {r}%</span>
            {info ? `: ${info.items.join(", ")}` : ` — ${t("countrySelect.reducedRateHint")}`}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Country-picker DROPDOWN: the button shows just the flag + country name;
 * clicking it opens a searchable list below the button. With an empty value
 * (no buyer yet) it's a dashed, highlighted placeholder button — picking a
 * country advances the flow.
 */
export function CountrySelect({ value, onChange, placeholder }: {
  value: string; onChange: (code: string) => void; placeholder?: string;
}) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const sel = value ? byCode(value) : undefined;

  // Localized name (Intl.DisplayNames) + sorting by the active language;
  // search also matches the data's English name — normally identical to the
  // localized one, but it keeps search working when the browser's ICU names
  // differ from our data — and the ISO code.
  const list = useMemo(() =>
    COUNTRIES
      .map((c) => ({ ...c, localName: countryName(c.code) }))
      .sort((a, b) => a.localName.localeCompare(b.localName, i18n.language)),
    [i18n.language]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter((c) =>
      c.localName.toLowerCase().includes(term)
      || c.name.toLowerCase().includes(term)
      || c.code.toLowerCase().includes(term));
  }, [q, list]);

  const pick = (code: string) => { onChange(code); setOpen(false); setQ(""); };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(""); }}>
      <div className="min-w-0">
        <PopoverPrimitive.Trigger asChild>
          <button
            className={cn(
              "flex w-full items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 transition hover:bg-accent active:scale-[0.99] sm:gap-2 sm:px-3 sm:py-3",
              // when selected: no border/box — only the chevron signals it opens
              sel ? "border-transparent" : "border-dashed border-primary/60 bg-primary/5",
            )}>
            <span className="text-xl leading-none sm:text-2xl">{sel?.flag ?? "🌐"}</span>
            <span className={cn("min-w-0 truncate text-sm font-semibold sm:text-base", sel ? "text-foreground" : "text-primary")}>
              {sel ? countryName(sel.code) : (placeholder ?? t("wizard.choose"))}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverPrimitive.Trigger>
        {/* rates below the country — plain text, explanation in the tooltip */}
        {sel && (
          <div className="mt-1.5 inline-flex w-full items-center justify-center gap-1 text-center text-[11px] text-muted-foreground sm:text-xs">
            {ratesText(sel, t)}
            <Hint text={ratesHint(sel, t)} />
          </div>
        )}
      </div>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content align="start" sideOffset={6}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-64 overflow-hidden rounded-xl border bg-popover shadow-lg outline-none">
          <div className="border-b px-3 py-2">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("countrySelect.searchPlaceholder")}
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            </div>
          </div>
          <div className="max-h-64 space-y-0.5 overflow-y-auto p-1.5">
            {filtered.length === 0 && <div className="px-2 py-4 text-sm text-muted-foreground">{t("countrySelect.noResults")}</div>}
            {filtered.map((c) => (
              <button key={c.code} onClick={() => pick(c.code)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors active:scale-[0.99]",
                  c.code === value ? "bg-primary/10" : "hover:bg-accent",
                )}>
                <span className="text-lg leading-none">{c.flag}</span>
                <span className="flex-1 truncate font-medium text-foreground">{c.localName}</span>
                {c.code === value && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </button>
            ))}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
