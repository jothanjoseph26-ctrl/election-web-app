import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Search } from "lucide-react";
import { ExportControls } from "@/components/ExportControls";

interface Report {
  id: string;
  report_type: string;
  details: string;
  ward_number: string | null;
  created_at: string;
  operator_id: string;
  agents: { full_name: string } | null;
}

export default function Reports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Get unique wards for filter options
  const uniqueWards = Array.from(new Set(reports.map(r => r.ward_number).filter(Boolean)));
  
  const reportTypes = ["turnout_update", "incident", "material_shortage", "emergency", "other"];

  const fetchReports = async () => {
    const { data } = await supabase
      .from("reports")
      .select("*, agents(full_name)")
      .order("created_at", { ascending: false });
    setReports((data as unknown as Report[]) ?? []);
  };

  useEffect(() => {
    fetchReports();
    const channel = supabase
      .channel("reports-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reports" }, fetchReports)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = reports.filter((r) => {
    const matchType = typeFilter === "all" || r.report_type === typeFilter;
    const matchSearch = !search || r.details.toLowerCase().includes(search.toLowerCase()) || r.agents?.full_name.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const typeColor = (type: string) => {
    switch (type) {
      case "emergency": return "destructive";
      case "incident": return "destructive";
      case "material_shortage": return "outline";
      default: return "secondary";
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-3 space-y-4">
        <h1 className="text-2xl font-bold">Reports</h1>

        <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search reports..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Report Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="turnout_update">Turnout Update</SelectItem>
            <SelectItem value="incident">Incident</SelectItem>
            <SelectItem value="material_shortage">Material Shortage</SelectItem>
            <SelectItem value="emergency">Emergency</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">{filtered.length} reports</p>

      <div className="space-y-3">
        {filtered.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-medium">{r.agents?.full_name ?? "Unknown Agent"}</span>
                    <Badge variant={typeColor(r.report_type)}>{r.report_type.replace("_", " ")}</Badge>
                    {r.ward_number && <span className="text-xs text-muted-foreground">Ward {r.ward_number}</span>}
                  </div>
                  <p className="text-sm text-muted-foreground">{r.details}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {format(new Date(r.created_at), "MMM d, HH:mm")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">No reports found</p>}
      </div>

      {/* Export Controls Sidebar */}
      <div className="lg:col-span-1">
        <ExportControls
          exportType="reports"
          title="Export Reports"
          description="Download reports data in CSV or Excel format"
          filters={{
            reportTypes,
            wards: uniqueWards as string[]
          }}
        />
      </div>
    </div>
    </div>
  );
}
