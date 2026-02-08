import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Calendar, Users, ExternalLink, ChevronRight, Heart, Check, AlertTriangle } from "lucide-react";
import type { ClinicalTrial } from "@shared/trials";
import type { TrialMatchResult } from "@shared/trial-matching";
import { cn } from "@/lib/utils";

interface TrialCardProps {
    trial: ClinicalTrial;
    onViewDetails: (trial: ClinicalTrial) => void;
    onShowInterest?: (trial: ClinicalTrial) => void;
    hasEhrConnected?: boolean;
    matchResult?: TrialMatchResult;
}

// Status color mapping
const statusColors: Record<string, string> = {
    RECRUITING: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20",
    NOT_YET_RECRUITING: "bg-amber-500/15 text-amber-600 border-amber-500/20",
    ACTIVE_NOT_RECRUITING: "bg-sky-500/15 text-sky-600 border-sky-500/20",
    ENROLLING_BY_INVITATION: "bg-violet-500/15 text-violet-600 border-violet-500/20",
    COMPLETED: "bg-slate-500/15 text-slate-600 border-slate-500/20",
    SUSPENDED: "bg-orange-500/15 text-orange-600 border-orange-500/20",
    TERMINATED: "bg-red-500/15 text-red-600 border-red-500/20",
    WITHDRAWN: "bg-red-500/15 text-red-600 border-red-500/20",
    UNKNOWN: "bg-slate-500/15 text-slate-600 border-slate-500/20",
};

// Format status for display
function formatStatus(status: string): string {
    return status
        .split("_")
        .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
        .join(" ");
}

// Format phase for display
function formatPhase(phases?: string[]): string {
    if (!phases || phases.length === 0) return "";
    return phases
        .map((p) => p.replace("PHASE", "Phase ").replace("EARLY_", "Early ").replace("NA", "N/A"))
        .join(", ");
}

// Get location summary
function getLocationSummary(trial: ClinicalTrial): string {
    const locations = trial.locations || [];
    if (locations.length === 0) return "Location not specified";

    const first = locations[0];
    const parts = [first.city, first.state, first.country].filter(Boolean);
    const summary = parts.join(", ");

    if (locations.length > 1) {
        return `${summary} +${locations.length - 1} more`;
    }
    return summary;
}

export function TrialCard({ trial, onViewDetails, onShowInterest, hasEhrConnected, matchResult }: TrialCardProps) {
    const statusClass = statusColors[trial.overallStatus] || statusColors.UNKNOWN;
    const phase = formatPhase(trial.phases);

    // Match score display config
    const getScoreConfig = (score: number) => {
        if (score >= 80) return { color: "text-green-600", bg: "bg-green-100 dark:bg-green-900/40", label: "Excellent" };
        if (score >= 60) return { color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/40", label: "Good" };
        if (score >= 40) return { color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/40", label: "Moderate" };
        return { color: "text-red-600", bg: "bg-red-100 dark:bg-red-900/40", label: "Low" };
    };

    const scoreConfig = matchResult ? getScoreConfig(matchResult.matchScore) : null;

    return (
        <Card className="surface-panel hover-elevate group transition-all duration-200 cursor-pointer" onClick={() => onViewDetails(trial)}>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                            <Badge variant="outline" className={`${statusClass} text-xs font-medium`}>
                                {formatStatus(trial.overallStatus)}
                            </Badge>
                            {phase && (
                                <Badge variant="secondary" className="text-xs">
                                    {phase}
                                </Badge>
                            )}
                            {/* Match Score Badge */}
                            {matchResult && scoreConfig && (
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        "text-xs font-semibold border-0",
                                        scoreConfig.bg,
                                        scoreConfig.color
                                    )}
                                >
                                    {matchResult.matchScore}% Match
                                </Badge>
                            )}
                        </div>
                        <CardTitle className="text-base font-semibold leading-snug line-clamp-2">
                            {trial.briefTitle}
                        </CardTitle>
                    </div>
                    {/* Match Score Circle or Chevron */}
                    {matchResult && scoreConfig ? (
                        <div className={cn(
                            "flex items-center justify-center h-10 w-10 rounded-full shrink-0",
                            scoreConfig.bg
                        )}>
                            <span className={cn("text-lg font-bold", scoreConfig.color)}>
                                {matchResult.matchScore}
                            </span>
                        </div>
                    ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                </div>

                {/* Quick eligibility summary */}
                {matchResult && (
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1 text-green-600">
                            <Check className="h-3 w-3" />
                            {matchResult.metCriteria} met
                        </span>
                        {matchResult.notMetCriteria > 0 && (
                            <span className="flex items-center gap-1 text-red-500">
                                ✗ {matchResult.notMetCriteria} not met
                            </span>
                        )}
                        {matchResult.missingDataCriteria > 0 && (
                            <span className="flex items-center gap-1 text-amber-500">
                                <AlertTriangle className="h-3 w-3" />
                                {matchResult.missingDataCriteria} missing
                            </span>
                        )}
                    </div>
                )}
            </CardHeader>
            <CardContent className="space-y-3">
                {/* Conditions */}
                {trial.conditions && trial.conditions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {trial.conditions.slice(0, 3).map((condition, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs bg-primary/5">
                                {condition}
                            </Badge>
                        ))}
                        {trial.conditions.length > 3 && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                                +{trial.conditions.length - 3}
                            </Badge>
                        )}
                    </div>
                )}

                {/* Meta info */}
                <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 shrink-0" />
                        <span className="truncate">{getLocationSummary(trial)}</span>
                    </div>

                    {trial.enrollmentCount && (
                        <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 shrink-0" />
                            <span>Target: {trial.enrollmentCount.toLocaleString()} participants</span>
                        </div>
                    )}

                    {trial.startDate && (
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 shrink-0" />
                            <span>Started: {trial.startDate}</span>
                        </div>
                    )}
                </div>

                {/* Sponsor */}
                {trial.sponsor?.name && (
                    <p className="text-xs text-muted-foreground truncate">
                        Sponsor: {trial.sponsor.name}
                    </p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                        onClick={(e) => {
                            e.stopPropagation();
                            onViewDetails(trial);
                        }}
                    >
                        View Details
                    </Button>
                    {hasEhrConnected && onShowInterest && (
                        <Button
                            variant="default"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                onShowInterest(trial);
                            }}
                            className="gap-1.5"
                        >
                            <Heart className="h-4 w-4" />
                            Interested
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            window.open(`https://clinicaltrials.gov/study/${trial.nctId}`, "_blank");
                        }}
                    >
                        <ExternalLink className="h-4 w-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
