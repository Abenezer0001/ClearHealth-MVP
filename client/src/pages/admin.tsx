import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SeverityBadge } from "@/components/severity-badge";
import { 
  BarChart3, 
  AlertTriangle, 
  TrendingUp, 
  MessageSquare, 
  Clock,
  ArrowRight 
} from "lucide-react";
import { format } from "date-fns";

interface AdminStats {
  totalAnalyses: number;
  criticalCount: number;
  topTopics: { topic: string; count: number }[];
  severityDistribution: { severity: string; count: number }[];
  recentCritical: {
    id: number;
    inputText: string;
    createdAt: string;
    topics: string[];
  }[];
  feedbackSummary: {
    helpful: number;
    notHelpful: number;
    missingSources: number;
  };
}

export default function AdminPage() {
  const { data: stats, isLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
  });

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const severityColors = {
    low: "bg-emerald-500",
    medium: "bg-amber-500",
    high: "bg-orange-500",
    critical: "bg-red-500",
  };

  const totalSeverity = stats?.severityDistribution?.reduce((acc, s) => acc + s.count, 0) || 1;

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
          <BarChart3 className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Insights and statistics about health misinformation
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="surface-panel">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Analyses</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.totalAnalyses || 0}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card className="surface-panel">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{stats?.criticalCount || 0}</div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>

        <Card className="surface-panel">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Helpful Rating</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">
              {stats?.feedbackSummary?.helpful || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              vs {stats?.feedbackSummary?.notHelpful || 0} not helpful
            </p>
          </CardContent>
        </Card>

        <Card className="surface-panel">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Top Topic</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold truncate">
              {stats?.topTopics?.[0]?.topic || "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.topTopics?.[0]?.count || 0} occurrences
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="surface-panel">
          <CardHeader>
            <CardTitle className="text-lg">Severity Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats?.severityDistribution?.map((item) => (
              <div key={item.severity} className="space-y-2">
                <div className="flex items-center justify-between">
                  <SeverityBadge severity={item.severity} size="sm" />
                  <span className="text-sm font-medium">{item.count}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${severityColors[item.severity as keyof typeof severityColors] || "bg-primary"}`}
                    style={{ width: `${(item.count / totalSeverity) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {(!stats?.severityDistribution || stats.severityDistribution.length === 0) && (
              <p className="text-center text-muted-foreground py-4">No data available</p>
            )}
          </CardContent>
        </Card>

        <Card className="surface-panel">
          <CardHeader>
            <CardTitle className="text-lg">Top Misinformation Topics</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.topTopics && stats.topTopics.length > 0 ? (
              <div className="space-y-3">
                {stats.topTopics.slice(0, 8).map((item, index) => (
                  <div key={item.topic} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {index + 1}
                      </span>
                      <span className="font-medium">{item.topic}</span>
                    </div>
                    <Badge variant="secondary">{item.count}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">No data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="surface-panel">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Recent Critical Analyses
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.recentCritical && stats.recentCritical.length > 0 ? (
            <div className="space-y-4">
              {stats.recentCritical.map((analysis) => (
                <Link key={analysis.id} href={`/analysis/${analysis.id}`}>
                  <div className="p-4 border rounded-md hover-elevate cursor-pointer">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                          <Clock className="h-3.5 w-3.5" />
                          {format(new Date(analysis.createdAt), "MMM d, yyyy 'at' h:mm a")}
                        </div>
                        <p className="text-sm line-clamp-2">{analysis.inputText}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {analysis.topics?.slice(0, 3).map((topic, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {topic}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              No critical analyses yet. That's a good sign!
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
