import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { authClient } from "@/lib/auth-client";
import UserMenu from "@/components/user-menu";
import { Loader2 } from "lucide-react";
import NotFound from "@/pages/not-found";
import TrialsPage from "@/pages/trials";
import AdminPage from "@/pages/admin";
import LoginPage from "@/pages/login";
import ConnectEHRPage from "@/pages/connect-ehr";
import CoordinatorInboxPage from "@/pages/coordinator-inbox";

function Router({ isAuthenticated }: { isAuthenticated: boolean }) {
  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route component={LoginPage} />
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/" component={TrialsPage} />
      <Route path="/connect-ehr" component={ConnectEHRPage} />
      {/* /smart/callback renders ConnectEHRPage directly to preserve query params */}
      <Route path="/smart/callback" component={ConnectEHRPage} />
      <Route path="/coordinator-inbox" component={CoordinatorInboxPage} />
      <Route path="/admin" component={AdminPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const { data: session, isPending } = authClient.useSession();
  const isAuthenticated = Boolean(session?.user);
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <ThemeProvider defaultTheme="dark" storageKey="trialatlas-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          {isPending ? (
            <div className="flex min-h-screen items-center justify-center bg-background">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking session...
              </div>
            </div>
          ) : isAuthenticated ? (
            <SidebarProvider style={style as React.CSSProperties}>
              <div className="relative flex h-screen w-full overflow-hidden bg-background">
                <AppSidebar />
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
                      <UserMenu />
                    </div>
                  </header>
                  <main className="flex-1 overflow-auto">
                    <Router isAuthenticated={isAuthenticated} />
                  </main>
                </div>
              </div>
            </SidebarProvider>
          ) : (
            <Router isAuthenticated={isAuthenticated} />
          )}
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
