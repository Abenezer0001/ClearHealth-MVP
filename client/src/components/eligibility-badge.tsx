/**
 * Eligibility Badge Component
 * Displays eligibility status with visual indicators (✓/✗/⚠️)
 */

import type { EligibilityCriterion, CriterionStatus } from "@shared/trial-matching";
import { cn } from "@/lib/utils";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Check, X, AlertTriangle, HelpCircle } from "lucide-react";

interface EligibilityBadgeProps {
    criterion: EligibilityCriterion;
    compact?: boolean;
}

const statusConfig: Record<CriterionStatus, {
    icon: typeof Check;
    color: string;
    bgColor: string;
    label: string;
}> = {
    met: {
        icon: Check,
        color: "text-green-600 dark:text-green-400",
        bgColor: "bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800",
        label: "Criteria met",
    },
    not_met: {
        icon: X,
        color: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800",
        label: "Criteria not met",
    },
    missing_data: {
        icon: AlertTriangle,
        color: "text-amber-600 dark:text-amber-400",
        bgColor: "bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800",
        label: "Missing data",
    },
    unknown: {
        icon: HelpCircle,
        color: "text-gray-500 dark:text-gray-400",
        bgColor: "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700",
        label: "Requires review",
    },
};

export function EligibilityBadge({ criterion, compact = false }: EligibilityBadgeProps) {
    const config = statusConfig[criterion.status];
    const Icon = config.icon;

    if (compact) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span className={cn("inline-flex items-center justify-center w-5 h-5 rounded-full", config.bgColor)}>
                            <Icon className={cn("h-3 w-3", config.color)} />
                        </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                        <div className="space-y-1">
                            <p className="font-medium">{criterion.name}</p>
                            {criterion.patientValue && (
                                <p className="text-xs">Your value: {criterion.patientValue}</p>
                            )}
                            {criterion.requiredValue && (
                                <p className="text-xs">Required: {criterion.requiredValue}</p>
                            )}
                            {criterion.aiReasoning && (
                                <p className="text-xs text-muted-foreground">{criterion.aiReasoning}</p>
                            )}
                        </div>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    return (
        <div className={cn(
            "flex items-start gap-3 p-3 rounded-lg border",
            config.bgColor
        )}>
            <span className={cn(
                "flex items-center justify-center w-6 h-6 rounded-full shrink-0",
                criterion.status === "met" ? "bg-green-100 dark:bg-green-900/50" :
                    criterion.status === "not_met" ? "bg-red-100 dark:bg-red-900/50" :
                        criterion.status === "missing_data" ? "bg-amber-100 dark:bg-amber-900/50" :
                            "bg-gray-100 dark:bg-gray-800"
            )}>
                <Icon className={cn("h-4 w-4", config.color)} />
            </span>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{criterion.name}</span>
                    <Badge
                        variant="outline"
                        className={cn("text-xs", config.color)}
                    >
                        {config.label}
                    </Badge>
                </div>
                {(criterion.patientValue || criterion.requiredValue) && (
                    <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                        {criterion.patientValue && (
                            <p>Your value: <span className="font-medium">{criterion.patientValue}</span></p>
                        )}
                        {criterion.requiredValue && (
                            <p>Required: <span className="font-medium">{criterion.requiredValue}</span></p>
                        )}
                    </div>
                )}
                {criterion.aiReasoning && (
                    <p className="mt-1 text-xs text-muted-foreground italic">
                        {criterion.aiReasoning}
                    </p>
                )}
            </div>
        </div>
    );
}

interface MatchScoreBadgeProps {
    score: number;
    tier: "excellent" | "good" | "moderate" | "low" | "poor";
    compact?: boolean;
}

const tierConfig = {
    excellent: { color: "text-green-600 dark:text-green-400", bg: "bg-green-100 dark:bg-green-900/40" },
    good: { color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/40" },
    moderate: { color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/40" },
    low: { color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-900/40" },
    poor: { color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/40" },
};

export function MatchScoreBadge({ score, tier, compact = false }: MatchScoreBadgeProps) {
    const config = tierConfig[tier];

    if (compact) {
        return (
            <Badge
                className={cn(
                    "font-semibold",
                    config.bg,
                    config.color
                )}
            >
                {score}%
            </Badge>
        );
    }

    return (
        <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full",
            config.bg
        )}>
            <div className="relative w-8 h-8">
                <svg className="w-8 h-8 transform -rotate-90">
                    <circle
                        cx="16"
                        cy="16"
                        r="12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        className="text-gray-200 dark:text-gray-700"
                    />
                    <circle
                        cx="16"
                        cy="16"
                        r="12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeDasharray={`${(score / 100) * 75.4} 75.4`}
                        strokeLinecap="round"
                        className={config.color}
                    />
                </svg>
            </div>
            <div className="flex flex-col">
                <span className={cn("text-lg font-bold leading-tight", config.color)}>
                    {score}%
                </span>
                <span className="text-xs text-muted-foreground capitalize">
                    {tier} match
                </span>
            </div>
        </div>
    );
}

interface EligibilitySummaryProps {
    criteria: EligibilityCriterion[];
}

export function EligibilitySummary({ criteria }: EligibilitySummaryProps) {
    const met = criteria.filter(c => c.status === "met").length;
    const notMet = criteria.filter(c => c.status === "not_met").length;
    const missing = criteria.filter(c => c.status === "missing_data").length;

    return (
        <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <Check className="h-4 w-4" />
                {met} met
            </span>
            {notMet > 0 && (
                <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                    <X className="h-4 w-4" />
                    {notMet} not met
                </span>
            )}
            {missing > 0 && (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4" />
                    {missing} missing
                </span>
            )}
        </div>
    );
}
