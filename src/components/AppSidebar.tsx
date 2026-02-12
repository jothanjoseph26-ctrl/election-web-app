import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Shield, LayoutDashboard, Users, Upload, FileText, CreditCard, Megaphone, MessageSquare, Search as SearchIcon, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/", roles: ["admin", "operator"] },
  { title: "Search", icon: SearchIcon, path: "/search", roles: ["admin", "operator"] },
  { title: "Agent Directory", icon: Users, path: "/agents", roles: ["admin", "operator"] },
  { title: "Import Agents", icon: Upload, path: "/import", roles: ["admin"] },
  { title: "Reports", icon: FileText, path: "/reports", roles: ["admin", "operator"] },
  { title: "Payments", icon: CreditCard, path: "/payments", roles: ["admin"] },
  { title: "Broadcasts", icon: Megaphone, path: "/broadcasts", roles: ["admin"] },
  { title: "WhatsApp", icon: MessageSquare, path: "/whatsapp", roles: ["admin"] },
];

export function AppSidebar() {
  const { role, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const filtered = navItems.filter((item) => role && item.roles.includes(role));

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
            <Shield className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-bold text-sidebar-foreground">AMAC Situation Room</p>
            <p className="text-xs text-sidebar-foreground/60">Election Day HQ</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filtered.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={location.pathname === item.path}
                    onClick={() => navigate(item.path)}
                    tooltip={item.title}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="mb-2 text-xs text-sidebar-foreground/60">
          <p className="font-medium text-sidebar-foreground">{profile?.full_name}</p>
          <p className="capitalize">{role}</p>
        </div>
        <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/60" onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
