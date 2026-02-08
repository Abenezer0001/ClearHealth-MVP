import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
    User,
    ClipboardList,
    Heart,
    Stethoscope,
    Loader2,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import {
    clearPreAuthRole,
    getPreAuthRole,
    resolveAuthEntryPath,
    setPreAuthRole,
    type AuthEntryIntent,
    type PreAuthRole,
} from "@/lib/pre-auth-role";

export default function RoleSelectionPage() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { data: session } = authClient.useSession();
    const isAuthenticated = Boolean(session?.user);
    const [selectedRole, setSelectedRole] = useState<PreAuthRole | null>(getPreAuthRole());
    const hasAutoSubmittedRef = useRef(false);
    const authIntent: AuthEntryIntent =
        typeof window !== "undefined" && new URLSearchParams(window.location.search).get("intent") === "register"
            ? "register"
            : "login";

    const setRoleMutation = useMutation({
        mutationFn: async (role: PreAuthRole) => {
            const response = await fetch("/api/user/role", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ role }),
            });
            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                const error = new Error(errorBody.error || "Failed to set role") as Error & { status?: number };
                error.status = response.status;
                throw error;
            }
            return response.json();
        },
        onSuccess: async (_, role) => {
            toast({
                title: "Welcome!",
                description: `You're all set as a ${role}.`,
            });
            clearPreAuthRole();
            // Update local role immediately so route guards can transition without waiting.
            queryClient.setQueryData(["user-role"], role);
            // Invalidate the user-role query so it refetches the new role from the database
            await queryClient.invalidateQueries({ queryKey: ["user-role"] });
            // Force a clean navigation to avoid stale in-memory auth/query state.
            window.location.assign("/");
        },
        onError: (error: Error & { status?: number }) => {
            if (error.status === 401) {
                // Session cache can be stale. Preserve selected role and recover via login.
                if (selectedRole) {
                    setPreAuthRole(selectedRole);
                }
                toast({
                    title: "Session expired",
                    description: "Please sign in again to finish role setup.",
                    variant: "destructive",
                });
                setLocation("/login");
                return;
            }

            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
            hasAutoSubmittedRef.current = false;
        },
    });

    const handleRoleSelect = (role: PreAuthRole) => {
        setSelectedRole(role);
        if (isAuthenticated) {
            setRoleMutation.mutate(role);
            return;
        }

        setPreAuthRole(role);
        toast({
            title: "Role selected",
            description: `Continue as a ${role} to ${authIntent === "register" ? "create your account" : "sign in"}.`,
        });
        setLocation(resolveAuthEntryPath(authIntent, role));
    };

    useEffect(() => {
        if (!isAuthenticated) return;
        if (!selectedRole) return;
        if (setRoleMutation.isPending) return;
        if (hasAutoSubmittedRef.current) return;

        hasAutoSubmittedRef.current = true;
        setRoleMutation.mutate(selectedRole);
    }, [isAuthenticated, selectedRole, setRoleMutation]);

    return (
        <div className="min-h-screen bg-background">
            {/* Header with back navigation */}
            <header className="border-b border-border/50 bg-background/80 backdrop-blur-md">
                <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
                    <button
                        onClick={() => setLocation("/")}
                        className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                    >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
                            <Stethoscope className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <span className="font-serif text-xl font-semibold tracking-tight hidden sm:inline">
                            TrialAtlas
                        </span>
                    </button>
                    <p className="text-sm text-muted-foreground">
                        Already have an account?{" "}
                        <button
                            onClick={() => {
                                if (selectedRole) {
                                    setPreAuthRole(selectedRole);
                                }
                                setLocation("/login?mode=signin");
                            }}
                            className="text-primary hover:underline font-medium"
                        >
                            Sign in
                        </button>
                    </p>
                </div>
            </header>

            <div className="flex items-center justify-center p-6 pt-12">
                <div className="max-w-2xl w-full space-y-8">
                    {/* Header */}
                    <div className="text-center space-y-3">
                        <div className="flex justify-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
                                <Stethoscope className="h-8 w-8 text-primary-foreground" />
                            </div>
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight">Welcome to TrialAtlas</h1>
                        <p className="text-muted-foreground text-lg">
                            How will you be using the platform?
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Next step: {authIntent === "register" ? "create your account" : "sign in"}.
                        </p>
                    </div>

                    {/* Role Cards */}
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Patient Card */}
                        <Card
                            className={`cursor-pointer transition-all hover:border-primary/50 ${selectedRole === "patient" ? "ring-2 ring-primary border-primary" : ""
                                }`}
                            onClick={() => !setRoleMutation.isPending && handleRoleSelect("patient")}
                        >
                            <CardHeader className="text-center pb-2">
                                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/30 mb-3">
                                    <Heart className="h-7 w-7 text-rose-600 dark:text-rose-400" />
                                </div>
                                <CardTitle className="text-xl">I'm a Patient</CardTitle>
                                <CardDescription>
                                    Looking for clinical trials that match my condition
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="text-center">
                                <ul className="text-sm text-muted-foreground space-y-2">
                                    <li className="flex items-center gap-2 justify-center">
                                        <User className="h-4 w-4" />
                                        Connect your health records
                                    </li>
                                    <li className="flex items-center gap-2 justify-center">
                                        <ClipboardList className="h-4 w-4" />
                                        Search and filter trials
                                    </li>
                                    <li className="flex items-center gap-2 justify-center">
                                        <Heart className="h-4 w-4" />
                                        Express interest to coordinators
                                    </li>
                                </ul>
                                <Button
                                    className="mt-6 w-full"
                                    variant={selectedRole === "patient" ? "default" : "outline"}
                                    disabled={setRoleMutation.isPending}
                                >
                                    {setRoleMutation.isPending && selectedRole === "patient" ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                            {isAuthenticated ? "Setting up..." : "Continuing..."}
                                        </>
                                    ) : (
                                        isAuthenticated
                                            ? "Continue as Patient"
                                            : authIntent === "register"
                                                ? "Continue as Patient to Create Account"
                                                : "Continue as Patient to Sign In"
                                    )}
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Coordinator Card */}
                        <Card
                            className={`cursor-pointer transition-all hover:border-primary/50 ${selectedRole === "coordinator" ? "ring-2 ring-primary border-primary" : ""
                                }`}
                            onClick={() => !setRoleMutation.isPending && handleRoleSelect("coordinator")}
                        >
                            <CardHeader className="text-center pb-2">
                                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 mb-3">
                                    <ClipboardList className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                                </div>
                                <CardTitle className="text-xl">I'm a Coordinator</CardTitle>
                                <CardDescription>
                                    Managing clinical trials and patient recruitment
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="text-center">
                                <ul className="text-sm text-muted-foreground space-y-2">
                                    <li className="flex items-center gap-2 justify-center">
                                        <ClipboardList className="h-4 w-4" />
                                        View interested patient leads
                                    </li>
                                    <li className="flex items-center gap-2 justify-center">
                                        <User className="h-4 w-4" />
                                        Manage lead status and notes
                                    </li>
                                    <li className="flex items-center gap-2 justify-center">
                                        <Stethoscope className="h-4 w-4" />
                                        Access admin dashboard
                                    </li>
                                </ul>
                                <Button
                                    className="mt-6 w-full"
                                    variant={selectedRole === "coordinator" ? "default" : "outline"}
                                    disabled={setRoleMutation.isPending}
                                >
                                    {setRoleMutation.isPending && selectedRole === "coordinator" ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                            {isAuthenticated ? "Setting up..." : "Continuing..."}
                                        </>
                                    ) : (
                                        isAuthenticated
                                            ? "Continue as Coordinator"
                                            : authIntent === "register"
                                                ? "Continue as Coordinator to Create Account"
                                                : "Continue as Coordinator to Sign In"
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
