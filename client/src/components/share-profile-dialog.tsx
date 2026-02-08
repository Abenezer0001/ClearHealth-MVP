import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
    Heart,
    User,
    Stethoscope,
    TestTube,
    Pill,
    MapPin,
    Mail,
    Shield,
    Check,
} from "lucide-react";

interface ShareProfileDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    trial: {
        nctId: string;
        briefTitle: string;
    } | null;
    patientData: {
        name: string;
        age: number;
        sex: string;
        birthDate: string;
        location: string;
        conditions: Array<{ name: string; status: string }>;
        labs: Array<{ name: string; value: string; unit: string }>;
        medications: Array<{ name: string; status: string }>;
    } | null;
}

export function ShareProfileDialog({
    open,
    onOpenChange,
    trial,
    patientData,
}: ShareProfileDialogProps) {
    const { toast } = useToast();
    const [shareConsent, setShareConsent] = useState({
        labs: false,
        meds: false,
        location: false,
        email: false,
    });
    const [contactEmail, setContactEmail] = useState("");

    const shareMutation = useMutation({
        mutationFn: async (data: {
            ageRange: string;
            sex: string;
            diagnosisSummary: string;
            trialNctId: string;
            trialTitle: string;
            sharedFields: typeof shareConsent;
            relevantLabs?: string;
            activeMeds?: string;
            locationCity?: string;
            contactEmail?: string;
        }) => {
            const response = await fetch("/api/patient/share-profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(data),
            });
            if (!response.ok) throw new Error("Failed to submit interest");
            return response.json();
        },
        onSuccess: () => {
            toast({
                title: "Interest Submitted!",
                description: "A trial coordinator will review your profile and contact you.",
            });
            onOpenChange(false);
        },
        onError: () => {
            toast({
                title: "Submission Failed",
                description: "Please try again later.",
                variant: "destructive",
            });
        },
    });

    const handleSubmit = () => {
        if (!trial || !patientData) return;

        // Calculate age range (5-year buckets)
        const age = patientData.age;
        const lowerBound = Math.floor(age / 5) * 5;
        const ageRange = `${lowerBound}-${lowerBound + 4}`;

        // Get active conditions summary
        const activeConditions = patientData.conditions
            .filter((c) => c.status === "active")
            .map((c) => c.name)
            .slice(0, 3)
            .join(", ");

        // Get relevant labs (last 3)
        const labSummary = patientData.labs
            .slice(0, 3)
            .map((l) => `${l.name}: ${l.value} ${l.unit}`)
            .join("; ");

        // Get active meds
        const medSummary = patientData.medications
            .filter((m) => m.status !== "stopped")
            .map((m) => m.name)
            .slice(0, 5)
            .join(", ");

        shareMutation.mutate({
            ageRange,
            sex: patientData.sex,
            diagnosisSummary: activeConditions || "No conditions listed",
            trialNctId: trial.nctId,
            trialTitle: trial.briefTitle,
            sharedFields: shareConsent,
            relevantLabs: shareConsent.labs ? labSummary : undefined,
            activeMeds: shareConsent.meds ? medSummary : undefined,
            locationCity: shareConsent.location ? patientData.location : undefined,
            contactEmail: shareConsent.email ? contactEmail : undefined,
        });
    };

    if (!trial || !patientData) return null;

    const activeConditions = patientData.conditions.filter(
        (c) => c.status === "active"
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg surface-elevated">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Heart className="h-5 w-5 text-rose-500" />
                        Share Your Profile
                    </DialogTitle>
                    <DialogDescription>
                        Express interest in this trial. A coordinator will receive a summary
                        of your profile.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-4">
                    {/* Trial Info */}
                    <div className="p-3 rounded-lg border border-border/60 bg-muted/30">
                        <div className="text-xs text-muted-foreground mb-1">Trial</div>
                        <div className="font-medium text-sm leading-snug">
                            {trial.briefTitle}
                        </div>
                        <Badge variant="outline" className="mt-2 text-xs">
                            {trial.nctId}
                        </Badge>
                    </div>

                    {/* Always Shared */}
                    <div>
                        <div className="flex items-center gap-2 text-sm font-medium mb-3">
                            <Shield className="h-4 w-4 text-emerald-500" />
                            Always Shared
                        </div>
                        <div className="grid gap-2 text-sm">
                            <div className="flex items-center gap-3 p-2 rounded bg-muted/40">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Age:</span>
                                <span>{Math.floor(patientData.age / 5) * 5}-{Math.floor(patientData.age / 5) * 5 + 4} years</span>
                            </div>
                            <div className="flex items-center gap-3 p-2 rounded bg-muted/40">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Sex:</span>
                                <span className="capitalize">{patientData.sex}</span>
                            </div>
                            <div className="flex items-center gap-3 p-2 rounded bg-muted/40">
                                <Stethoscope className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Conditions:</span>
                                <span className="truncate">
                                    {activeConditions.length > 0
                                        ? activeConditions.map((c) => c.name).slice(0, 2).join(", ")
                                        : "None listed"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Optional Sharing */}
                    <div>
                        <div className="text-sm font-medium mb-3">
                            Optional (improves matching)
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-start gap-3">
                                <Checkbox
                                    id="share-labs"
                                    checked={shareConsent.labs}
                                    onCheckedChange={(checked) =>
                                        setShareConsent({ ...shareConsent, labs: !!checked })
                                    }
                                />
                                <div className="grid gap-1">
                                    <Label htmlFor="share-labs" className="flex items-center gap-2 cursor-pointer">
                                        <TestTube className="h-4 w-4 text-blue-500" />
                                        Key lab results
                                    </Label>
                                    <div className="text-xs text-muted-foreground">
                                        {patientData.labs.slice(0, 2).map((l) => l.name).join(", ")}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <Checkbox
                                    id="share-meds"
                                    checked={shareConsent.meds}
                                    onCheckedChange={(checked) =>
                                        setShareConsent({ ...shareConsent, meds: !!checked })
                                    }
                                />
                                <div className="grid gap-1">
                                    <Label htmlFor="share-meds" className="flex items-center gap-2 cursor-pointer">
                                        <Pill className="h-4 w-4 text-purple-500" />
                                        Active medications
                                    </Label>
                                    <div className="text-xs text-muted-foreground">
                                        {patientData.medications
                                            .filter((m) => m.status !== "stopped")
                                            .slice(0, 2)
                                            .map((m) => m.name)
                                            .join(", ") || "None"}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <Checkbox
                                    id="share-location"
                                    checked={shareConsent.location}
                                    onCheckedChange={(checked) =>
                                        setShareConsent({ ...shareConsent, location: !!checked })
                                    }
                                />
                                <div className="grid gap-1">
                                    <Label htmlFor="share-location" className="flex items-center gap-2 cursor-pointer">
                                        <MapPin className="h-4 w-4 text-amber-500" />
                                        Location (city only)
                                    </Label>
                                    <div className="text-xs text-muted-foreground">
                                        {patientData.location || "Not specified"}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <Checkbox
                                    id="share-email"
                                    checked={shareConsent.email}
                                    onCheckedChange={(checked) =>
                                        setShareConsent({ ...shareConsent, email: !!checked })
                                    }
                                />
                                <div className="grid gap-1.5 flex-1">
                                    <Label htmlFor="share-email" className="flex items-center gap-2 cursor-pointer">
                                        <Mail className="h-4 w-4 text-cyan-500" />
                                        Contact email
                                    </Label>
                                    {shareConsent.email && (
                                        <Input
                                            type="email"
                                            placeholder="your.email@example.com"
                                            value={contactEmail}
                                            onChange={(e) => setContactEmail(e.target.value)}
                                            className="h-8 text-sm"
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={shareMutation.isPending}
                        className="gap-2"
                    >
                        <Check className="h-4 w-4" />
                        {shareMutation.isPending ? "Submitting..." : "Submit Interest"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
