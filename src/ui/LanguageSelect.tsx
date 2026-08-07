/* ==================================================================
 *  LANGUAGE SELECT — compact header dropdown to override the auto-picked
 *  language. Each language is shown in its own name (endonym), e.g.
 *  "Deutsch", "Español", "日本語".
 * ================================================================== */
import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import { LANGUAGES } from "../i18n";
import { setLanguage } from "../lib/language";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** The language's own name for its code (e.g. "de" → "Deutsch"). */
function endonym(code: string): string {
  try {
    const name = new Intl.DisplayNames([code], { type: "language" }).of(code);
    if (name) return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    /* Intl can't name it — fall through to the code */
  }
  return code.toUpperCase();
}

export function LanguageSelect() {
  const { i18n } = useTranslation();
  return (
    <Select value={i18n.language} onValueChange={setLanguage}>
      <SelectTrigger
        aria-label="Language"
        className="h-8 w-auto gap-1.5 border px-2.5 py-1.5 text-xs font-medium text-muted-foreground"
      >
        <Languages className="h-3.5 w-3.5 shrink-0" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {LANGUAGES.map((code) => (
          <SelectItem key={code} value={code} className="text-xs">
            {endonym(code)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
