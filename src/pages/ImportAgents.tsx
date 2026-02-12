import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, AlertTriangle, CheckCircle, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ParsedAgent {
  full_name: string;
  ward_number: string;
  ward_name: string;
  phone_number: string;
  issues: string[];
}

function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function parseCSV(text: string): ParsedAgent[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/[\s_]+/g, "_"));
  
  const nameIdx = headers.findIndex((h) => h.includes("name"));
  const wardNumIdx = headers.findIndex((h) => h.includes("ward") && (h.includes("num") || h.includes("no") || h === "ward"));
  const wardNameIdx = headers.findIndex((h) => h.includes("ward") && h.includes("name"));
  const phoneIdx = headers.findIndex((h) => h.includes("phone") || h.includes("mobile") || h.includes("number"));

  return lines.slice(1).filter((l) => l.trim()).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const agent: ParsedAgent = {
      full_name: nameIdx >= 0 ? cols[nameIdx] || "" : "",
      ward_number: wardNumIdx >= 0 ? cols[wardNumIdx] || "" : "",
      ward_name: wardNameIdx >= 0 ? cols[wardNameIdx] || "" : "",
      phone_number: phoneIdx >= 0 ? cols[phoneIdx] || "" : "",
      issues: [],
    };
    if (!agent.full_name) agent.issues.push("Missing name");
    if (!agent.phone_number) agent.issues.push("Missing phone");
    else if (!/^\+?\d{10,15}$/.test(agent.phone_number.replace(/[\s-]/g, ""))) agent.issues.push("Invalid phone format");
    return agent;
  });
}

export default function ImportAgents() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedAgent[]>([]);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setParsed(parseCSV(text));
      setImported(false);
    };
    reader.readAsText(file);
  };

  const issueCount = parsed.filter((a) => a.issues.length > 0).length;

  const handleImport = async () => {
    setImporting(true);
    const agents = parsed.map((a) => ({
      full_name: a.full_name || "Unknown",
      phone_number: a.phone_number || null,
      ward_number: a.ward_number || null,
      ward_name: a.ward_name || null,
      pin: generatePin(),
    }));

    // Batch insert in chunks of 100
    for (let i = 0; i < agents.length; i += 100) {
      const chunk = agents.slice(i, i + 100);
      const { error } = await supabase.from("agents").insert(chunk);
      if (error) {
        toast({ title: "Import error", description: error.message, variant: "destructive" });
        setImporting(false);
        return;
      }
    }

    toast({ title: "Import complete", description: `${agents.length} agents imported successfully.` });
    setImported(true);
    setImporting(false);
  };

  const removeRow = (idx: number) => {
    setParsed((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Import Agents</h1>

      <Card>
        <CardHeader>
          <CardTitle>Upload CSV File</CardTitle>
          <CardDescription>
            Upload a CSV with columns: Name, Ward Number, Ward Name, Phone Number. Each agent will be auto-assigned a unique 4-digit PIN.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" />
          <Button onClick={() => fileRef.current?.click()} variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            Choose CSV File
          </Button>
        </CardContent>
      </Card>

      {parsed.length > 0 && (
        <>
          <div className="flex items-center gap-4">
            <Badge variant="secondary">{parsed.length} rows parsed</Badge>
            {issueCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />{issueCount} issues
              </Badge>
            )}
            {imported && (
              <Badge className="bg-success text-success-foreground gap-1">
                <CheckCircle className="h-3 w-3" />Imported
              </Badge>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Ward #</TableHead>
                      <TableHead>Ward Name</TableHead>
                      <TableHead>Issues</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.map((a, i) => (
                      <TableRow key={i} className={a.issues.length > 0 ? "bg-destructive/5" : ""}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{a.full_name || "—"}</TableCell>
                        <TableCell>{a.phone_number || "—"}</TableCell>
                        <TableCell>{a.ward_number || "—"}</TableCell>
                        <TableCell>{a.ward_name || "—"}</TableCell>
                        <TableCell>
                          {a.issues.map((issue, j) => (
                            <Badge key={j} variant="destructive" className="mr-1 text-xs">{issue}</Badge>
                          ))}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => removeRow(i)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {!imported && (
            <Button onClick={handleImport} disabled={importing} size="lg">
              {importing ? "Importing..." : `Import ${parsed.length} Agents`}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
