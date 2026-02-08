import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Search,
    Loader2,
    Stethoscope,
    MapPin,
    Filter,
    AlertCircle,
    Sparkles
} from "lucide-react";
import { TrialCard } from "@/components/trial-card";
import { TrialDetailModal } from "@/components/trial-detail-modal";
import { ShareProfileDialog } from "@/components/share-profile-dialog";
import type { ClinicalTrial, TrialSearchResponse } from "@shared/trials";

// Status options for filtering
const statusOptions = [
    { value: "RECRUITING", label: "Recruiting" },
    { value: "NOT_YET_RECRUITING", label: "Not Yet Recruiting" },
    { value: "ACTIVE_NOT_RECRUITING", label: "Active, Not Recruiting" },
    { value: "ENROLLING_BY_INVITATION", label: "Enrolling by Invitation" },
    { value: "COMPLETED", label: "Completed" },
];

// Phase options for filtering
const phaseOptions = [
    { value: "EARLY_PHASE1", label: "Early Phase 1" },
    { value: "PHASE1", label: "Phase 1" },
    { value: "PHASE2", label: "Phase 2" },
    { value: "PHASE3", label: "Phase 3" },
    { value: "PHASE4", label: "Phase 4" },
];

export default function TrialsPage() {
    // Search state
    const [condition, setCondition] = useState("");
    const [location, setLocation] = useState("");
    const [status, setStatus] = useState("ALL");
    const [phase, setPhase] = useState("ALL");

    // Submitted search params (only update on search)
    const [searchParams, setSearchParams] = useState<{
        condition?: string;
        location?: string;
        status?: string;
        phase?: string;
    } | null>(null);

    // Selected trial for detail modal
    const [selectedTrial, setSelectedTrial] = useState<ClinicalTrial | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    // Share profile dialog state
    const [shareDialogOpen, setShareDialogOpen] = useState(false);
    const [shareDialogTrial, setShareDialogTrial] = useState<ClinicalTrial | null>(null);

    // Check if EHR is connected (check localStorage for patient data)
    const [ehrConnected, setEhrConnected] = useState(false);
    const [patientData, setPatientData] = useState<any>(null);

    // Load patient data from localStorage on mount
    useEffect(() => {
        const storedPatient = localStorage.getItem("smart_patient_data");
        if (storedPatient) {
            try {
                const parsed = JSON.parse(storedPatient);
                setPatientData(parsed);
                setEhrConnected(true);
            } catch (e) {
                console.error("Failed to parse patient data", e);
            }
        }
    }, []);

    const handleShowInterest = (trial: ClinicalTrial) => {
        setShareDialogTrial(trial);
        setShareDialogOpen(true);
    };

    // Fetch trials
    const { data, isLoading, isFetching, error } = useQuery<TrialSearchResponse>({
        queryKey: ["trials", searchParams],
        queryFn: async () => {
            if (!searchParams) return { studies: [], totalCount: 0 };

            const params = new URLSearchParams();
            if (searchParams.condition) params.set("condition", searchParams.condition);
            if (searchParams.location) params.set("location", searchParams.location);
            if (searchParams.status) params.set("status", searchParams.status);
            if (searchParams.phase) params.set("phase", searchParams.phase);
            params.set("pageSize", "20");

            const res = await fetch(`/api/trials/search?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to search trials");
            return res.json();
        },
        enabled: searchParams !== null,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    const handleSearch = () => {
        setSearchParams({
            condition: condition.trim() || undefined,
            location: location.trim() || undefined,
            status: status !== "ALL" ? status : undefined,
            phase: phase !== "ALL" ? phase : undefined,
        });
    };

    const handleViewDetails = (trial: ClinicalTrial) => {
        setSelectedTrial(trial);
        setModalOpen(true);
    };

    return (
        <div className="min-h-full">
            <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-8">
                {/* Hero Section */}
                <section className="section-shell text-center space-y-4 py-10">
                    <div className="flex items-center justify-center gap-3">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
                            <Stethoscope className="h-8 w-8 text-primary-foreground" />
                        </div>
                        <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight">
                            TrialAtlas
                        </h1>
                    </div>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-balance">
                        Find clinical trials matched to your condition. Search from thousands of
                        active trials and connect with research opportunities.
                    </p>
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span>Powered by ClinicalTrials.gov</span>
                    </div>
                </section>

                {/* Search Card */}
                <Card className="surface-panel">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-xl">Search Clinical Trials</CardTitle>
                        <CardDescription>
                            Enter your condition and location to find matching trials
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Search Fields */}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="condition">Condition or Disease</Label>
                                <div className="relative">
                                    <Input
                                        id="condition"
                                        placeholder="e.g., Diabetes, Lung Cancer, Asthma..."
                                        value={condition}
                                        onChange={(e) => setCondition(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                                        className="pl-10"
                                        data-testid="input-condition"
                                    />
                                    <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="location">Location</Label>
                                <div className="relative">
                                    <Input
                                        id="location"
                                        placeholder="e.g., New York, California, USA..."
                                        value={location}
                                        onChange={(e) => setLocation(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                                        className="pl-10"
                                        data-testid="input-location"
                                    />
                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                </div>
                            </div>
                        </div>

                        {/* Filters */}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="status">Recruitment Status</Label>
                                <Select value={status} onValueChange={setStatus}>
                                    <SelectTrigger id="status" data-testid="select-status">
                                        <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                                        <SelectValue placeholder="Any status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">Any Status</SelectItem>
                                        {statusOptions.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="phase">Study Phase</Label>
                                <Select value={phase} onValueChange={setPhase}>
                                    <SelectTrigger id="phase" data-testid="select-phase">
                                        <SelectValue placeholder="Any phase" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">Any Phase</SelectItem>
                                        {phaseOptions.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Search Button */}
                        <Button
                            size="lg"
                            className="w-full gap-2"
                            onClick={handleSearch}
                            disabled={isFetching}
                            data-testid="button-search"
                        >
                            {isFetching ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Searching...
                                </>
                            ) : (
                                <>
                                    <Search className="h-5 w-5" />
                                    Search Trials
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>

                {/* Results Section */}
                {searchParams !== null && (
                    <section className="space-y-4">
                        {/* Results Header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <h2 className="text-xl font-semibold">Results</h2>
                                {data && !isLoading && (
                                    <Badge variant="secondary">
                                        {data.totalCount.toLocaleString()} {data.totalCount === 1 ? "trial" : "trials"}
                                    </Badge>
                                )}
                            </div>
                            {searchParams.condition && (
                                <Badge variant="outline" className="hidden sm:flex">
                                    Condition: {searchParams.condition}
                                </Badge>
                            )}
                        </div>

                        {/* Loading State */}
                        {isLoading && (
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {[...Array(6)].map((_, i) => (
                                    <Card key={i} className="surface-panel">
                                        <CardHeader className="pb-3">
                                            <Skeleton className="h-5 w-20 mb-2" />
                                            <Skeleton className="h-5 w-full" />
                                            <Skeleton className="h-5 w-3/4" />
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            <Skeleton className="h-4 w-1/2" />
                                            <Skeleton className="h-4 w-2/3" />
                                            <Skeleton className="h-9 w-full" />
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}

                        {/* Error State */}
                        {error && (
                            <Card className="surface-panel border-destructive/50">
                                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                                    <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                                    <h3 className="font-semibold text-lg mb-2">Search Failed</h3>
                                    <p className="text-muted-foreground max-w-md">
                                        We couldn't search for trials right now. Please try again later.
                                    </p>
                                    <Button variant="outline" className="mt-4" onClick={handleSearch}>
                                        Try Again
                                    </Button>
                                </CardContent>
                            </Card>
                        )}

                        {/* Empty State */}
                        {!isLoading && !error && data?.studies.length === 0 && (
                            <Card className="surface-panel">
                                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                                    <Search className="h-12 w-12 text-muted-foreground mb-4" />
                                    <h3 className="font-semibold text-lg mb-2">No Trials Found</h3>
                                    <p className="text-muted-foreground max-w-md">
                                        We couldn't find any trials matching your criteria. Try adjusting your
                                        search terms or filters.
                                    </p>
                                </CardContent>
                            </Card>
                        )}

                        {/* Results Grid */}
                        {!isLoading && !error && data && data.studies.length > 0 && (
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {data.studies.map((trial) => (
                                    <TrialCard
                                        key={trial.nctId}
                                        trial={trial}
                                        onViewDetails={handleViewDetails}
                                        onShowInterest={handleShowInterest}
                                        hasEhrConnected={ehrConnected}
                                    />
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {/* Initial State */}
                {searchParams === null && (
                    <Card className="surface-panel">
                        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                            <Stethoscope className="h-16 w-16 text-muted-foreground/50 mb-6" />
                            <h3 className="font-semibold text-xl mb-3">Ready to Search</h3>
                            <p className="text-muted-foreground max-w-md mb-6">
                                Enter a condition or disease above to discover clinical trials
                                that might be right for you.
                            </p>
                            <div className="flex flex-wrap gap-2 justify-center">
                                {["Diabetes", "Lung Cancer", "Alzheimer's", "Heart Disease"].map((term) => (
                                    <Badge
                                        key={term}
                                        variant="secondary"
                                        className="cursor-pointer hover:bg-secondary/80 transition-colors"
                                        onClick={() => {
                                            setCondition(term);
                                            setSearchParams({ condition: term, status: "RECRUITING" });
                                        }}
                                    >
                                        {term}
                                    </Badge>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Disclaimer */}
                <div className="section-shell flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <span>
                        <strong>Important:</strong> This tool helps you discover trials but is not medical advice.
                        Always consult with a healthcare provider before participating in any clinical trial.
                    </span>
                </div>
            </div>

            {/* Trial Detail Modal */}
            <TrialDetailModal
                trial={selectedTrial}
                open={modalOpen}
                onOpenChange={setModalOpen}
            />

            {/* Share Profile Dialog */}
            <ShareProfileDialog
                open={shareDialogOpen}
                onOpenChange={setShareDialogOpen}
                trial={shareDialogTrial ? {
                    nctId: shareDialogTrial.nctId,
                    briefTitle: shareDialogTrial.briefTitle,
                } : null}
                patientData={patientData}
            />
        </div>
    );
}
