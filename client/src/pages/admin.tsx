import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  Stethoscope,
  TrendingUp,
  Activity,
} from "lucide-react";

export default function AdminPage() {
  return (
    <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
          <BarChart3 className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            TrialAtlas analytics and insights
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="surface-panel">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">API Source</CardTitle>
            <Activity className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">ClinicalTrials.gov</div>
            <p className="text-xs text-muted-foreground">API v2 • Live data</p>
          </CardContent>
        </Card>

        <Card className="surface-panel">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Data Refresh</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">Real-time</div>
            <p className="text-xs text-muted-foreground">Searches query live API</p>
          </CardContent>
        </Card>

        <Card className="surface-panel">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Coverage</CardTitle>
            <Stethoscope className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">400K+ Trials</div>
            <p className="text-xs text-muted-foreground">Worldwide database</p>
          </CardContent>
        </Card>
      </div>

      <Card className="surface-panel">
        <CardHeader>
          <CardTitle className="text-lg">Available Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Condition Search</Badge>
            <Badge variant="outline">Location Filter</Badge>
            <Badge variant="outline">Recruitment Status</Badge>
            <Badge variant="outline">Study Phase</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Users can search by medical condition, filter by geographic location,
            recruitment status (e.g., Recruiting, Completed), and study phase.
          </p>
        </CardContent>
      </Card>

      <Card className="surface-panel">
        <CardHeader>
          <CardTitle className="text-lg">Data Fields Displayed</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <h4 className="font-medium text-sm mb-2">Trial Card</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Brief Title</li>
                <li>• Status Badge</li>
                <li>• Conditions</li>
                <li>• Location Summary</li>
                <li>• Enrollment Target</li>
                <li>• Sponsor Name</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-sm mb-2">Detail Modal</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Full Description</li>
                <li>• Eligibility Criteria</li>
                <li>• Age & Sex Requirements</li>
                <li>• Contact Information</li>
                <li>• All Locations</li>
                <li>• Link to ClinicalTrials.gov</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
