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
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
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
    ExternalLink,
} from "lucide-react";

interface Lead {
    id: number;
    patientUserId: string;
    patientName?: string;
    patientEmail?: string;
    ageRange: string;
    sex: string;
    diagnosisSummary: string;
    trialNctId: string;
    trialTitle: string;
    sharedFields: {
        labs: boolean;
        medications?: boolean;
        meds?: boolean; // legacy compatibility
        location: boolean;
        email: boolean;
        conditions?: boolean;
        demographics?: boolean;
    };
    relevantLabs?: string;
    relevantLabItems?: Array<{
        name: string;
        value?: string;
        unit?: string;
        effectiveDate?: string;
    }>;
    activeMeds?: string;
    locationCity?: string;
    contactEmail?: string;
    status: string;
    coordinatorNotes?: string;
    createdAt: string;
}

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

    const hasSharedMeds = (lead: Lead): boolean =>
        Boolean(lead.sharedFields.medications ?? lead.sharedFields.meds);

    const parseLegacyLabText = (text?: string): Array<{ name: string; value?: string; unit?: string; effectiveDate?: string }> => {
        if (!text) return [];
        return text
            .split(";")
            .map((part) => part.trim())
            .filter(Boolean)
            .map((part) => {
                const idx = part.indexOf(":");
                if (idx === -1) return { name: part };
                return {
                    name: part.slice(0, idx).trim(),
                    value: part.slice(idx + 1).trim(),
                };
            });
    };

    const formatDate = (value?: string): string => {
        if (!value) return "";
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return value;
        return parsed.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    };

    return (
        <div className="w-full p-6 md:p-8 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between" data-testid="section-coordinator-header">
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="grid-coordinator-stats">
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
            <Card className="surface-panel" data-testid="card-coordinator-leads">
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
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredLeads.map((lead) => (
                                    <TableRow
                                        key={lead.id}
                                        className="cursor-pointer hover:bg-muted/40"
                                        onClick={() => setSelectedLead(lead)}
                                    >
                                        <TableCell className="text-sm text-muted-foreground">
                                            {new Date(lead.createdAt).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-start gap-2">
                                                <User className="h-4 w-4 text-muted-foreground" />
                                                <div>
                                                    <div className="font-medium">
                                                        {lead.patientName || "Unknown Patient"}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {lead.patientEmail || "No email"}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {lead.ageRange}, {lead.sex}
                                                    </div>
                                                </div>
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
                                                    <span title="Labs shared">
                                                        <TestTube className="h-4 w-4 text-blue-500" />
                                                    </span>
                                                )}
                                                {hasSharedMeds(lead) && (
                                                    <span title="Meds shared">
                                                        <Pill className="h-4 w-4 text-purple-500" />
                                                    </span>
                                                )}
                                                {lead.sharedFields.conditions && (
                                                    <span title="Conditions shared">
                                                        <Stethoscope className="h-4 w-4 text-emerald-500" />
                                                    </span>
                                                )}
                                                {lead.sharedFields.demographics && (
                                                    <span title="Demographics shared">
                                                        <User className="h-4 w-4 text-indigo-500" />
                                                    </span>
                                                )}
                                                {lead.sharedFields.location && (
                                                    <span title="Location shared">
                                                        <MapPin className="h-4 w-4 text-amber-500" />
                                                    </span>
                                                )}
                                                {lead.sharedFields.email && (
                                                    <span title="Email shared">
                                                        <Mail className="h-4 w-4 text-cyan-500" />
                                                    </span>
                                                )}
                                                {!lead.sharedFields.labs &&
                                                    !hasSharedMeds(lead) &&
                                                    !lead.sharedFields.location &&
                                                    !lead.sharedFields.email &&
                                                    !lead.sharedFields.conditions &&
                                                    !lead.sharedFields.demographics && (
                                                        <span className="text-xs text-muted-foreground">
                                                            Basic only
                                                        </span>
                                                    )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div onClick={(e) => e.stopPropagation()}>
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
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Lead Detail Sidebar */}
            <Sheet open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
                <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
                    <SheetHeader>
                        <SheetTitle className="flex items-center gap-2">
                            <User className="h-5 w-5 text-muted-foreground" />
                            Lead Details
                        </SheetTitle>
                        <SheetDescription>
                            Patient profile and shared medical details for coordinator follow-up.
                        </SheetDescription>
                    </SheetHeader>

                    {selectedLead && (
                        <div className="space-y-4 mt-6">
                            {/* Patient Info */}
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <Label className="text-muted-foreground">Patient</Label>
                                    <div className="font-medium">{selectedLead.patientName || "Unknown Patient"}</div>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground">Email</Label>
                                    <div className="font-medium">{selectedLead.patientEmail || "No email"}</div>
                                </div>
                            </div>

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
                                    {selectedLead.sharedFields.labs && (((selectedLead.relevantLabItems?.length || 0) > 0) || Boolean(selectedLead.relevantLabs)) && (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <TestTube className="h-4 w-4 text-blue-500" />
                                                <span className="text-muted-foreground">Labs:</span>
                                            </div>
                                            {(selectedLead.relevantLabItems && selectedLead.relevantLabItems.length > 0
                                                ? selectedLead.relevantLabItems
                                                : parseLegacyLabText(selectedLead.relevantLabs)
                                            ).slice(0, 20).map((lab, idx) => (
                                                <div
                                                    key={`${lab.name}-${idx}`}
                                                    className="flex items-center justify-between rounded-lg border border-border bg-background p-2.5"
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-sm font-medium truncate">{lab.name}</div>
                                                        {lab.effectiveDate && (
                                                            <div className="text-xs text-muted-foreground">
                                                                {formatDate(lab.effectiveDate)}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {lab.value && (
                                                        <div className="ml-3 text-right text-sm font-mono font-medium">
                                                            {`${lab.value}${lab.unit ? ` ${lab.unit}` : ""}`}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            {((selectedLead.relevantLabItems?.length || 0) > 20) && (
                                                <div className="text-xs text-muted-foreground">
                                                    Showing 20 of {selectedLead.relevantLabItems?.length} shared labs
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {hasSharedMeds(selectedLead) && selectedLead.activeMeds && (
                                        <div className="flex items-start gap-2">
                                            <Pill className="h-4 w-4 text-purple-500 mt-0.5" />
                                            <div>
                                                <span className="text-muted-foreground">Meds: </span>
                                                {selectedLead.activeMeds}
                                            </div>
                                        </div>
                                    )}
                                    {selectedLead.sharedFields.demographics && (
                                        <div className="flex items-start gap-2">
                                            <User className="h-4 w-4 text-indigo-500 mt-0.5" />
                                            <div>
                                                <span className="text-muted-foreground">Demographics: </span>
                                                {selectedLead.ageRange}, {selectedLead.sex}
                                            </div>
                                        </div>
                                    )}
                                    {selectedLead.sharedFields.conditions && (
                                        <div className="flex items-start gap-2">
                                            <Stethoscope className="h-4 w-4 text-emerald-500 mt-0.5" />
                                            <div>
                                                <span className="text-muted-foreground">Conditions: </span>
                                                {selectedLead.diagnosisSummary}
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
                                        !hasSharedMeds(selectedLead) &&
                                        !selectedLead.sharedFields.location &&
                                        !selectedLead.sharedFields.email &&
                                        !selectedLead.sharedFields.conditions &&
                                        !selectedLead.sharedFields.demographics && (
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
                </SheetContent>
            </Sheet>
        </div>
    );
}
