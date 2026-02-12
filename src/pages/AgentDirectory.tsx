import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Search, ShieldCheck, Phone, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Agent {
  id: string;
  full_name: string;
  phone_number: string | null;
  ward_number: string | null;
  ward_name: string | null;
  pin: string;
  verification_status: string;
  payment_status: string;
}

export default function AgentDirectory() {
  const { role, user } = useAuth();
  const { toast } = useToast();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [search, setSearch] = useState("");
  const [wardFilter, setWardFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportType, setReportType] = useState("turnout_update");
  const [reportDetails, setReportDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchAgents = async () => {
    const { data } = await supabase.from("agents").select("*").order("ward_number").order("full_name");
    setAgents((data as Agent[]) ?? []);
  };

  useEffect(() => { fetchAgents(); }, []);

  const wards = [...new Set(agents.map((a) => a.ward_number).filter(Boolean))] as string[];

  const filtered = agents.filter((a) => {
    const matchSearch = !search || a.full_name.toLowerCase().includes(search.toLowerCase()) || a.phone_number?.includes(search) || a.ward_number?.includes(search);
    const matchWard = wardFilter === "all" || a.ward_number === wardFilter;
    const matchStatus = statusFilter === "all" || a.verification_status === statusFilter;
    return matchSearch && matchWard && matchStatus;
  });

  const handleVerify = async (agent: Agent) => {
    await supabase.from("agents").update({ verification_status: "verified" }).eq("id", agent.id);
    toast({ title: "Agent verified", description: `${agent.full_name} has been verified.` });
    fetchAgents();
    setSelectedAgent(null);
  };

  const handleReport = async () => {
    if (!selectedAgent || !user) return;
    setSubmitting(true);
    const { error } = await supabase.from("reports").insert({
      agent_id: selectedAgent.id,
      operator_id: user.id,
      report_type: reportType,
      details: reportDetails,
      ward_number: selectedAgent.ward_number,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Report submitted" });
      await supabase.from("agents").update({ last_report_at: new Date().toISOString() }).eq("id", selectedAgent.id);
      setReportOpen(false);
      setReportDetails("");
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Agent Directory</h1>

      {/* Search & Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name, phone, or ward..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={wardFilter} onValueChange={setWardFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Ward" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Wards</SelectItem>
            {wards.map((w) => <SelectItem key={w} value={w}>Ward {w}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="unverified">Unverified</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">{filtered.length} agents found</p>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Ward</TableHead>
                <TableHead>PIN</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No agents found</TableCell></TableRow>
              ) : (
                filtered.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell className="font-medium">{agent.full_name}</TableCell>
                    <TableCell>{agent.phone_number ?? "—"}</TableCell>
                    <TableCell>{agent.ward_number ? `Ward ${agent.ward_number}` : "—"}{agent.ward_name ? ` (${agent.ward_name})` : ""}</TableCell>
                    <TableCell className="font-mono">{agent.pin}</TableCell>
                    <TableCell>
                      <Badge variant={agent.verification_status === "verified" ? "default" : "outline"} className={agent.verification_status === "verified" ? "bg-success text-success-foreground" : ""}>
                        {agent.verification_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => { setSelectedAgent(agent); }}>
                          <Phone className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setSelectedAgent(agent); setReportOpen(true); }}>
                          <FileText className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Agent Detail Dialog */}
      <Dialog open={!!selectedAgent && !reportOpen} onOpenChange={(open) => { if (!open) setSelectedAgent(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Agent Details</DialogTitle></DialogHeader>
          {selectedAgent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-muted-foreground">Name</p><p className="font-medium">{selectedAgent.full_name}</p></div>
                <div><p className="text-muted-foreground">Phone</p><p className="font-medium">{selectedAgent.phone_number ?? "—"}</p></div>
                <div><p className="text-muted-foreground">Ward</p><p className="font-medium">{selectedAgent.ward_number ?? "—"} {selectedAgent.ward_name ? `(${selectedAgent.ward_name})` : ""}</p></div>
                <div><p className="text-muted-foreground">PIN</p><p className="font-mono font-medium">{selectedAgent.pin}</p></div>
                <div><p className="text-muted-foreground">Verification</p><Badge variant={selectedAgent.verification_status === "verified" ? "default" : "outline"}>{selectedAgent.verification_status}</Badge></div>
                <div><p className="text-muted-foreground">Payment</p><Badge variant="outline">{selectedAgent.payment_status}</Badge></div>
              </div>
              <div className="flex gap-2">
                {selectedAgent.verification_status !== "verified" && (
                  <Button onClick={() => handleVerify(selectedAgent)} className="bg-success hover:bg-success/90">
                    <ShieldCheck className="mr-2 h-4 w-4" />Verify Agent
                  </Button>
                )}
                <Button variant="outline" onClick={() => setReportOpen(true)}>
                  <FileText className="mr-2 h-4 w-4" />Log Report
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Report Entry Dialog */}
      <Dialog open={reportOpen} onOpenChange={(open) => { if (!open) { setReportOpen(false); setSelectedAgent(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Log Report — {selectedAgent?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Report Type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="turnout_update">Turnout Update</SelectItem>
                  <SelectItem value="incident">Incident</SelectItem>
                  <SelectItem value="material_shortage">Material Shortage</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Details</Label>
              <Textarea value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} placeholder="Enter report details..." rows={4} />
            </div>
            <Button onClick={handleReport} disabled={submitting || !reportDetails.trim()} className="w-full">
              {submitting ? "Submitting..." : "Submit Report"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
