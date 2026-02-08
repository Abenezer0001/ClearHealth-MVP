import { useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { restartCoordinatorTour, restartPatientTour } from "@/lib/patient-tour";
import { useToast } from "@/hooks/use-toast";

export default function UserMenu() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <Skeleton className="h-9 w-24" />;
  }

  if (!session) {
    return (
      <Button variant="outline" size="sm" onClick={() => setLocation("/login")}>
        Sign In
      </Button>
    );
  }

  const userRole = (session.user as any)?.role as string | undefined;
  const canTakeTour = userRole === "patient" || userRole === "coordinator";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-user-menu">
          {session.user.name}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-card">
        <DropdownMenuGroup>
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>{session.user.email}</DropdownMenuItem>
          {canTakeTour && (
            <DropdownMenuItem
              onClick={() => {
                if (userRole === "coordinator") {
                  restartCoordinatorTour();
                  return;
                }
                restartPatientTour();
              }}
            >
              Take Product Tour
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => {
              authClient.signOut({
                fetchOptions: {
                  onSuccess: () => {
                    toast({
                      title: "Signed out",
                    });
                    setLocation("/login");
                  },
                },
              });
            }}
          >
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
