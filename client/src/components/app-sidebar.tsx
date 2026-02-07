import {
  AlertTriangle,
  BarChart3,
  Compass,
  History,
  LayoutTemplate,
  Shield,
  Sparkles,
  WandSparkles,
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

const coreNavItems = [
  {
    title: "Analyze",
    url: "/",
    icon: Shield,
    description: "Check health claims",
  },
  {
    title: "History",
    url: "/history",
    icon: History,
    description: "View past analyses",
  },
  {
    title: "Admin",
    url: "/admin",
    icon: BarChart3,
    description: "Dashboard & insights",
  },
];

const designNavItems = [
  {
    title: "Design System",
    url: "/design-system",
    icon: Sparkles,
    description: "Token and rules reference",
  },
  {
    title: "Components Lab",
    url: "/components-lab",
    icon: LayoutTemplate,
    description: "Reusable UI modules",
  },
  {
    title: "Motion",
    url: "/motion",
    icon: WandSparkles,
    description: "Animation patterns",
  },
  {
    title: "Resources",
    url: "/resources",
    icon: Compass,
    description: "Curated UI references",
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/90 shadow-md">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="font-display text-lg font-semibold tracking-tight">ClearHealth</span>
            <span className="text-xs text-muted-foreground">Misinformation Detector</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Core Workflow</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {coreNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === item.url || (item.url !== "/" && location.startsWith(item.url))}
                  >
                    <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase()}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Design System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {designNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url || (item.url !== "/" && location.startsWith(item.url))}
                  >
                    <Link href={item.url} data-testid={`link-design-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
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
          <span>Educational use only. Not medical advice.</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
