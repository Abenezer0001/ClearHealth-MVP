import {
  BarChart3,
  Stethoscope,
  AlertTriangle,
  Heart,
  Inbox,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

type UserRole = "patient" | "coordinator";

const coreNavItems = [
  {
    title: "Find Trials",
    url: "/",
    icon: Stethoscope,
    description: "Search clinical trials",
    allowedRoles: ["patient", "coordinator"] as UserRole[],
  },
  {
    title: "Connect Health Record",
    url: "/connect-ehr",
    icon: Heart,
    description: "Import your EHR data",
    allowedRoles: ["patient"] as UserRole[],
  },
  {
    title: "Coordinator Inbox",
    url: "/coordinator-inbox",
    icon: Inbox,
    description: "View patient leads",
    allowedRoles: ["coordinator"] as UserRole[],
  },
  {
    title: "Admin",
    url: "/admin",
    icon: BarChart3,
    description: "Dashboard & insights",
    allowedRoles: ["coordinator"] as UserRole[],
  },
];

interface AppSidebarProps {
  userRole: UserRole;
}

export function AppSidebar({ userRole }: AppSidebarProps) {
  const [location] = useLocation();

  // Filter nav items by user role
  const visibleNavItems = coreNavItems.filter((item) =>
    item.allowedRoles.includes(userRole)
  );

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/90 shadow-md">
            <Stethoscope className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="font-display text-lg font-semibold tracking-tight">TrialAtlas</span>
            <span className="text-xs text-muted-foreground">Clinical Trial Discovery</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url || (item.url !== "/" && location.startsWith(item.url))}
                  >
                    <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="h-3 w-3" />
          <span>For informational purposes only. Not medical advice.</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
