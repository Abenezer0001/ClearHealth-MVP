import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
    Inbox,
    User,
    Stethoscope,
    TestTube,
    Pill,
    MapPin,
    Mail,
    Check,
    X,
    Clock,
    Phone,
    ExternalLink,
    FileText,
} from "lucide-react";

interface Lead {
    id: number;
    patientUserId: string;
    ageRange: string;
    sex: string;
    diagnosisSummary: string;
    trialNctId: string;
    trialTitle: string;
    sharedFields: { labs: boolean; meds: boolean; location: boolean; email: boolean };
    relevantLabs?: string;
    activeMeds?: string;
    locationCity?: string;
    contactEmail?: string;
    status: string;
    coordinatorNotes?: string;
    createdAt: string;
}

const statusColors: Record<string, string> = {
    new: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    contacted: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    scheduled: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    not_fit: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const statusLabels: Record<string, string> = {
    new: "New",
    contacted: "Contacted",
    scheduled: "Scheduled",
    not_fit: "Not a Fit",
};

export default function CoordinatorInboxPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>("all");

    const { data, isLoading, error } = useQuery({
        queryKey: ["coordinator-leads"],
        queryFn: async () => {
            const response = await fetch("/api/coordinator/leads", {
                credentials: "include",
            });
            if (!response.ok) throw new Error("Failed to fetch leads");
            return response.json();
        },
        refetchInterval: 10000, // Refresh every 10 seconds
    });

    const updateStatusMutation = useMutation({
        mutationFn: async ({
            leadId,
            status,
            notes,
        }: {
            leadId: number;
            status?: string;
            notes?: string;
        }) => {
            const response = await fetch(`/api/coordinator/leads/${leadId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ status, coordinatorNotes: notes }),
            });
            if (!response.ok) throw new Error("Failed to update status");
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["coordinator-leads"] });
            toast({ title: "Lead updated" });
        },
        onError: () => {
            toast({ title: "Update failed", variant: "destructive" });
        },
    });

    const leads: Lead[] = data?.leads || [];
    const filteredLeads =
        filterStatus === "all"
            ? leads
            : leads.filter((l) => l.status === filterStatus);

    const counts = {
        all: leads.length,
        new: leads.filter((l) => l.status === "new").length,
        contacted: leads.filter((l) => l.status === "contacted").length,
        scheduled: leads.filter((l) => l.status === "scheduled").length,
        not_fit: leads.filter((l) => l.status === "not_fit").length,
    };

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
                        <Inbox className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">Coordinator Inbox</h1>
                        <p className="text-muted-foreground text-sm">
                            Patients who expressed interest in trials
                        </p>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {["all", "new", "contacted", "scheduled", "not_fit"].map((status) => (
                    <Card
                        key={status}
                        className={`cursor-pointer transition-colors ${filterStatus === status
                                ? "ring-2 ring-primary"
                                : "hover:bg-muted/50"
                            }`}
                        onClick={() => setFilterStatus(status)}
                    >
                        <CardContent className="p-4">
                            <div className="text-2xl font-bold">
                                {counts[status as keyof typeof counts]}
                            </div>
                            <div className="text-sm text-muted-foreground capitalize">
                                {status === "all" ? "All Leads" : statusLabels[status] || status}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Leads Table */}
            <Card className="surface-panel">
                <CardHeader>
                    <CardTitle className="text-lg">
                        {filterStatus === "all" ? "All Leads" : statusLabels[filterStatus]}
                        <Badge variant="secondary" className="ml-2">
                            {filteredLeads.length}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Loading leads...
                        </div>
                    ) : error ? (
                        <div className="text-center py-8 text-destructive">
                            Failed to load leads
                        </div>
                    ) : filteredLeads.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Inbox className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p>No leads yet</p>
                            <p className="text-sm">
                                Leads will appear when patients express interest
                            </p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Patient</TableHead>
                                    <TableHead>Diagnosis</TableHead>
                                    <TableHead>Trial</TableHead>
                                    <TableHead>Shared</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredLeads.map((lead) => (
                                    <TableRow key={lead.id}>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {new Date(lead.createdAt).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <User className="h-4 w-4 text-muted-foreground" />
                                                <span>
                                                    {lead.ageRange}, {lead.sex}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="max-w-[200px] truncate" title={lead.diagnosisSummary}>
                                                {lead.diagnosisSummary}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="max-w-[180px] truncate" title={lead.trialTitle}>
                                                {lead.trialTitle}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {lead.trialNctId}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-1">
                                                {lead.sharedFields.labs && (
                                                    <TestTube className="h-4 w-4 text-blue-500" title="Labs shared" />
                                                )}
                                                {lead.sharedFields.meds && (
                                                    <Pill className="h-4 w-4 text-purple-500" title="Meds shared" />
                                                )}
                                                {lead.sharedFields.location && (
                                                    <MapPin className="h-4 w-4 text-amber-500" title="Location shared" />
                                                )}
                                                {lead.sharedFields.email && (
                                                    <Mail className="h-4 w-4 text-cyan-500" title="Email shared" />
                                                )}
                                                {!lead.sharedFields.labs &&
                                                    !lead.sharedFields.meds &&
                                                    !lead.sharedFields.location &&
                                                    !lead.sharedFields.email && (
                                                        <span className="text-xs text-muted-foreground">
                                                            Basic only
                                                        </span>
                                                    )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={lead.status}
                                                onValueChange={(value) =>
                                                    updateStatusMutation.mutate({
                                                        leadId: lead.id,
                                                        status: value,
                                                    })
                                                }
                                            >
                                                <SelectTrigger className="w-[130px] h-8">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="new">New</SelectItem>
                                                    <SelectItem value="contacted">Contacted</SelectItem>
                                                    <SelectItem value="scheduled">Scheduled</SelectItem>
                                                    <SelectItem value="not_fit">Not a Fit</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setSelectedLead(lead)}
                                            >
                                                <FileText className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Lead Detail Dialog */}
            <Dialog open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
                <DialogContent className="sm:max-w-lg surface-elevated">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <User className="h-5 w-5 text-muted-foreground" />
                            Lead Details
                        </DialogTitle>
                    </DialogHeader>

                    {selectedLead && (
                        <div className="space-y-4">
                            {/* Patient Info */}
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <Label className="text-muted-foreground">Age Range</Label>
                                    <div className="font-medium">{selectedLead.ageRange}</div>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground">Sex</Label>
                                    <div className="font-medium capitalize">{selectedLead.sex}</div>
                                </div>
                            </div>

                            <div>
                                <Label className="text-muted-foreground text-sm">Diagnosis Summary</Label>
                                <div className="font-medium">{selectedLead.diagnosisSummary}</div>
                            </div>

                            {/* What was shared panel */}
                            <div className="p-3 rounded-lg border bg-muted/30">
                                <div className="text-sm font-medium mb-2 flex items-center gap-2">
                                    <Check className="h-4 w-4 text-emerald-500" />
                                    What the patient shared
                                </div>
                                <div className="grid gap-2 text-sm">
                                    {selectedLead.sharedFields.labs && selectedLead.relevantLabs && (
                                        <div className="flex items-start gap-2">
                                            <TestTube className="h-4 w-4 text-blue-500 mt-0.5" />
                                            <div>
                                                <span className="text-muted-foreground">Labs: </span>
                                                {selectedLead.relevantLabs}
                                            </div>
                                        </div>
                                    )}
                                    {selectedLead.sharedFields.meds && selectedLead.activeMeds && (
                                        <div className="flex items-start gap-2">
                                            <Pill className="h-4 w-4 text-purple-500 mt-0.5" />
                                            <div>
                                                <span className="text-muted-foreground">Meds: </span>
                                                {selectedLead.activeMeds}
                                            </div>
                                        </div>
                                    )}
                                    {selectedLead.sharedFields.location && selectedLead.locationCity && (
                                        <div className="flex items-center gap-2">
                                            <MapPin className="h-4 w-4 text-amber-500" />
                                            <span className="text-muted-foreground">Location: </span>
                                            {selectedLead.locationCity}
                                        </div>
                                    )}
                                    {selectedLead.sharedFields.email && selectedLead.contactEmail && (
                                        <div className="flex items-center gap-2">
                                            <Mail className="h-4 w-4 text-cyan-500" />
                                            <a
                                                href={`mailto:${selectedLead.contactEmail}`}
                                                className="text-primary hover:underline"
                                            >
                                                {selectedLead.contactEmail}
                                            </a>
                                        </div>
                                    )}
                                    {!selectedLead.sharedFields.labs &&
                                        !selectedLead.sharedFields.meds &&
                                        !selectedLead.sharedFields.location &&
                                        !selectedLead.sharedFields.email && (
                                            <div className="text-muted-foreground">
                                                Only basic info shared (age, sex, diagnosis)
                                            </div>
                                        )}
                                </div>
                            </div>

                            {/* Trial */}
                            <div>
                                <Label className="text-muted-foreground text-sm">Trial Interested In</Label>
                                <div className="font-medium">{selectedLead.trialTitle}</div>
                                <a
                                    href={`https://clinicaltrials.gov/study/${selectedLead.trialNctId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                                >
                                    {selectedLead.trialNctId}
                                    <ExternalLink className="h-3 w-3" />
                                </a>
                            </div>

                            {/* Notes */}
                            <div>
                                <Label className="text-sm">Coordinator Notes</Label>
                                <Textarea
                                    placeholder="Add notes about this lead..."
                                    value={selectedLead.coordinatorNotes || ""}
                                    onChange={(e) =>
                                        setSelectedLead({ ...selectedLead, coordinatorNotes: e.target.value })
                                    }
                                    className="mt-1"
                                    rows={3}
                                />
                                <Button
                                    size="sm"
                                    className="mt-2"
                                    onClick={() =>
                                        updateStatusMutation.mutate({
                                            leadId: selectedLead.id,
                                            notes: selectedLead.coordinatorNotes,
                                        })
                                    }
                                >
                                    Save Notes
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
