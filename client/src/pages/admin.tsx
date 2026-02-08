import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart3,
  Stethoscope,
  TrendingUp,
  Activity,
  Users,
  CalendarCheck2,
} from "lucide-react";

interface AdminInsightsResponse {
  summary: {
    totalLeads: number;
    uniquePatients: number;
    uniqueTrials: number;
    engaged: number;
    engagementRate: number;
  };
  statusCounts: {
    new: number;
    contacted: number;
    scheduled: number;
    not_fit: number;
  };
  topDiagnoses: Array<{
    diagnosis: string;
    count: number;
  }>;
  recentLeads: Array<{
    id: number;
    createdAt: string;
    patientName: string;
    patientEmail: string;
    diagnosisSummary: string;
    trialTitle: string;
    trialNctId: string;
    status: string;
  }>;
}

const statusLabel: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  scheduled: "Scheduled",
  not_fit: "Not a Fit",
};

export default function AdminPage() {
  const { data, isLoading, error } = useQuery<AdminInsightsResponse>({
    queryKey: ["admin-insights"],
    queryFn: async () => {
      const response = await fetch("/api/admin/insights", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to load admin insights");
      return response.json();
    },
    refetchInterval: 15000,
  });

  return (
    <div className="w-full p-6 md:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
          <BarChart3 className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Live coordinator and patient-interest insights</p>
        </div>
      </div>

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="surface-panel">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-7 w-16 mb-2" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {error && (
        <Card className="surface-panel border-destructive/50">
          <CardContent className="py-8 text-center text-destructive">
            Failed to load admin insights.
          </CardContent>
        </Card>
      )}

      {data && !isLoading && !error && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card className="surface-panel">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
                <Activity className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.summary.totalLeads}</div>
                <p className="text-xs text-muted-foreground">Shared interest submissions</p>
              </CardContent>
            </Card>

            <Card className="surface-panel">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Unique Patients</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.summary.uniquePatients}</div>
                <p className="text-xs text-muted-foreground">Distinct patients in pipeline</p>
              </CardContent>
            </Card>

            <Card className="surface-panel">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Trials Interested</CardTitle>
                <Stethoscope className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.summary.uniqueTrials}</div>
                <p className="text-xs text-muted-foreground">Distinct trial opportunities</p>
              </CardContent>
            </Card>

            <Card className="surface-panel">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Engaged Leads</CardTitle>
                <CalendarCheck2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.summary.engaged}</div>
                <p className="text-xs text-muted-foreground">Contacted or scheduled</p>
              </CardContent>
            </Card>

            <Card className="surface-panel">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Engagement Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.summary.engagementRate}%</div>
                <p className="text-xs text-muted-foreground">Engaged / total leads</p>
              </CardContent>
            </Card>
          </div>

          <Card className="surface-panel">
            <CardHeader>
              <CardTitle className="text-lg">Pipeline Status</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {Object.entries(data.statusCounts).map(([key, value]) => (
                <Badge key={key} variant="outline">
                  {statusLabel[key] || key}: {value}
                </Badge>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="surface-panel lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Recent Patient Interest</CardTitle>
              </CardHeader>
              <CardContent>
                {data.recentLeads.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No leads yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Patient</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Diagnosis</TableHead>
                        <TableHead>Trial</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.recentLeads.map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell>{new Date(lead.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell className="font-medium">{lead.patientName}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{lead.patientEmail}</TableCell>
                          <TableCell className="max-w-[240px] truncate" title={lead.diagnosisSummary}>
                            {lead.diagnosisSummary}
                          </TableCell>
                          <TableCell className="max-w-[220px] truncate" title={lead.trialTitle}>
                            {lead.trialTitle}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{statusLabel[lead.status] || lead.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card className="surface-panel">
              <CardHeader>
                <CardTitle className="text-lg">Top Diagnoses</CardTitle>
              </CardHeader>
              <CardContent>
                {data.topDiagnoses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No diagnosis data yet.</p>
                ) : (
                  <div className="space-y-2">
                    {data.topDiagnoses.map((item) => (
                      <div key={item.diagnosis} className="flex items-center justify-between rounded-md border px-3 py-2">
                        <span className="text-sm truncate pr-2">{item.diagnosis}</span>
                        <Badge variant="outline">{item.count}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

