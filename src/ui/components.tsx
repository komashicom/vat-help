import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Small question-mark hint — tooltip on hover/focus. Deliberately a <span>,
 * not a <button>: it often sits INSIDE a button (ChoiceCard), and
 * button-in-button would be invalid HTML. It swallows the click so tapping
 * the ? doesn't select the card behind it.
 */
export function Hint({ text, className }: { text: ReactNode; className?: string }) {
  const { t } = useTranslation();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span role="button" tabIndex={0} aria-label={t("wizard.helpAria")}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          className={cn("inline-flex shrink-0 cursor-help items-center text-muted-foreground/50 transition-colors hover:text-foreground", className)}>
          <HelpCircle className="h-3.5 w-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 leading-relaxed">{text}</TooltipContent>
    </Tooltip>
  );
}

export function ChoiceCard({
  active, onClick, icon, title, desc, badge, hint, tag, footer,
}: {
  active: boolean; onClick: () => void; icon?: ReactNode; title: string; desc?: string;
  badge?: ReactNode; hint?: string;
  /** Right-aligned chip on the title row (e.g. "Seller VAT" — whose VAT applies). */
  tag?: ReactNode;
  /** A line under the description, below a faint divider (e.g. "VAT calculated in 🇭🇺 Hungary"). */
  footer?: ReactNode;
}) {
  return (
    <button onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors active:scale-[0.99]",
        active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-card hover:bg-accent",
      )}>
      {icon && (
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
          active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        {/* Title + inline badge/hint on the left (wraps if long, e.g. an on-site
            title carrying a country name), with the tag pinned to the top-right. */}
        <span className="flex items-start gap-2">
          <span className="min-w-0 flex-1 font-semibold text-foreground">
            {title}
            {badge && <Badge variant="secondary" className="ml-2 align-middle text-[11px]">{badge}</Badge>}
            {hint && <span className="ml-1 inline-flex translate-y-0.5 align-middle"><Hint text={hint} /></span>}
          </span>
          {tag && <span className="shrink-0">{tag}</span>}
        </span>
        {desc && <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{desc}</span>}
        {footer && <span className="mt-2 block border-t border-border/60 pt-1.5">{footer}</span>}
      </span>
      {/* No checkmark — the border + background indicate the selection. */}
    </button>
  );
}
