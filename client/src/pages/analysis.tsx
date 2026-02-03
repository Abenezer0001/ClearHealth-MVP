import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AnalysisStepper } from "@/components/analysis-stepper";
import { ClaimsTable } from "@/components/claims-table";
import { OutputPanel } from "@/components/output-panel";
import { FeedbackForm } from "@/components/feedback-form";
import { SeverityBadge } from "@/components/severity-badge";
import { ArrowLeft, Clock, AlertTriangle, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import type { AnalysisWithDetails } from "@shared/schema";

export default function AnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const [step, setStep] = useState("ingest");
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  const { data: analysis, isLoading, refetch, isRefetching } = useQuery<AnalysisWithDetails>({
    queryKey: ["/api/analysis", id],
    refetchInterval: (query) => {
      const data = query.state.data as AnalysisWithDetails | undefined;
      if (data?.status === "running" || data?.status === "pending") {
        return 2000;
      }
      return false;
    },
  });

  useEffect(() => {
    if (!analysis) return;

    if (analysis.status === "done") {
      setCompletedSteps(["ingest", "claims", "risk", "response"]);
      setStep("response");
    } else if (analysis.status === "running") {
      if (analysis.claims && analysis.claims.length > 0) {
        setCompletedSteps(["ingest", "claims"]);
        if (analysis.overallSeverity) {
          setCompletedSteps(["ingest", "claims", "risk"]);
          setStep("response");
        } else {
          setStep("risk");
        }
      } else {
        setCompletedSteps(["ingest"]);
        setStep("claims");
      }
    } else if (analysis.status === "pending") {
      setStep("ingest");
      setCompletedSteps([]);
    }
  }, [analysis]);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <h2 className="text-xl font-semibold mb-2">Analysis not found</h2>
            <p className="text-muted-foreground mb-4">
              The analysis you're looking for doesn't exist or has been removed.
            </p>
            <Link href="/">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Analysis Results</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <Clock className="h-3.5 w-3.5" />
              {format(new Date(analysis.createdAt), "MMM d, yyyy 'at' h:mm a")}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {analysis.status === "running" && (
            <Badge variant="outline" className="gap-1.5 text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Analyzing...
            </Badge>
          )}
          {analysis.status === "failed" && (
            <Badge variant="destructive" className="gap-1.5">
              <AlertTriangle className="h-3 w-3" />
              Failed
            </Badge>
          )}
          {analysis.overallSeverity && (
            <SeverityBadge severity={analysis.overallSeverity} />
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Analysis Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <AnalysisStepper
            currentStep={step}
            completedSteps={completedSteps}
            status={analysis.status}
          />
        </CardContent>
      </Card>

      {analysis.redFlagsDetected && analysis.redFlags && analysis.redFlags.length > 0 && (
        <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-red-700 dark:text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Safety Alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-700 dark:text-red-300 mb-3">
              This content may require urgent attention. Please seek professional medical help if applicable.
            </p>
            <div className="flex flex-wrap gap-2">
              {analysis.redFlags.map((flag, index) => (
                <Badge key={index} variant="outline" className="bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700">
                  {flag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {analysis.topics && analysis.topics.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Topics:</span>
          {analysis.topics.map((topic, index) => (
            <Badge key={index} variant="secondary">
              {topic}
            </Badge>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Original Input</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-3 bg-muted/50 rounded-md border text-sm">
            {analysis.inputText}
          </div>
          {analysis.inputUrl && (
            <a 
              href={analysis.inputUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline mt-2 inline-block"
            >
              Source: {analysis.inputUrl}
            </a>
          )}
        </CardContent>
      </Card>

      {analysis.claims && analysis.claims.length > 0 && (
        <ClaimsTable claims={analysis.claims} />
      )}

      {analysis.status === "done" && analysis.outputs && (
        <OutputPanel
          outputs={analysis.outputs}
          disclaimer={analysis.disclaimer}
          whatIsWrong={analysis.whatIsWrong}
          whatWeKnow={analysis.whatWeKnow}
          whatToDo={analysis.whatToDo}
          whenToSeekCare={analysis.whenToSeekCare}
        />
      )}

      {analysis.status === "done" && (
        <FeedbackForm analysisId={analysis.id} />
      )}
    </div>
  );
}
