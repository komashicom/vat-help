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
  active, onClick, icon, title, desc, badge, hint,
}: {
  active: boolean; onClick: () => void; icon?: ReactNode; title: string; desc?: string; badge?: ReactNode; hint?: string;
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
        {/* Stays on ONE line: the title truncates, the badges don't wrap */}
        <span className="flex items-center gap-2 whitespace-nowrap">
          <span className="truncate font-semibold text-foreground">{title}</span>
          {badge &&<Badge variant="secondary" className="shrink-0 text-[11px]">{badge}</Badge>}
          {hint && <Hint text={hint} />}
        </span>
        {desc && <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{desc}</span>}
      </span>
      {/* No checkmark — the border + background indicate the selection. */}
    </button>
  );
}
