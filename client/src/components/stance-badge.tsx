import { Badge } from "@/components/ui/badge";
import { Check, X, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Stance = "supported" | "contradicted" | "uncertain";

const stanceConfig: Record<Stance, { 
  label: string; 
  className: string; 
  icon: typeof Check;
}> = {
  supported: {
    label: "Supported",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    icon: Check,
  },
  contradicted: {
    label: "Contradicted",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
    icon: X,
  },
  uncertain: {
    label: "Uncertain",
    className: "bg-slate-100 text-slate-800 dark:bg-slate-800/50 dark:text-slate-400 border-slate-200 dark:border-slate-700",
    icon: HelpCircle,
  },
};

interface StanceBadgeProps {
  stance: Stance | string | null | undefined;
  showIcon?: boolean;
}

export function StanceBadge({ stance, showIcon = true }: StanceBadgeProps) {
  const config = stanceConfig[(stance as Stance) || "uncertain"] || stanceConfig.uncertain;
  const Icon = config.icon;

  return (
    <Badge 
      variant="outline" 
      className={cn("font-medium border gap-1", config.className)}
    >
      {showIcon && <Icon className="h-3 w-3" />}
      {config.label}
    </Badge>
  );
}
