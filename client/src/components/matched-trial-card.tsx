import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Check, ChevronDown, ExternalLink, Heart, MapPin, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClinicalTrial } from "@shared/trials";
import type { TrialMatchResult } from "@shared/trial-matching";

interface MatchedTrialCardProps {
  trial: ClinicalTrial;
  match: TrialMatchResult;
  hasEhrConnected?: boolean;
  onViewDetails: (trial: ClinicalTrial) => void;
  onShowInterest?: (trial: ClinicalTrial) => void;
}

function getLocationFlair(trial: ClinicalTrial): string {
  const first = trial.locations?.[0];
  if (!first) return "No location listed";

  const parts = [first.city, first.state, first.country].filter(Boolean);
  if (parts.length === 0) return "No location listed";

  const base = parts.join(", ");
  const extraCount = (trial.locations?.length || 0) - 1;
  return extraCount > 0 ? `${base} +${extraCount}` : base;
}

function getScoreConfig(score: number): { tone: string } {
  if (score >= 80) return { tone: "text-green-700 bg-green-50 border-green-200" };
  if (score >= 60) return { tone: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  if (score >= 40) return { tone: "text-amber-700 bg-amber-50 border-amber-200" };
  return { tone: "text-rose-700 bg-rose-50 border-rose-200" };
}

const statusLabel: Record<string, string> = {
  met: "Met",
  not_met: "Not met",
  missing_data: "Missing",
  unknown: "Unknown",
};

export function MatchedTrialCard({
  trial,
  match,
  hasEhrConnected,
  onViewDetails,
  onShowInterest,
}: MatchedTrialCardProps) {
  const [open, setOpen] = useState(false);
  const score = getScoreConfig(match.matchScore);

  const matchedTags = useMemo(() => {
    const tags = (match.matchedConditions || [])
      .filter((item) => item.isMatch)
      .map((item) => item.trialCondition)
      .filter(Boolean);
    return Array.from(new Set(tags)).slice(0, 4);
  }, [match.matchedConditions]);

  const detailCriteria = useMemo(() => {
    return (match.criteria || []).slice(0, 6);
  }, [match.criteria]);

  const allTags = matchedTags.length > 0
    ? matchedTags
    : (trial.conditions || []).slice(0, 4);
  const visibleTags = allTags.slice(0, 3);
  const extraTagCount = allTags.length - visibleTags.length;
  const locationFlair = getLocationFlair(trial);

  return (
    <Card className="surface-panel border-border/60 shadow-sm transition-shadow duration-200 hover:shadow-md">
      <CardHeader
        className="space-y-4 pb-4 cursor-pointer"
        onClick={() => setOpen((prev) => !prev)}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant="outline" className={cn("font-semibold px-3 py-1", score.tone)}>
            {match.matchScore}% Match
          </Badge>
          <Badge
            variant="secondary"
            className="max-w-full truncate px-3 py-1 text-xs"
            title={locationFlair}
          >
            <MapPin className="mr-1 h-3 w-3" />
            {locationFlair}
          </Badge>
        </div>

        <CardTitle className="text-2xl leading-tight tracking-tight line-clamp-3">
          {trial.briefTitle}
        </CardTitle>

        <div className="flex flex-wrap gap-2">
          {visibleTags.length > 0 ? (
            visibleTags.map((tag) => (
              <Badge key={tag} variant="outline" className="bg-primary/5 text-xs">
                {tag}
              </Badge>
            ))
          ) : (
            <Badge variant="outline" className="text-xs">General eligibility match</Badge>
          )}
          {extraTagCount > 0 && (
            <Badge variant="outline" className="text-xs">+{extraTagCount} more</Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">
            <Check className="h-3.5 w-3.5" />
            <span className="ml-1 font-medium">{match.metCriteria} met</span>
          </div>
          {match.notMetCriteria > 0 && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-rose-700">
              <X className="h-3.5 w-3.5" />
              <span className="ml-1 font-medium">{match.notMetCriteria} not met</span>
            </div>
          )}
          {match.missingDataCriteria > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">
              <span className="font-medium">{match.missingDataCriteria} missing</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between rounded-lg border border-border/60 bg-muted/30 px-3">
              <span className="font-medium">Why this matched</span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-3">
            {detailCriteria.length === 0 && (
              <p className="px-2 text-sm text-muted-foreground">No detailed criteria available yet.</p>
            )}
            {detailCriteria.map((criterion) => (
              <div key={criterion.id} className="rounded-lg border bg-background p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">{criterion.name}</div>
                  <Badge variant="outline" className="text-xs">
                    {statusLabel[criterion.status] ?? criterion.status}
                  </Badge>
                </div>
                {(criterion.patientValue || criterion.requiredValue) && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {criterion.patientValue ? `You: ${criterion.patientValue}` : ""}
                    {criterion.patientValue && criterion.requiredValue ? " • " : ""}
                    {criterion.requiredValue ? `Needed: ${criterion.requiredValue}` : ""}
                  </p>
                )}
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="min-w-[140px] flex-1 gap-1.5 sm:flex-none"
            onClick={() => onShowInterest?.(trial)}
            disabled={!hasEhrConnected || !onShowInterest}
          >
            <Heart className="h-4 w-4" />
            Interested
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="min-w-[120px] flex-1 sm:flex-none"
            onClick={() => onViewDetails(trial)}
          >
            View Details
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="min-w-[160px] flex-1 gap-1.5 sm:flex-none"
            onClick={() => window.open(`https://clinicaltrials.gov/study/${trial.nctId}`, "_blank")}
          >
            ClinicalTrials.gov
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
