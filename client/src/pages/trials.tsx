import { useState, useEffect, useMemo } from "react";
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
    Sparkles,
    Heart,
} from "lucide-react";
import { TrialCard } from "@/components/trial-card";
import { MatchedTrialCard } from "@/components/matched-trial-card";
import { TrialDetailModal } from "@/components/trial-detail-modal";
import { ShareInterestDialog } from "@/components/share-interest-dialog";
import type { ClinicalTrial, TrialSearchResponse } from "@shared/trials";
import type { TrialMatchResponse, TrialMatchResult } from "@shared/trial-matching";

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

const aiMatchStatusOptions = [
    { value: "ALL", label: "All" },
    { value: "RECRUITING", label: "Recruiting" },
    { value: "COMPLETED", label: "Completed" },
    { value: "UNKNOWN", label: "Unknown" },
    { value: "TERMINATED", label: "Terminated" },
] as const;

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
    const [matchStatusFilter, setMatchStatusFilter] = useState<(typeof aiMatchStatusOptions)[number]["value"]>("ALL");
    const [visibleMatchCount, setVisibleMatchCount] = useState(6);
    const [loadLowScoreMatches, setLoadLowScoreMatches] = useState(false);

    // Check persistent connection status from database
    const { data: connectionStatus } = useQuery<{ connected: boolean; patientId?: string }>({
        queryKey: ["smart-connection-status"],
        queryFn: async () => {
            const res = await fetch("/api/smart/connection-status");
            if (!res.ok) return { connected: false };
            return res.json();
        },
        staleTime: 60 * 1000,
    });

    // Load patient data from localStorage on mount, or restore from DB if needed
    useEffect(() => {
        const storedPatient = localStorage.getItem("smart_patient_data");
        const storedPatientId = localStorage.getItem("smart_patient_id");

        if (storedPatient) {
            try {
                const parsed = JSON.parse(storedPatient);
                setPatientData({ ...parsed, id: storedPatientId });
                setEhrConnected(true);
            } catch (e) {
                console.error("Failed to parse patient data", e);
            }
        } else if (connectionStatus?.connected && connectionStatus.patientId) {
            // Connection exists in DB but localStorage cleared - redirect to connect-ehr to restore
            console.log("[Trials] DB connection exists but localStorage cleared - will restore");
            // Set ehrConnected to true so matching query runs, and fetch patient data
            setEhrConnected(true);
            setPatientData({ id: connectionStatus.patientId });
        }
    }, [connectionStatus]);

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

    // Fetch AI-matched trials for connected patients (high confidence first)
    const patientId = typeof patientData?.id === 'string' ? patientData.id : null;

    const {
        data: matchedTrialsData,
        isLoading: isMatchLoading,
        error: matchError,
    } = useQuery<TrialMatchResponse>({
        queryKey: ["trial-matches-high", patientId],
        queryFn: async () => {
            const res = await fetch("/api/trials/match", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ patientId, limit: 50, minScore: 40 }),
            });
            if (!res.ok) throw new Error("Failed to get matches");
            return res.json();
        },
        enabled: ehrConnected && !!patientId,
        staleTime: 10 * 60 * 1000, // 10 minutes
    });

    // Load lower-score matches only when user asks for more
    const {
        data: lowScoreTrialsData,
        isLoading: isLowScoreLoading,
    } = useQuery<TrialMatchResponse>({
        queryKey: ["trial-matches-low", patientId],
        queryFn: async () => {
            const res = await fetch("/api/trials/match", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ patientId, limit: 100, minScore: 0 }),
            });
            if (!res.ok) throw new Error("Failed to get low-score matches");
            return res.json();
        },
        enabled: ehrConnected && !!patientId && loadLowScoreMatches,
        staleTime: 10 * 60 * 1000,
    });

    // Match current searched results when EHR is connected so result cards can show full AI details
    const searchTrialIds = useMemo(
        () => (data?.studies ?? []).map((trial) => trial.nctId).join(","),
        [data?.studies]
    );
    const {
        data: searchMatchesData,
        error: searchMatchError,
        isLoading: isSearchMatchLoading,
    } = useQuery<TrialMatchResponse>({
        queryKey: ["search-trial-matches", patientId, searchTrialIds],
        queryFn: async () => {
            const searchTrials = data?.studies ?? [];
            if (searchTrials.length === 0) {
                return { matches: [], totalTrialsAnalyzed: 0, patientConditions: [], timestamp: new Date().toISOString() };
            }

            const res = await fetch("/api/trials/match", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patientId,
                    trials: searchTrials,
                    minScore: 0,
                    limit: searchTrials.length,
                }),
            });
            if (!res.ok) throw new Error("Failed to match searched trials");
            return res.json();
        },
        enabled: ehrConnected && !!patientId && !!data?.studies?.length,
        staleTime: 5 * 60 * 1000,
    });

    const mergedMatchedTrials = useMemo(() => {
        const highMatches = matchedTrialsData?.matches ?? [];
        if (!loadLowScoreMatches) return highMatches;

        const all = [...highMatches, ...(lowScoreTrialsData?.matches ?? [])];
        const byId = new Map<string, TrialMatchResult>();
        for (const item of all) {
            if (!byId.has(item.nctId) || (byId.get(item.nctId)?.matchScore ?? -1) < item.matchScore) {
                byId.set(item.nctId, item);
            }
        }
        return Array.from(byId.values()).sort((a, b) => b.matchScore - a.matchScore);
    }, [matchedTrialsData, lowScoreTrialsData, loadLowScoreMatches]);

    const filteredMatchedTrials = useMemo(() => {
        if (matchStatusFilter === "ALL") return mergedMatchedTrials;
        return mergedMatchedTrials.filter((match) => (match.trial?.overallStatus ?? "UNKNOWN") === matchStatusFilter);
    }, [mergedMatchedTrials, matchStatusFilter]);

    const visibleMatchedTrials = filteredMatchedTrials.slice(0, visibleMatchCount);

    const searchMatchByNctId = useMemo(() => {
        const map = new Map<string, TrialMatchResult>();
        for (const match of searchMatchesData?.matches ?? []) {
            map.set(match.nctId, match);
        }
        return map;
    }, [searchMatchesData]);

    const getSearchMatchResult = (nctId: string): TrialMatchResult | undefined => {
        return searchMatchByNctId.get(nctId);
    };

    const getMatchResult = (nctId: string): TrialMatchResult | undefined => {
        return mergedMatchedTrials.find((m) => m.nctId === nctId);
    };

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

    useEffect(() => {
        setVisibleMatchCount(6);
    }, [matchStatusFilter, matchedTrialsData?.timestamp]);

    const handleLoadMoreMatches = () => {
        if (visibleMatchCount < filteredMatchedTrials.length) {
            setVisibleMatchCount((prev) => prev + 6);
            return;
        }

        if (!loadLowScoreMatches) {
            setLoadLowScoreMatches(true);
            setVisibleMatchCount((prev) => prev + 6);
        }
    };

    const normalizedSharePatientData = useMemo(() => {
        if (!patientData) return undefined;

        const normalizeList = (items: any[] | undefined) =>
            (items || [])
                .map((item) => {
                    if (typeof item === "string") return item;
                    if (item?.display) return item.display;
                    if (item?.name) return item.name;
                    return "";
                })
                .filter(Boolean);

        return {
            name: patientData.name || patientData.demographics?.name,
            age: patientData.age ?? patientData.demographics?.age,
            sex: patientData.sex ?? patientData.demographics?.gender,
            conditions: normalizeList(patientData.conditions),
            labs: (patientData.labs || [])
                .map((lab: any) => {
                    if (typeof lab === "string") {
                        return {
                            display: lab,
                            value: undefined,
                            unit: "",
                            effectiveDate: "",
                        };
                    }
                    return {
                        display: lab?.display || lab?.name || "",
                        value: lab?.valueString ?? lab?.value,
                        unit: lab?.unit || "",
                        effectiveDate: lab?.effectiveDate || "",
                    };
                })
                .filter((lab: any) => Boolean(lab?.display)),
            medications: normalizeList(patientData.medications),
            city:
                patientData.location ||
                patientData.city ||
                patientData.demographics?.city ||
                patientData.demographics?.address?.city,
        };
    }, [patientData]);

    return (
        <div className="min-h-full">
            <div className="w-full p-6 md:p-8 space-y-8">
                {/* Hero Section */}
                <section className="section-shell space-y-4 py-10">
                    <div className="flex items-center justify-start gap-3">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
                            <Stethoscope className="h-8 w-8 text-primary-foreground" />
                        </div>
                        <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight">
                            TrialAtlas
                        </h1>
                    </div>
                    <p className="text-lg text-muted-foreground max-w-3xl text-balance">
                        Find clinical trials matched to your condition. Search from thousands of
                        active trials and connect with research opportunities.
                    </p>
                    <div className="flex items-center justify-start gap-2 text-sm text-muted-foreground">
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

                {/* AI Matched Trials */}
                {ehrConnected && (
                    <section className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <Heart className="h-5 w-5 text-primary" />
                                <h2 className="text-xl font-semibold">AI Matched for You</h2>
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-2">
                                {aiMatchStatusOptions.map((option) => (
                                    <Button
                                        key={option.value}
                                        type="button"
                                        variant={matchStatusFilter === option.value ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setMatchStatusFilter(option.value)}
                                    >
                                        {option.label}
                                    </Button>
                                ))}
                                {matchedTrialsData && !isMatchLoading && (
                                    <Badge variant="secondary">
                                        {filteredMatchedTrials.length} {filteredMatchedTrials.length === 1 ? "match" : "matches"}
                                    </Badge>
                                )}
                            </div>
                        </div>

                        {isMatchLoading && (
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {[...Array(3)].map((_, i) => (
                                    <Card key={i} className="surface-panel">
                                        <CardHeader className="pb-3">
                                            <Skeleton className="h-5 w-1/3 mb-2" />
                                            <Skeleton className="h-5 w-full" />
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            <Skeleton className="h-4 w-2/3" />
                                            <Skeleton className="h-9 w-full" />
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}

                        {!isMatchLoading && matchError && (
                            <Card className="surface-panel border-destructive/50">
                                <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                                    <AlertCircle className="h-10 w-10 text-destructive mb-3" />
                                    <h3 className="font-semibold mb-1">Couldn&apos;t load AI matches</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Please reconnect your health record and try again.
                                    </p>
                                </CardContent>
                            </Card>
                        )}

                        {!isMatchLoading && !matchError && matchedTrialsData && filteredMatchedTrials.length === 0 && (
                            <Card className="surface-panel">
                                <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                                    <Sparkles className="h-10 w-10 text-muted-foreground mb-3" />
                                    <h3 className="font-semibold mb-1">No strong matches yet</h3>
                                    <p className="text-sm text-muted-foreground">
                                        No trials matched this status filter yet.
                                    </p>
                                </CardContent>
                            </Card>
                        )}

                        {!isMatchLoading && !matchError && filteredMatchedTrials.length > 0 && (
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {visibleMatchedTrials.map((match) => {
                                    const fallbackTrial: ClinicalTrial = {
                                        nctId: match.nctId,
                                        briefTitle: match.briefTitle,
                                        overallStatus: "UNKNOWN",
                                        conditions: (match.matchedConditions || [])
                                            .filter((item) => item.isMatch)
                                            .map((item) => item.trialCondition),
                                    };

                                    return (
                                        <MatchedTrialCard
                                            key={match.nctId}
                                            trial={match.trial || fallbackTrial}
                                            match={match}
                                            onViewDetails={handleViewDetails}
                                            onShowInterest={handleShowInterest}
                                            hasEhrConnected={ehrConnected}
                                        />
                                    );
                                })}
                            </div>
                        )}

                        {!isMatchLoading && !matchError && filteredMatchedTrials.length > visibleMatchedTrials.length && (
                            <div className="flex justify-center">
                                <Button variant="outline" onClick={handleLoadMoreMatches}>
                                    Load 6 More
                                </Button>
                            </div>
                        )}

                        {!isMatchLoading && !matchError && filteredMatchedTrials.length <= visibleMatchedTrials.length && !loadLowScoreMatches && (
                            <div className="flex justify-center">
                                <Button variant="outline" onClick={handleLoadMoreMatches} disabled={isLowScoreLoading}>
                                    {isLowScoreLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Loading lower-score matches...
                                        </>
                                    ) : (
                                        "Load Lower-Accuracy Matches"
                                    )}
                                </Button>
                            </div>
                        )}
                    </section>
                )}

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
                                {data.studies.map((trial) => {
                                    if (!ehrConnected) {
                                        return (
                                            <TrialCard
                                                key={trial.nctId}
                                                trial={trial}
                                                onViewDetails={handleViewDetails}
                                                onShowInterest={handleShowInterest}
                                                hasEhrConnected={ehrConnected}
                                            />
                                        );
                                    }

                                    if (searchMatchError) {
                                        return (
                                            <TrialCard
                                                key={trial.nctId}
                                                trial={trial}
                                                onViewDetails={handleViewDetails}
                                                onShowInterest={handleShowInterest}
                                                hasEhrConnected={ehrConnected}
                                            />
                                        );
                                    }

                                    const searchMatch = getSearchMatchResult(trial.nctId);
                                    if (!searchMatch && isSearchMatchLoading) {
                                        return (
                                            <Card key={trial.nctId} className="surface-panel">
                                                <CardHeader className="pb-3">
                                                    <Skeleton className="h-5 w-1/3 mb-2" />
                                                    <Skeleton className="h-6 w-full" />
                                                </CardHeader>
                                                <CardContent className="space-y-3">
                                                    <Skeleton className="h-4 w-2/3" />
                                                    <Skeleton className="h-9 w-full" />
                                                </CardContent>
                                            </Card>
                                        );
                                    }

                                    if (!searchMatch) {
                                        return (
                                            <TrialCard
                                                key={trial.nctId}
                                                trial={trial}
                                                onViewDetails={handleViewDetails}
                                                onShowInterest={handleShowInterest}
                                                hasEhrConnected={ehrConnected}
                                            />
                                        );
                                    }

                                    return (
                                        <MatchedTrialCard
                                            key={trial.nctId}
                                            trial={searchMatch.trial || trial}
                                            match={searchMatch}
                                            onViewDetails={handleViewDetails}
                                            onShowInterest={handleShowInterest}
                                            hasEhrConnected={ehrConnected}
                                        />
                                    );
                                })}
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

            {/* Share Interest Dialog */}
            <ShareInterestDialog
                open={shareDialogOpen}
                onOpenChange={setShareDialogOpen}
                trial={shareDialogTrial}
                matchScore={shareDialogTrial
                    ? (getSearchMatchResult(shareDialogTrial.nctId)?.matchScore
                        ?? getMatchResult(shareDialogTrial.nctId)?.matchScore)
                    : undefined}
                patientData={normalizedSharePatientData}
            />
        </div>
    );
}
