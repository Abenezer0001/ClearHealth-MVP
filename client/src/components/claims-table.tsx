import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SeverityBadge } from "@/components/severity-badge";
import { StanceBadge } from "@/components/stance-badge";
import { ExternalLink, FileText } from "lucide-react";
import type { Claim, Citation } from "@shared/schema";

interface ClaimsTableProps {
  claims: (Claim & { citations: Citation[] })[];
}

export function ClaimsTable({ claims }: ClaimsTableProps) {
  if (claims.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          No claims extracted yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Extracted Claims ({claims.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="space-y-2">
          {claims.map((claim, index) => (
            <AccordionItem
              key={claim.id}
              value={`claim-${claim.id}`}
              className="border rounded-md px-4"
            >
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-start gap-4 text-left flex-1 pr-4">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                    {index + 1}
                  </span>
                  <div className="flex-1 space-y-2">
                    <p className="text-sm font-medium leading-snug">
                      {claim.claimText}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <StanceBadge stance={claim.stance} />
                      <SeverityBadge severity={claim.severity} size="sm" />
                      {claim.topic && (
                        <Badge variant="outline" className="text-xs">
                          {claim.topic}
                        </Badge>
                      )}
                      {claim.stanceConfidence && (
                        <span className="text-xs text-muted-foreground">
                          {claim.stanceConfidence}% confidence
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="space-y-4 pl-10">
                  {claim.stanceExplanation && (
                    <div>
                      <h4 className="text-sm font-medium mb-1">Analysis</h4>
                      <p className="text-sm text-muted-foreground">
                        {claim.stanceExplanation}
                      </p>
                    </div>
                  )}

                  {claim.riskReason && (
                    <div>
                      <h4 className="text-sm font-medium mb-1">Risk Assessment</h4>
                      <p className="text-sm text-muted-foreground">
                        {claim.riskReason}
                      </p>
                    </div>
                  )}

                  {claim.citations && claim.citations.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Sources</h4>
                      <div className="space-y-2">
                        {claim.citations.map((citation) => (
                          <div
                            key={citation.id}
                            className="p-3 bg-muted/50 rounded-md border text-sm"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-xs">
                                    {citation.sourceOrg}
                                  </Badge>
                                  <span className="font-medium">
                                    {citation.sourceTitle}
                                  </span>
                                </div>
                                {citation.snippet && (
                                  <p className="text-muted-foreground italic">
                                    "{citation.snippet}"
                                  </p>
                                )}
                              </div>
                              {citation.sourceUrl && (
                                <a
                                  href={citation.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="shrink-0 text-primary hover:underline"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              )}
                            </div>
                            {citation.relevance && (
                              <div className="mt-2 flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  Relevance:
                                </span>
                                <Progress
                                  value={citation.relevance}
                                  className="h-1.5 w-20"
                                />
                                <span className="text-xs text-muted-foreground">
                                  {citation.relevance}%
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
