import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home";
import AnalysisPage from "@/pages/analysis";
import HistoryPage from "@/pages/history";
import AdminPage from "@/pages/admin";
import DesignSystemPage from "@/pages/design-system";
import ComponentsLabPage from "@/pages/components-lab";
import MotionPage from "@/pages/motion";
import ResourcesPage from "@/pages/resources";

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/analysis/:id" component={AnalysisPage} />
      <Route path="/history" component={HistoryPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/design-system" component={DesignSystemPage} />
      <Route path="/components-lab" component={ComponentsLabPage} />
      <Route path="/motion" component={MotionPage} />
      <Route path="/resources" component={ResourcesPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <ThemeProvider defaultTheme="dark" storageKey="clearhealth-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SidebarProvider style={style as React.CSSProperties}>
            <div className="relative flex h-screen w-full overflow-hidden">
              <div className="aurora-blob -top-36 left-[-10rem] h-80 w-80 bg-primary/25" />
              <div className="aurora-blob top-1/2 right-[-8rem] h-72 w-72 bg-accent/25 [animation-delay:1.4s]" />
              <AppSidebar />
              <div className="relative z-10 flex flex-col flex-1 overflow-hidden">
                <header className="flex items-center justify-between gap-3 p-3 border-b border-border/70 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/55">
                  <div className="flex items-center gap-3">
                    <SidebarTrigger data-testid="button-sidebar-toggle" />
                    <div className="hidden sm:block">
                      <p className="font-display text-sm font-semibold tracking-tight">ClearHealth UI System</p>
                      <p className="text-xs text-muted-foreground">Business logic preserved, design system upgraded</p>
                    </div>
                  </div>
                  <ThemeToggle />
                </header>
                <main className="flex-1 overflow-auto">
                  <Router />
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
