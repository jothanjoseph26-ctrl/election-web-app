import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Megaphone, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Broadcast {
  id: string;
  message: string;
  priority: string;
  created_at: string;
  sender_id: string;
}

export default function Broadcasts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("normal");
  const [submitting, setSubmitting] = useState(false);

  const fetchBroadcasts = async () => {
    const { data } = await supabase
      .from("broadcasts")
      .select("*")
      .order("created_at", { ascending: false });
    setBroadcasts((data as unknown as Broadcast[]) ?? []);
  };

  useEffect(() => {
    fetchBroadcasts();
    const channel = supabase
      .channel("broadcasts-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "broadcasts" }, fetchBroadcasts)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleSend = async () => {
    if (!user || !message.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("broadcasts").insert({
      sender_id: user.id,
      message: message.trim(),
      priority,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Broadcast sent" });
      setMessage("");
      setPriority("normal");
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Broadcast Notes</h1>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type your broadcast message..." rows={3} />
          </div>
          <div className="flex items-end gap-3">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSend} disabled={submitting || !message.trim()}>
              <Megaphone className="mr-2 h-4 w-4" />
              {submitting ? "Sending..." : "Send Broadcast"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {broadcasts.map((b) => (
          <Card key={b.id} className={b.priority === "urgent" ? "border-destructive" : ""}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {b.priority === "urgent" ? (
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                ) : (
                  <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                )}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {b.priority === "urgent" && <Badge variant="destructive">URGENT</Badge>}
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(b.created_at), "MMM d, HH:mm")}
                    </span>
                  </div>
                  <p className="text-sm">{b.message}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {broadcasts.length === 0 && <p className="text-center text-muted-foreground py-8">No broadcasts yet</p>}
      </div>
    </div>
  );
}
