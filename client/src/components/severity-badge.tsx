import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Severity = "low" | "medium" | "high" | "critical";

const severityConfig: Record<Severity, { 
  label: string; 
  className: string; 
  icon: typeof AlertTriangle;
}> = {
  low: {
    label: "Low Risk",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    icon: CheckCircle,
  },
  medium: {
    label: "Medium Risk",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    icon: AlertCircle,
  },
  high: {
    label: "High Risk",
    className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800",
    icon: AlertTriangle,
  },
  critical: {
    label: "Critical",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
    icon: XCircle,
  },
};

interface SeverityBadgeProps {
  severity: Severity | string | null | undefined;
  showIcon?: boolean;
  size?: "sm" | "default";
}

export function SeverityBadge({ severity, showIcon = true, size = "default" }: SeverityBadgeProps) {
  const config = severityConfig[(severity as Severity) || "low"] || severityConfig.low;
  const Icon = config.icon;

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "font-medium border gap-1",
        config.className,
        size === "sm" && "text-xs px-2 py-0.5"
      )}
    >
      {showIcon && <Icon className={cn("h-3 w-3", size === "sm" && "h-2.5 w-2.5")} />}
      {config.label}
    </Badge>
  );
}
