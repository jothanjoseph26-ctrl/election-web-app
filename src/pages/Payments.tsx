import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ExportControls } from "@/components/ExportControls";

interface Agent {
  id: string;
  full_name: string;
  phone_number: string | null;
  ward_number: string | null;
  payment_status: string;
  payment_amount: number;
  payment_reference: string | null;
}

export default function Payments() {
  const { toast } = useToast();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<Agent | null>(null);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchAgents = async () => {
    const { data } = await supabase.from("agents").select("id, full_name, phone_number, ward_number, payment_status, payment_amount, payment_reference").order("ward_number").order("full_name");
    setAgents((data as Agent[]) ?? []);
  };

  useEffect(() => { fetchAgents(); }, []);

  const filtered = agents.filter((a) => {
    const matchSearch = !search || a.full_name.toLowerCase().includes(search.toLowerCase()) || a.phone_number?.includes(search);
    const matchStatus = statusFilter === "all" || a.payment_status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handlePayment = async () => {
    if (!selected) return;
    if (selected.payment_status === "sent") {
      toast({ title: "Warning", description: "Payment already sent to this agent!", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    await supabase.from("agents").update({
      payment_status: "sent",
      payment_amount: parseFloat(amount) || 0,
      payment_reference: reference,
      payment_sent_at: new Date().toISOString(),
    }).eq("id", selected.id);
    toast({ title: "Payment recorded", description: `Payment of ₦${amount} sent to ${selected.full_name}` });
    setSelected(null);
    setAmount("");
    setReference("");
    setSubmitting(false);
    fetchAgents();
  };

  const paid = agents.filter((a) => a.payment_status === "sent").length;
  const totalAmount = agents.filter((a) => a.payment_status === "sent").reduce((sum, a) => sum + (a.payment_amount || 0), 0);

  // Get unique wards for filter options
  const uniqueWards = Array.from(new Set(agents.map(a => a.ward_number).filter(Boolean)));
  const paymentStatuses = ["pending", "sent"];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-3 space-y-4">
      <h1 className="text-2xl font-bold">Payment Tracking</h1>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Paid</p><p className="text-2xl font-bold">{paid}/{agents.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Pending</p><p className="text-2xl font-bold">{agents.length - paid}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Sent</p><p className="text-2xl font-bold">₦{totalAmount.toLocaleString()}</p></CardContent></Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search agents..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Ward</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.full_name}</TableCell>
                  <TableCell>{a.ward_number ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={a.payment_status === "sent" ? "default" : "outline"} className={a.payment_status === "sent" ? "bg-success text-success-foreground" : ""}>
                      {a.payment_status}
                    </Badge>
                  </TableCell>
                  <TableCell>{a.payment_amount ? `₦${a.payment_amount.toLocaleString()}` : "—"}</TableCell>
                  <TableCell className="text-xs">{a.payment_reference ?? "—"}</TableCell>
                  <TableCell>
                    {a.payment_status === "pending" && (
                      <Button size="sm" variant="outline" onClick={() => { setSelected(a); setAmount(""); setReference(""); }}>
                        <CreditCard className="mr-1 h-3.5 w-3.5" />Pay
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Payment — {selected?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Amount (₦)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="5000" />
            </div>
            <div className="space-y-2">
              <Label>Reference Number</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. TRX-12345" />
            </div>
            <Button onClick={handlePayment} disabled={submitting || !amount} className="w-full">
              {submitting ? "Recording..." : "Confirm Payment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Export Controls Sidebar */}
      <div className="lg:col-span-1">
        <ExportControls
          exportType="payments"
          title="Export Payments"
          description="Download payment data in CSV or Excel format"
          filters={{
            paymentStatuses,
            wards: uniqueWards as string[]
          }}
        />
      </div>
    </div>
    </div>
  );
}
