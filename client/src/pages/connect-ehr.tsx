import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { PatientProfile } from "@/components/patient-profile";
import {
    Heart,
    Building2,
    Loader2,
    CheckCircle2,
    ExternalLink,
    AlertCircle,
    Link2,
    Unlink,
    Sparkles,
} from "lucide-react";
import type { PatientProfile as PatientProfileType, SmartPatientDataResponse } from "@shared/fhir-types";

// Provider interface
interface EHRProvider {
    id: string;
    name: string;
}

export default function ConnectEHRPage() {
    const { toast } = useToast();
    const [, setLocation] = useLocation();
    const searchString = useSearch();
    const searchParams = new URLSearchParams(searchString);

    // State for connected patient
    const [connectedPatientId, setConnectedPatientId] = useState<string | null>(() => {
        return localStorage.getItem("smart_patient_id");
    });

    // Get providers
    const { data: providersData } = useQuery<{ providers: EHRProvider[] }>({
        queryKey: ["smart-providers"],
        queryFn: async () => {
            const res = await fetch("/api/smart/providers");
            if (!res.ok) throw new Error("Failed to fetch providers");
            return res.json();
        },
    });

    // Check if user has a persistent connection in the database
    const { data: connectionStatus, isLoading: isCheckingConnection } = useQuery<{ connected: boolean; patientId?: string }>({
        queryKey: ["smart-connection-status"],
        queryFn: async () => {
            const res = await fetch("/api/smart/connection-status");
            if (!res.ok) return { connected: false };
            return res.json();
        },
        staleTime: 60 * 1000, // 1 minute
    });

    // Restore connection state from database if connected there but not in localStorage
    useEffect(() => {
        if (connectionStatus?.connected && connectionStatus.patientId && !connectedPatientId) {
            console.log("[Connect EHR] Restoring connection from database:", connectionStatus.patientId);
            localStorage.setItem("smart_patient_id", connectionStatus.patientId);
            setConnectedPatientId(connectionStatus.patientId);
        }
    }, [connectionStatus, connectedPatientId]);

    // Fetch patient data if connected
    const { data: patientData, isLoading: patientLoading, refetch: refetchPatient } = useQuery<SmartPatientDataResponse>({
        queryKey: ["smart-patient-data", connectedPatientId],
        queryFn: async () => {
            if (!connectedPatientId) throw new Error("No patient ID");
            const res = await fetch(`/api/smart/patient-data/${connectedPatientId}`);
            if (!res.ok) {
                if (res.status === 401) {
                    // Token expired - clear local state but don't throw
                    localStorage.removeItem("smart_patient_id");
                    localStorage.removeItem("smart_patient_data");
                    setConnectedPatientId(null);
                    throw new Error("Session expired");
                }
                throw new Error("Failed to fetch patient data");
            }
            return res.json();
        },
        enabled: !!connectedPatientId,
        retry: false,
    });

    // Persist patient data to localStorage for trials page access
    useEffect(() => {
        if (patientData?.profile) {
            const demo = patientData.profile.demographics;
            const dataToStore = {
                name: demo?.name || "Unknown",
                age: demo?.age || 0,
                sex: demo?.gender || "Unknown",
                birthDate: demo?.birthDate || "",
                location: demo?.address?.city || "",
                conditions: patientData.profile.conditions?.map(c => ({
                    name: c.display,
                    status: c.clinicalStatus || "active",
                })) || [],
                labs: patientData.profile.labResults?.map(l => ({
                    name: l.display,
                    value: String(l.value ?? l.valueString ?? ""),
                    unit: l.unit || "",
                })) || [],
                medications: patientData.profile.medications?.map(m => ({
                    name: m.display,
                    status: m.status || "active",
                })) || [],
            };
            localStorage.setItem("smart_patient_data", JSON.stringify(dataToStore));
        }
    }, [patientData]);

    // Connect mutation - fetch auth URL and redirect immediately
    const connectMutation = useMutation({
        mutationFn: async (providerId: string) => {
            console.log("Starting SMART authorization for provider:", providerId);
            const res = await fetch("/api/smart/authorize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ provider: providerId }),
            });
            if (!res.ok) {
                const error = await res.text();
                console.error("Authorization failed:", error);
                throw new Error("Failed to initiate authorization");
            }
            const data = await res.json() as { authorizationUrl: string; state: string };
            console.log("Authorization response:", data);

            // Store state for callback verification
            localStorage.setItem("smart_state", data.state);

            return data;
        },
        onSuccess: (data) => {
            // Redirect using a more reliable method
            console.log("Redirecting to:", data.authorizationUrl);
            window.location.assign(data.authorizationUrl);
        },
        onError: (error) => {
            console.error("Mutation error:", error);
            toast({
                title: "Connection Failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Callback mutation
    const callbackMutation = useMutation({
        mutationFn: async ({ code, state }: { code: string; state: string }) => {
            console.log("Calling /api/smart/callback with code and state...");
            const res = await fetch("/api/smart/callback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code, state }),
            });
            console.log("Callback response status:", res.status);
            if (!res.ok) {
                const errorText = await res.text();
                console.error("Callback failed:", errorText);
                throw new Error("Failed to complete authorization");
            }
            const data = await res.json() as { success: boolean; patientId: string };
            console.log("Callback success, patientId:", data.patientId);
            return data;
        },
        onSuccess: (data) => {
            console.log("Callback mutation onSuccess:", data);
            if (data.patientId) {
                localStorage.setItem("smart_patient_id", data.patientId);
                setConnectedPatientId(data.patientId);
                toast({
                    title: "Connected!",
                    description: "Successfully connected your health record.",
                });
            }
            // Clear URL params
            setLocation("/connect-ehr", { replace: true });
        },
        onError: (error) => {
            console.error("Callback mutation error:", error);
            toast({
                title: "Authorization Failed",
                description: error.message,
                variant: "destructive",
            });
            setLocation("/connect-ehr", { replace: true });
        },
    });

    // Disconnect mutation
    const disconnectMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/smart/disconnect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ patientId: connectedPatientId }),
            });
            if (!res.ok) throw new Error("Failed to disconnect");
            return res.json();
        },
        onSuccess: () => {
            localStorage.removeItem("smart_patient_id");
            setConnectedPatientId(null);
            toast({
                title: "Disconnected",
                description: "Your health record has been disconnected.",
            });
        },
    });

    // Handle OAuth callback
    useEffect(() => {
        const code = searchParams.get("code");
        const state = searchParams.get("state");
        const error = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");
        const storedState = localStorage.getItem("smart_state");

        console.log("Callback check - code:", code?.substring(0, 20) + "...", "state:", state, "storedState:", storedState);

        // Check for OAuth errors first
        if (error) {
            console.error("OAuth error:", error, errorDescription);
            localStorage.removeItem("smart_state");
            toast({
                title: "Authorization Error",
                description: errorDescription || error || "Authorization was denied or failed",
                variant: "destructive",
            });
            setLocation("/connect-ehr", { replace: true });
            return;
        }

        if (code && state && storedState === state) {
            console.log("State matches! Processing callback...");
            localStorage.removeItem("smart_state");
            callbackMutation.mutate({ code, state });
        } else if (code && state) {
            console.log("State mismatch! Expected:", storedState, "Got:", state);
            toast({
                title: "Invalid State",
                description: "The authorization state doesn't match. Please try again.",
                variant: "destructive",
            });
            setLocation("/connect-ehr", { replace: true });
        }
    }, []);

    const isConnecting = connectMutation.isPending || callbackMutation.isPending;

    return (
        <div className="min-h-full">
            <div className="w-full p-6 md:p-8 space-y-8">
                {/* Header */}
                <section className="section-shell space-y-4 py-8" data-testid="section-connect-ehr-header">
                    <div className="flex items-center justify-start gap-3">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
                            <Heart className="h-7 w-7 text-primary-foreground" />
                        </div>
                        <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">
                            Connect Health Record
                        </h1>
                    </div>
                    <p className="text-lg text-muted-foreground max-w-3xl text-balance">
                        Securely import diagnoses, lab results, and medications from your provider so our
                        AI-assisted matching can find trials that fit your profile.
                    </p>
                    <div className="flex items-center justify-start gap-2 text-sm text-muted-foreground">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span>SMART on FHIR secure authorization • HL7 FHIR R4</span>
                    </div>
                </section>

                {/* Connection Status */}
                {connectedPatientId && patientData?.profile ? (
                    <Card className="surface-panel border-emerald-500/30" data-testid="card-connected-record">
                        <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20">
                                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg">Health Record Connected</CardTitle>
                                        <CardDescription>
                                            {patientData.profile.dataSource}
                                        </CardDescription>
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => disconnectMutation.mutate()}
                                    disabled={disconnectMutation.isPending}
                                    className="text-destructive hover:text-destructive"
                                >
                                    <Unlink className="h-4 w-4 mr-2" />
                                    Disconnect
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <PatientProfile profile={patientData.profile} />

                            {/* Resource counts */}
                            <div className="mt-6 flex flex-wrap gap-2">
                                <Badge variant="secondary">
                                    {patientData.rawResourceCount.conditions} Conditions
                                </Badge>
                                <Badge variant="secondary">
                                    {patientData.rawResourceCount.observations} Lab Results
                                </Badge>
                                <Badge variant="secondary">
                                    {patientData.rawResourceCount.medications} Medications
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>
                ) : patientLoading ? (
                    <Card className="surface-panel" data-testid="card-connect-providers">
                        <CardHeader>
                            <Skeleton className="h-6 w-48" />
                            <Skeleton className="h-4 w-32" />
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Skeleton className="h-20 w-full" />
                            <Skeleton className="h-20 w-full" />
                        </CardContent>
                    </Card>
                ) : (
                    /* Provider Selection */
                    <Card className="surface-panel" data-testid="card-connect-providers">
                        <CardHeader>
                            <CardTitle className="text-xl">Select Your Provider</CardTitle>
                            <CardDescription>
                                Choose your healthcare provider to securely connect your health records
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {providersData?.providers.map((provider, index) => (
                                <button
                                    type="button"
                                    key={provider.id}
                                    onClick={() => connectMutation.mutate(provider.id)}
                                    disabled={isConnecting}
                                    data-testid={index === 0 ? "button-connect-provider" : undefined}
                                    className="w-full flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-accent hover:border-primary/50 transition-colors disabled:opacity-50"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                                            <Building2 className="h-6 w-6 text-muted-foreground" />
                                        </div>
                                        <div className="text-left">
                                            <p className="font-medium">{provider.name}</p>
                                            <p className="text-sm text-muted-foreground">
                                                FHIR R4 • Sandbox Environment
                                            </p>
                                        </div>
                                    </div>
                                    {isConnecting ? (
                                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                    ) : (
                                        <Link2 className="h-5 w-5 text-muted-foreground" />
                                    )}
                                </button>
                            ))}

                            {/* Loading state for callback */}
                            {callbackMutation.isPending && (
                                <div className="flex flex-col items-center justify-center py-8 text-center">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                                    <p className="text-muted-foreground">Completing authorization...</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Info Card */}
                <Card className="surface-panel" data-testid="card-connect-how-it-works">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-primary" />
                            How It Works
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ol className="space-y-3 text-sm text-muted-foreground">
                            <li className="flex gap-3">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">1</span>
                                <span>Select your healthcare provider from the list above</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">2</span>
                                <span>Sign in to your portal and approve SMART on FHIR access</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">3</span>
                                <span>TrialAtlas uses AI-assisted matching on your clinical profile to rank relevant trials</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">4</span>
                                <span>Coordinators only receive the fields you choose when you express interest</span>
                            </li>
                        </ol>
                        <p className="mt-4 text-xs text-muted-foreground">
                            You control sharing per trial. Disconnect anytime from this page.
                        </p>
                        <div className="mt-4 pt-4 border-t border-border">
                            <a
                                href="https://smarthealthit.org/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                            >
                                Learn more about SMART on FHIR
                                <ExternalLink className="h-3 w-3" />
                            </a>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
