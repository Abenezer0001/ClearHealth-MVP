import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { authClient } from "@/lib/auth-client";
import { ensureRoleForSignedInUser } from "@/lib/auth-role-flow";
import { clearPreAuthRole, getPreAuthRole, type PreAuthRole } from "@/lib/pre-auth-role";
import { restartRoleTour, resumePendingRoleTour, startRoleTour } from "@/lib/patient-tour";
import UserMenu from "@/components/user-menu";
import { useToast } from "@/hooks/use-toast";
import { Compass, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import NotFound from "@/pages/not-found";
import TrialsPage from "@/pages/trials";
import AdminPage from "@/pages/admin";
import LoginPage from "@/pages/login";
import ConnectEHRPage from "@/pages/connect-ehr";
import CoordinatorInboxPage from "@/pages/coordinator-inbox";
import RoleSelectionPage from "@/pages/role-selection";
import LandingPage from "@/pages/landing";

type UserRole = "patient" | "coordinator" | null;

// Hook to fetch user role from database (bypasses better-auth session cache)
function useUserRole(isAuthenticated: boolean) {
  return useQuery({
    queryKey: ["user-role"],
    queryFn: async () => {
      const response = await fetch("/api/user/me", {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) {
        const error = new Error("Failed to fetch user role") as Error & { status?: number };
        error.status = response.status;
        throw error;
      }
      const data = await response.json();
      return data.role as UserRole;
    },
    enabled: isAuthenticated,
    staleTime: 0, // Always refetch to get latest role
    retry: (failureCount, error) => {
      const status = (error as Error & { status?: number }).status;
      return status === 401 && failureCount < 6;
    },
    retryDelay: (attempt) => Math.min(1000, 125 * 2 ** attempt),
  });
}

// Component that guards routes by role
function RoleGuard({
  allowedRoles,
  children,
  userRole,
}: {
  allowedRoles: UserRole[];
  children: React.ReactNode;
  userRole: UserRole;
}) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (userRole && !allowedRoles.includes(userRole)) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this page.",
        variant: "destructive",
      });
      setLocation("/");
    }
  }, [userRole, allowedRoles, setLocation, toast]);

  if (!userRole || !allowedRoles.includes(userRole)) {
    return null;
  }

  return <>{children}</>;
}

function Router({
  isAuthenticated,
  userRole,
  preAuthRole,
}: {
  isAuthenticated: boolean;
  userRole: UserRole;
  preAuthRole: PreAuthRole | null;
}) {
  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/role-selection" component={RoleSelectionPage} />
        <Route path="/login" component={LoginPage} />
        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>
    );
  }

  // Redirect to role selection if user has no role (but not if already on that page)
  if (!userRole) {
    return (
      <Switch>
        <Route path="/role-selection" component={RoleSelectionPage} />
        <Route>
          <Redirect to="/role-selection" />
        </Route>
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/" component={TrialsPage} />
      <Route path="/login">
        <Redirect to="/" />
      </Route>
      <Route path="/role-selection">
        <Redirect to="/" />
      </Route>
      <Route path="/connect-ehr">
        <RoleGuard allowedRoles={["patient"]} userRole={userRole}>
          <ConnectEHRPage />
        </RoleGuard>
      </Route>
      <Route path="/smart/callback">
        <RoleGuard allowedRoles={["patient"]} userRole={userRole}>
          <ConnectEHRPage />
        </RoleGuard>
      </Route>
      <Route path="/coordinator-inbox">
        <RoleGuard allowedRoles={["coordinator"]} userRole={userRole}>
          <CoordinatorInboxPage />
        </RoleGuard>
      </Route>
      <Route path="/admin">
        <RoleGuard allowedRoles={["coordinator"]} userRole={userRole}>
          <AdminPage />
        </RoleGuard>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

// Inner component that uses hooks - must be inside QueryClientProvider
function AppContent() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const isAuthenticated = Boolean(session?.user);
  const [hasServerSession, setHasServerSession] = useState(false);
  const effectiveAuthenticated = isAuthenticated || hasServerSession;
  const preAuthRole = getPreAuthRole();
  const roleSyncInFlight = useRef(false);
  const roleSyncAttempts = useRef(0);
  const { toast } = useToast();

  // Fetch role from database (bypasses better-auth's cached session)
  const {
    data: userRole,
    isLoading: roleLoading,
    isFetching: roleFetching,
    error: roleError,
  } = useUserRole(effectiveAuthenticated);
  const hasTriedAutoTour = useRef(false);

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  // Don't show sidebar on role selection page
  const [location, setLocation] = useLocation();
  const showSidebar = effectiveAuthenticated && userRole && location !== "/role-selection";
  const isPending = sessionPending || (effectiveAuthenticated && (roleLoading || roleFetching));

  useEffect(() => {
    if (!effectiveAuthenticated) {
      hasTriedAutoTour.current = false;
      roleSyncAttempts.current = 0;
      roleSyncInFlight.current = false;
    }
  }, [effectiveAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      setHasServerSession(false);
      return;
    }

    let isMounted = true;
    const checkSession = async () => {
      try {
        const response = await fetch("/api/auth/get-session", {
          credentials: "include",
          cache: "no-store",
        });
        const data = await response.json().catch(() => null);
        if (!isMounted) return;
        setHasServerSession(Boolean(data?.user));
      } catch {
        if (!isMounted) return;
        setHasServerSession(false);
      }
    };

    void checkSession();
    const intervalId = window.setInterval(() => {
      void checkSession();
    }, 1000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!effectiveAuthenticated || !preAuthRole) return;
    if (isPending) return;
    if (roleSyncInFlight.current) return;

    const syncRole = async () => {
      if (roleSyncAttempts.current >= 3) return;
      roleSyncAttempts.current += 1;
      roleSyncInFlight.current = true;

      try {
        const result = await ensureRoleForSignedInUser(preAuthRole);
        if (result.status === "mismatch") {
          clearPreAuthRole();
          authClient.signOut({
            fetchOptions: {
              onSuccess: () => {
                toast({
                  variant: "destructive",
                  title: "Role mismatch",
                  description: `This account is registered as ${result.role}. Select the matching role to continue.`,
                });
                setLocation("/role-selection");
              },
            },
          });
          return;
        }

        clearPreAuthRole();
        roleSyncAttempts.current = 0;
        queryClient.setQueryData(["user-role"], result.role);
        await queryClient.invalidateQueries({ queryKey: ["user-role"] });
        if (location === "/role-selection") {
          window.location.assign("/");
        }
      } catch (error) {
        if (roleSyncAttempts.current >= 3) {
          toast({
            variant: "destructive",
            title: "Role setup incomplete",
            description: error instanceof Error ? error.message : "Failed to finish role setup.",
          });
        }
      } finally {
        roleSyncInFlight.current = false;
      }
    };

    void syncRole();
  }, [effectiveAuthenticated, preAuthRole, isPending, location, setLocation, toast]);

  useEffect(() => {
    if (!effectiveAuthenticated) return;
    if (roleLoading || roleFetching) return;

    const status = (roleError as Error & { status?: number } | null)?.status;
    if (status !== 401) return;

    authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          setLocation("/login");
        },
      },
    });
  }, [effectiveAuthenticated, roleLoading, roleFetching, roleError, setLocation]);

  useEffect(() => {
    if (isPending) return;
    if (!effectiveAuthenticated || !userRole) return;
    resumePendingRoleTour();
  }, [isPending, effectiveAuthenticated, userRole, location]);

  useEffect(() => {
    if (hasTriedAutoTour.current) return;
    if (isPending) return;
    if (!effectiveAuthenticated || !userRole) return;
    if (location !== "/") return;

    hasTriedAutoTour.current = true;
    startRoleTour(userRole);
  }, [isPending, effectiveAuthenticated, userRole, location]);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking session...
        </div>
      </div>
    );
  }

  if (showSidebar) {
    return (
      <SidebarProvider style={style as React.CSSProperties}>
        <div className="relative flex h-screen w-full overflow-hidden bg-background">
          <AppSidebar userRole={userRole} />
          <div className="relative z-10 flex flex-col flex-1 overflow-hidden">
            <header className="flex items-center justify-between gap-3 border-b border-border px-3 py-3 bg-background">
              <div className="flex items-center gap-3">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                <div className="hidden sm:block">
                  <p className="font-display text-sm font-semibold tracking-tight">TrialAtlas</p>
                  <p className="text-xs text-muted-foreground">Clinical Trial Discovery</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                {userRole ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Take product tour"
                    data-testid="button-tour-trigger"
                    onClick={() => restartRoleTour(userRole)}
                  >
                    <Compass className="h-5 w-5" />
                    <span className="sr-only">Take product tour</span>
                  </Button>
                ) : null}
                <UserMenu />
              </div>
            </header>
            <main className="flex-1 overflow-auto">
              <Router isAuthenticated={effectiveAuthenticated} userRole={userRole ?? null} preAuthRole={preAuthRole} />
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  return <Router isAuthenticated={effectiveAuthenticated} userRole={userRole ?? null} preAuthRole={preAuthRole} />;
}

// Main App component - provides context to children
function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="trialatlas-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AppContent />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
