import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
    MapPin,
    Calendar,
    Users,
    ExternalLink,
    Mail,
    Phone,
    Building,
    CheckCircle2,
    XCircle,
    AlertCircle,
} from "lucide-react";
import type { ClinicalTrial } from "@shared/trials";

interface TrialDetailModalProps {
    trial: ClinicalTrial | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// Format status for display
function formatStatus(status: string): string {
    return status
        .split("_")
        .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
        .join(" ");
}

// Format phase for display
function formatPhase(phases?: string[]): string {
    if (!phases || phases.length === 0) return "Not specified";
    return phases
        .map((p) =>
            p.replace("PHASE", "Phase ").replace("EARLY_", "Early ").replace("NA", "N/A")
        )
        .join(", ");
}

// Parse eligibility criteria into sections
function parseEligibilityCriteria(criteria?: string): {
    inclusion: string[];
    exclusion: string[];
} {
    if (!criteria) return { inclusion: [], exclusion: [] };

    const lines = criteria.split("\n").filter((line) => line.trim());
    const inclusion: string[] = [];
    const exclusion: string[] = [];
    let currentSection: "inclusion" | "exclusion" | null = null;

    for (const line of lines) {
        const lower = line.toLowerCase();
        if (lower.includes("inclusion criteria")) {
            currentSection = "inclusion";
            continue;
        }
        if (lower.includes("exclusion criteria")) {
            currentSection = "exclusion";
            continue;
        }

        const cleaned = line.replace(/^[-•*\s]+/, "").trim();
        if (cleaned && currentSection === "inclusion") {
            inclusion.push(cleaned);
        } else if (cleaned && currentSection === "exclusion") {
            exclusion.push(cleaned);
        }
    }

    return { inclusion, exclusion };
}

export function TrialDetailModal({
    trial,
    open,
    onOpenChange,
}: TrialDetailModalProps) {
    if (!trial) return null;

    const eligibility = parseEligibilityCriteria(trial.eligibility?.criteria);
    const hasContacts =
        (trial.centralContacts && trial.centralContacts.length > 0) ||
        trial.locations?.some((loc) => loc.contacts && loc.contacts.length > 0);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden">
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                        <Badge
                            variant="outline"
                            className={
                                trial.overallStatus === "RECRUITING"
                                    ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/20"
                                    : "bg-slate-500/15 text-slate-600 border-slate-500/20"
                            }
                        >
                            {formatStatus(trial.overallStatus)}
                        </Badge>
                        <Badge variant="secondary">{trial.nctId}</Badge>
                        {trial.phases && trial.phases.length > 0 && (
                            <Badge variant="outline">{formatPhase(trial.phases)}</Badge>
                        )}
                    </div>
                    <DialogTitle className="text-xl font-semibold leading-snug pr-8">
                        {trial.briefTitle}
                    </DialogTitle>
                    {trial.sponsor?.name && (
                        <DialogDescription className="flex items-center gap-2 mt-2">
                            <Building className="h-4 w-4" />
                            Sponsor: {trial.sponsor.name}
                        </DialogDescription>
                    )}
                </DialogHeader>

                <ScrollArea className="max-h-[60vh]">
                    <div className="px-6 py-5 space-y-6">
                        {/* Quick Stats */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {trial.enrollmentCount && (
                                <div className="flex items-center gap-2 text-sm">
                                    <Users className="h-4 w-4 text-primary" />
                                    <div>
                                        <p className="font-medium">{trial.enrollmentCount.toLocaleString()}</p>
                                        <p className="text-xs text-muted-foreground">Target</p>
                                    </div>
                                </div>
                            )}
                            {trial.startDate && (
                                <div className="flex items-center gap-2 text-sm">
                                    <Calendar className="h-4 w-4 text-primary" />
                                    <div>
                                        <p className="font-medium">{trial.startDate}</p>
                                        <p className="text-xs text-muted-foreground">Start Date</p>
                                    </div>
                                </div>
                            )}
                            {trial.completionDate && (
                                <div className="flex items-center gap-2 text-sm">
                                    <Calendar className="h-4 w-4 text-primary" />
                                    <div>
                                        <p className="font-medium">{trial.completionDate}</p>
                                        <p className="text-xs text-muted-foreground">Est. Completion</p>
                                    </div>
                                </div>
                            )}
                            {trial.studyType && (
                                <div className="flex items-center gap-2 text-sm">
                                    <AlertCircle className="h-4 w-4 text-primary" />
                                    <div>
                                        <p className="font-medium">{trial.studyType}</p>
                                        <p className="text-xs text-muted-foreground">Study Type</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <Separator />

                        {/* Conditions */}
                        {trial.conditions && trial.conditions.length > 0 && (
                            <div>
                                <h4 className="font-semibold text-sm mb-2">Conditions</h4>
                                <div className="flex flex-wrap gap-2">
                                    {trial.conditions.map((condition, idx) => (
                                        <Badge key={idx} variant="outline" className="bg-primary/5">
                                            {condition}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Summary */}
                        {trial.briefSummary && (
                            <div>
                                <h4 className="font-semibold text-sm mb-2">Summary</h4>
                                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                    {trial.briefSummary}
                                </p>
                            </div>
                        )}

                        <Separator />

                        {/* Eligibility */}
                        <div>
                            <h4 className="font-semibold text-sm mb-3">Eligibility</h4>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-sm">
                                {trial.eligibility?.sex && (
                                    <div>
                                        <p className="text-xs text-muted-foreground">Sex</p>
                                        <p className="font-medium">{trial.eligibility.sex}</p>
                                    </div>
                                )}
                                {trial.eligibility?.minimumAge && (
                                    <div>
                                        <p className="text-xs text-muted-foreground">Min Age</p>
                                        <p className="font-medium">{trial.eligibility.minimumAge}</p>
                                    </div>
                                )}
                                {trial.eligibility?.maximumAge && (
                                    <div>
                                        <p className="text-xs text-muted-foreground">Max Age</p>
                                        <p className="font-medium">{trial.eligibility.maximumAge}</p>
                                    </div>
                                )}
                                <div>
                                    <p className="text-xs text-muted-foreground">Healthy Volunteers</p>
                                    <p className="font-medium">
                                        {trial.eligibility?.healthyVolunteers ? "Yes" : "No"}
                                    </p>
                                </div>
                            </div>

                            {eligibility.inclusion.length > 0 && (
                                <div className="mb-4">
                                    <h5 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                        Inclusion Criteria
                                    </h5>
                                    <ul className="space-y-1.5">
                                        {eligibility.inclusion.slice(0, 5).map((item, idx) => (
                                            <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                                                <span className="text-emerald-500 mt-1">•</span>
                                                {item}
                                            </li>
                                        ))}
                                        {eligibility.inclusion.length > 5 && (
                                            <li className="text-xs text-muted-foreground italic">
                                                +{eligibility.inclusion.length - 5} more criteria...
                                            </li>
                                        )}
                                    </ul>
                                </div>
                            )}

                            {eligibility.exclusion.length > 0 && (
                                <div>
                                    <h5 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                        <XCircle className="h-3 w-3 text-red-500" />
                                        Exclusion Criteria
                                    </h5>
                                    <ul className="space-y-1.5">
                                        {eligibility.exclusion.slice(0, 5).map((item, idx) => (
                                            <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                                                <span className="text-red-500 mt-1">•</span>
                                                {item}
                                            </li>
                                        ))}
                                        {eligibility.exclusion.length > 5 && (
                                            <li className="text-xs text-muted-foreground italic">
                                                +{eligibility.exclusion.length - 5} more criteria...
                                            </li>
                                        )}
                                    </ul>
                                </div>
                            )}
                        </div>

                        <Separator />

                        {/* Locations */}
                        {trial.locations && trial.locations.length > 0 && (
                            <div>
                                <h4 className="font-semibold text-sm mb-3">Locations</h4>
                                <div className="space-y-3">
                                    {trial.locations.slice(0, 5).map((loc, idx) => (
                                        <div key={idx} className="flex items-start gap-2 text-sm">
                                            <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                            <div>
                                                {loc.facility && <p className="font-medium">{loc.facility}</p>}
                                                <p className="text-muted-foreground">
                                                    {[loc.city, loc.state, loc.country].filter(Boolean).join(", ")}
                                                </p>
                                                {loc.status && (
                                                    <Badge variant="outline" className="text-xs mt-1">
                                                        {formatStatus(loc.status)}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {trial.locations.length > 5 && (
                                        <p className="text-xs text-muted-foreground italic">
                                            +{trial.locations.length - 5} more locations...
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Contact Information */}
                        {hasContacts && (
                            <>
                                <Separator />
                                <div>
                                    <h4 className="font-semibold text-sm mb-3">Contact Information</h4>
                                    <div className="space-y-3">
                                        {trial.centralContacts?.map((contact, idx) => (
                                            <div key={idx} className="p-3 rounded-lg bg-muted/40 space-y-2">
                                                <p className="font-medium text-sm">{contact.name}</p>
                                                {contact.role && (
                                                    <p className="text-xs text-muted-foreground">{contact.role}</p>
                                                )}
                                                <div className="flex flex-wrap gap-3">
                                                    {contact.email && (
                                                        <a
                                                            href={`mailto:${contact.email}`}
                                                            className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                                                        >
                                                            <Mail className="h-3.5 w-3.5" />
                                                            {contact.email}
                                                        </a>
                                                    )}
                                                    {contact.phone && (
                                                        <a
                                                            href={`tel:${contact.phone}`}
                                                            className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                                                        >
                                                            <Phone className="h-3.5 w-3.5" />
                                                            {contact.phone}
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </ScrollArea>

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                        Always consult with a healthcare provider before participating in any clinical trial.
                    </p>
                    <Button asChild>
                        <a
                            href={`https://clinicaltrials.gov/study/${trial.nctId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="gap-2"
                        >
                            <ExternalLink className="h-4 w-4" />
                            View on ClinicalTrials.gov
                        </a>
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
