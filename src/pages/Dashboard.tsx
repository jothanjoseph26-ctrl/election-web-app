import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, FileText, CreditCard, AlertTriangle, Clock } from "lucide-react";
import { format } from "date-fns";

interface DashboardStats {
  totalAgents: number;
  verifiedAgents: number;
  totalReports: number;
  paymentsSent: number;
  pendingPayments: number;
}

interface RecentReport {
  id: string;
  report_type: string;
  details: string;
  ward_number: string | null;
  created_at: string;
  agents: { full_name: string } | null;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalAgents: 0, verifiedAgents: 0, totalReports: 0, paymentsSent: 0, pendingPayments: 0,
  });
  const [recentReports, setRecentReports] = useState<RecentReport[]>([]);
  const [wardStats, setWardStats] = useState<{ ward: string; reported: boolean }[]>([]);

  const fetchData = async () => {
    const [agentsRes, reportsRes, recentRes] = await Promise.all([
      supabase.from("agents").select("verification_status, payment_status, ward_number"),
      supabase.from("reports").select("id"),
      supabase.from("reports").select("id, report_type, details, ward_number, created_at, agents(full_name)").order("created_at", { ascending: false }).limit(20),
    ]);

    const agents = agentsRes.data ?? [];
    setStats({
      totalAgents: agents.length,
      verifiedAgents: agents.filter((a) => a.verification_status === "verified").length,
      totalReports: reportsRes.data?.length ?? 0,
      paymentsSent: agents.filter((a) => a.payment_status === "sent").length,
      pendingPayments: agents.filter((a) => a.payment_status === "pending").length,
    });
    setRecentReports((recentRes.data as unknown as RecentReport[]) ?? []);

    // Ward status
    const wards = [...new Set(agents.map((a) => a.ward_number).filter(Boolean))] as string[];
    const reportedWards = new Set((recentRes.data ?? []).map((r: any) => r.ward_number).filter(Boolean));
    setWardStats(wards.sort().map((w) => ({ ward: w, reported: reportedWards.has(w) })));
  };

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "reports" }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "agents" }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const reportTypeColor = (type: string) => {
    switch (type) {
      case "emergency": return "destructive";
      case "incident": return "destructive";
      case "material_shortage": return "outline";
      default: return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Situation Room Dashboard</h1>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Agents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalAgents}</p>
            <p className="text-xs text-muted-foreground">{stats.verifiedAgents} verified</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Reports</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalReports}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Payments Sent</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.paymentsSent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Payments</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.pendingPayments}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Ward Status Board */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ward Status</CardTitle>
          </CardHeader>
          <CardContent>
            {wardStats.length === 0 ? (
              <p className="text-sm text-muted-foreground">No agents imported yet. Import agents to see ward status.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {wardStats.map((w) => (
                  <Badge key={w.ward} variant={w.reported ? "default" : "outline"} className={w.reported ? "bg-success text-success-foreground" : ""}>
                    Ward {w.ward}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Live Activity Feed */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Live Activity Feed</CardTitle>
          </CardHeader>
          <CardContent>
            {recentReports.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reports yet. Reports will appear here in real-time.</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {recentReports.map((r) => (
                  <div key={r.id} className="flex items-start gap-3 rounded-lg border p-3">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{r.agents?.full_name ?? "Unknown"}</span>
                        <Badge variant={reportTypeColor(r.report_type)} className="text-xs">
                          {r.report_type.replace("_", " ")}
                        </Badge>
                        {r.ward_number && <span className="text-xs text-muted-foreground">Ward {r.ward_number}</span>}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{r.details}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{format(new Date(r.created_at), "HH:mm:ss")}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
