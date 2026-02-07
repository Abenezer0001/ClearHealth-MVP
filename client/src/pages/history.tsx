import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SeverityBadge } from "@/components/severity-badge";
import { History, Search, Clock, ArrowRight, FileText } from "lucide-react";
import { format } from "date-fns";
import type { Analysis } from "@shared/schema";

export default function HistoryPage() {
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const { data: analyses, isLoading } = useQuery<Analysis[]>({
    queryKey: ["/api/analyses"],
  });

  const filteredAnalyses = analyses?.filter((analysis) => {
    const matchesSearch = search === "" || 
      analysis.inputText.toLowerCase().includes(search.toLowerCase()) ||
      analysis.topics?.some(t => t.toLowerCase().includes(search.toLowerCase()));
    
    const matchesSeverity = severityFilter === "all" || 
      analysis.overallSeverity === severityFilter;

    return matchesSearch && matchesSeverity;
  });

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
          <History className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Analysis History</h1>
          <p className="text-muted-foreground">
            View your past misinformation analyses
          </p>
        </div>
      </div>

      <Card className="surface-panel">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by content or topic..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="input-search-history"
              />
            </div>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-severity-filter">
                <SelectValue placeholder="Filter by severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="low">Low Risk</SelectItem>
                <SelectItem value="medium">Medium Risk</SelectItem>
                <SelectItem value="high">High Risk</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : filteredAnalyses && filteredAnalyses.length > 0 ? (
        <div className="space-y-4">
          {filteredAnalyses.map((analysis) => (
            <Link key={analysis.id} href={`/analysis/${analysis.id}`}>
              <Card className="surface-panel hover-elevate cursor-pointer transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {format(new Date(analysis.createdAt), "MMM d, yyyy 'at' h:mm a")}
                        {analysis.status === "running" && (
                          <Badge variant="outline" className="text-amber-600 border-amber-300">
                            In Progress
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm line-clamp-2">{analysis.inputText}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        {analysis.overallSeverity && (
                          <SeverityBadge severity={analysis.overallSeverity} size="sm" />
                        )}
                        {analysis.topics?.slice(0, 3).map((topic, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {topic}
                          </Badge>
                        ))}
                        {analysis.topics && analysis.topics.length > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{analysis.topics.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="surface-panel">
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No analyses found</h3>
            <p className="text-muted-foreground mb-4">
              {search || severityFilter !== "all" 
                ? "Try adjusting your search or filter criteria."
                : "Start by analyzing some health claims."}
            </p>
            <Link href="/">
              <Button className="gap-2" data-testid="button-start-analyzing">
                <Search className="h-4 w-4" />
                Start Analyzing
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
