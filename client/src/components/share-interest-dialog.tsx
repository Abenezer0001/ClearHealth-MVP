/**
 * Share Interest Dialog
 * Allows patients to express interest in a trial and share their profile with coordinators
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { ClinicalTrial } from "@shared/trials";
import type { ShareableFields } from "@shared/trial-matching";
import {
    TestTube,
    Pill,
    MapPin,
    Mail,
    Phone,
    Stethoscope,
    User,
    Send,
    Loader2,
    ShieldCheck,
} from "lucide-react";

interface ShareInterestDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    trial: ClinicalTrial | null;
    matchScore?: number;
    patientData?: {
        age?: number;
        sex?: string;
        conditions?: string[];
        medications?: string[];
        city?: string;
    };
}

interface ShareOption {
    id: keyof ShareableFields;
    label: string;
    description: string;
    icon: typeof TestTube;
    defaultChecked: boolean;
}

const shareOptions: ShareOption[] = [
    {
        id: "demographics",
        label: "Demographics",
        description: "Age and sex",
        icon: User,
        defaultChecked: true,
    },
    {
        id: "conditions",
        label: "Conditions",
        description: "Your diagnoses",
        icon: Stethoscope,
        defaultChecked: true,
    },
    {
        id: "labs",
        label: "Lab Results",
        description: "Recent test results",
        icon: TestTube,
        defaultChecked: false,
    },
    {
        id: "medications",
        label: "Medications",
        description: "Current medications",
        icon: Pill,
        defaultChecked: false,
    },
    {
        id: "location",
        label: "Location",
        description: "City/region",
        icon: MapPin,
        defaultChecked: false,
    },
    {
        id: "email",
        label: "Email",
        description: "Contact email",
        icon: Mail,
        defaultChecked: true,
    },
];

export function ShareInterestDialog({
    open,
    onOpenChange,
    trial,
    matchScore,
    patientData,
}: ShareInterestDialogProps) {
    const { toast } = useToast();
    const [selectedFields, setSelectedFields] = useState<ShareableFields>({
        labs: false,
        medications: false,
        location: false,
        email: true,
        phone: false,
        conditions: true,
        demographics: true,
    });
    const [message, setMessage] = useState("");

    const shareMutation = useMutation({
        mutationFn: async () => {
            if (!trial) throw new Error("No trial selected");

            const response = await fetch("/api/patient/share-profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    trialNctId: trial.nctId,
                    trialTitle: trial.briefTitle,
                    ageRange: patientData?.age ? `${patientData.age - 5}-${patientData.age + 5}` : "Unknown",
                    sex: patientData?.sex || "Unknown",
                    diagnosisSummary: patientData?.conditions?.slice(0, 3).join(", ") || "Not specified",
                    sharedFields: {
                        labs: selectedFields.labs,
                        meds: selectedFields.medications,
                        location: selectedFields.location,
                        email: selectedFields.email,
                    },
                    relevantLabs: selectedFields.labs ? "Lab data shared" : undefined,
                    activeMeds: selectedFields.medications
                        ? patientData?.medications?.join(", ")
                        : undefined,
                    locationCity: selectedFields.location ? patientData?.city : undefined,
                    message: message || undefined,
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to submit interest");
            }

            return response.json();
        },
        onSuccess: () => {
            toast({
                title: "Interest Submitted!",
                description: "A study coordinator will review your profile and reach out if you're a good fit.",
            });
            onOpenChange(false);
            setMessage("");
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message || "Failed to submit interest. Please try again.",
                variant: "destructive",
            });
        },
    });

    const toggleField = (field: keyof ShareableFields) => {
        setSelectedFields(prev => ({
            ...prev,
            [field]: !prev[field],
        }));
    };

    if (!trial) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Send className="h-5 w-5 text-primary" />
                        Express Interest
                    </DialogTitle>
                    <DialogDescription>
                        Share your profile with the study coordinator for{" "}
                        <span className="font-medium">{trial.briefTitle}</span>
                    </DialogDescription>
                </DialogHeader>

                {matchScore !== undefined && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <div className="text-2xl font-bold text-primary">{matchScore}%</div>
                        <div className="text-sm text-muted-foreground">
                            Match score based on your health profile
                        </div>
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <Label className="text-base font-medium">
                            What would you like to share?
                        </Label>
                        <p className="text-sm text-muted-foreground mb-3">
                            Select the information you're comfortable sharing with the study team.
                        </p>

                        <div className="grid grid-cols-2 gap-2">
                            {shareOptions.map((option) => {
                                const Icon = option.icon;
                                const isChecked = selectedFields[option.id];

                                return (
                                    <button
                                        key={option.id}
                                        onClick={() => toggleField(option.id)}
                                        className={`
                                            flex items-center gap-3 p-3 rounded-lg border text-left transition-all
                                            ${isChecked
                                                ? "bg-primary/5 border-primary/30"
                                                : "bg-muted/30 border-muted hover:border-muted-foreground/30"
                                            }
                                        `}
                                    >
                                        <Checkbox
                                            checked={isChecked}
                                            onCheckedChange={() => toggleField(option.id)}
                                            className="pointer-events-none"
                                        />
                                        <Icon className={`h-4 w-4 ${isChecked ? "text-primary" : "text-muted-foreground"}`} />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium">{option.label}</div>
                                            <div className="text-xs text-muted-foreground truncate">
                                                {option.description}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="message">Message (optional)</Label>
                        <Textarea
                            id="message"
                            placeholder="Tell the study team anything else you'd like them to know..."
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="mt-1.5 h-20"
                        />
                    </div>

                    <div className="flex items-start gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-sm">
                        <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                        <div className="text-green-700 dark:text-green-300">
                            Your data is shared securely. The study team will only see what you choose to share.
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={shareMutation.isPending}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => shareMutation.mutate()}
                        disabled={shareMutation.isPending}
                    >
                        {shareMutation.isPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            <>
                                <Send className="mr-2 h-4 w-4" />
                                Submit Interest
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
