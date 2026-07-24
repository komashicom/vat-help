import { Wizard } from "./onboarding/Wizard";
import { TooltipProvider } from "@/components/ui/tooltip";

/* The white card (including the header) lives inside the Wizard — so the
 * gray-background strip BELOW the card (editor links + reset) comes from
 * there too. */
export default function App() {
  return (
    <TooltipProvider>
      <div className="min-h-[100dvh] w-full bg-muted sm:py-10">
        <Wizard />
      </div>
    </TooltipProvider>
  );
}
