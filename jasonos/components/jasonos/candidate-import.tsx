"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import Papa from "papaparse";
import { Upload, FileText, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ALL_CLUSTERS, CLUSTER_LABEL, type AlumniCluster } from "@/lib/ranker/score";
import { bulkInsertContacts } from "@/lib/actions/contacts";

type ColField =
  | "name"
  | "email"
  | "linkedin_url"
  | "title"
  | "last_touch_date"
  | "alumni_cluster"
  | "ignore";

const FIELD_LABEL: Record<ColField, string> = {
  name: "Name (required)",
  email: "Email",
  linkedin_url: "LinkedIn URL",
  title: "Title",
  last_touch_date: "Last contact date",
  alumni_cluster: "Alumni cluster",
  ignore: "— ignore —",
};

const FIELD_GUESS: Array<{ field: ColField; matchers: string[] }> = [
  { field: "name", matchers: ["name", "full name", "first name", "contact"] },
  { field: "email", matchers: ["email", "e-mail", "mail"] },
  { field: "linkedin_url", matchers: ["linkedin", "li url", "profile"] },
  { field: "title", matchers: ["title", "role", "position", "job"] },
  { field: "last_touch_date", matchers: ["last contact", "last touch", "last meeting", "date"] },
  { field: "alumni_cluster", matchers: ["alumni", "cluster", "company", "org", "where"] },
];

function guessField(header: string): ColField {
  const h = header.toLowerCase();
  for (const { field, matchers } of FIELD_GUESS) {
    if (matchers.some((m) => h.includes(m))) return field;
  }
  return "ignore";
}

function guessCluster(value: string | undefined): AlumniCluster | "" {
  if (!value) return "";
  const v = value.toLowerCase();
  for (const c of ALL_CLUSTERS) {
    if (v.includes(c)) return c;
    if (c === "agency" && v.includes("agency.com")) return c;
  }
  return "";
}

interface ParsedRow {
  values: Record<string, string>;
  cluster: AlumniCluster | "";
}

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
}

export function CandidateImport({ open, onOpenChange }: Props) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, ColField>>({});
  const [defaultCluster, setDefaultCluster] = useState<AlumniCluster | "">("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isImporting, startImport] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const reset = useCallback(() => {
    setHeaders([]);
    setRows([]);
    setMapping({});
    setDefaultCluster("");
    setFileName(null);
    setErrorMsg(null);
    setStatusMsg(null);
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      reset();
      setFileName(file.name);
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => {
          const fields = res.meta.fields ?? [];
          if (fields.length === 0) {
            setErrorMsg("CSV has no header row.");
            return;
          }
          setHeaders(fields);
          const initialMap: Record<string, ColField> = {};
          for (const h of fields) initialMap[h] = guessField(h);
          setMapping(initialMap);

          const parsed: ParsedRow[] = (res.data ?? []).map((r) => {
            const clusterCol = fields.find((f) => initialMap[f] === "alumni_cluster");
            const guessed = clusterCol ? guessCluster(r[clusterCol]) : "";
            return { values: r, cluster: guessed };
          });
          setRows(parsed);
        },
        error: (err) => {
          setErrorMsg(`CSV parse failed: ${err.message}`);
        },
      });
    },
    [reset]
  );

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const colByField = useMemo(() => {
    const out: Partial<Record<ColField, string>> = {};
    for (const [col, field] of Object.entries(mapping)) {
      if (field !== "ignore") out[field] = col;
    }
    return out;
  }, [mapping]);

  const previewRows = rows.slice(0, 5);

  const handleImport = () => {
    setErrorMsg(null);
    setStatusMsg(null);
    if (!colByField.name) {
      setErrorMsg("Map a column to 'Name' before importing.");
      return;
    }

    const payload = rows.map((row) => {
      const get = (f: ColField) => {
        const col = colByField[f];
        return col ? row.values[col]?.trim() : undefined;
      };
      const email = get("email");
      const cluster: AlumniCluster | undefined =
        row.cluster || defaultCluster || undefined;
      return {
        name: get("name") ?? "",
        emails: email ? [email] : [],
        linkedin_url: get("linkedin_url") || undefined,
        title: get("title") || undefined,
        last_touch_date: get("last_touch_date") || undefined,
        alumniCluster: cluster as AlumniCluster | undefined,
      };
    });

    startImport(async () => {
      const res = await bulkInsertContacts(payload);
      if (!res.ok) {
        setErrorMsg(res.error ?? "Insert failed.");
        return;
      }
      setStatusMsg(`Imported ${res.inserted ?? 0} contacts.`);
      setTimeout(() => {
        onOpenChange(false);
        reset();
      }, 1200);
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(b) => {
        onOpenChange(b);
        if (!b) reset();
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import contacts</DialogTitle>
          <DialogDescription>
            CSV upload. Map columns once, then bulk-insert into{" "}
            <code>jasonos.contacts</code>. Alumni cluster gets prefixed
            <code className="ml-1">alumni:</code>and stored on{" "}
            <code>tags</code>.
          </DialogDescription>
        </DialogHeader>

        {headers.length === 0 ? (
          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-muted/20 p-10 text-center"
          >
            <Upload className="h-8 w-8 text-muted-foreground/60" />
            <div className="text-xs text-muted-foreground">
              Drop a CSV here, or
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose file
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={onPick}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{fileName}</span>
                <span className="text-muted-foreground">
                  · {rows.length} rows
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={reset}
                className="h-7 gap-1 text-xs"
              >
                <X className="h-3 w-3" />
                Clear
              </Button>
            </div>

            {/* Column mapping */}
            <div className="rounded-md border bg-card p-3">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Column mapping
              </h3>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {headers.map((h) => (
                  <div key={h} className="flex items-center gap-2 text-xs">
                    <span className="w-1/2 truncate font-mono text-muted-foreground">
                      {h}
                    </span>
                    <Select
                      value={mapping[h]}
                      onValueChange={(v) =>
                        setMapping((m) => ({ ...m, [h]: v as ColField }))
                      }
                    >
                      <SelectTrigger className="h-7 flex-1 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(FIELD_LABEL) as ColField[]).map((f) => (
                          <SelectItem key={f} value={f}>
                            {FIELD_LABEL[f]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            {/* Default cluster */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">
                Default alumni cluster (used when no cluster on row):
              </span>
              <Select
                value={defaultCluster || "__none"}
                onValueChange={(v) =>
                  setDefaultCluster(v === "__none" ? "" : (v as AlumniCluster))
                }
              >
                <SelectTrigger className="h-7 w-[160px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">None</SelectItem>
                  {ALL_CLUSTERS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CLUSTER_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Preview */}
            <div className="overflow-hidden rounded-md border">
              <div className="bg-muted/40 px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                Preview · first {previewRows.length} rows
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead className="bg-muted/20">
                    <tr>
                      {headers.map((h) => (
                        <th
                          key={h}
                          className="px-2 py-1 text-left font-mono text-muted-foreground"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r, i) => (
                      <tr key={i} className="border-t border-border/60">
                        {headers.map((h) => (
                          <td key={h} className="px-2 py-1 align-top">
                            {r.values[h] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {errorMsg ? (
          <div className="rounded-md border border-red-500/30 bg-red-500/5 px-2 py-1.5 text-[11px] text-red-300">
            {errorMsg}
          </div>
        ) : null}
        {statusMsg ? (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2 py-1.5 text-[11px] text-emerald-300">
            {statusMsg}
          </div>
        ) : null}

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isImporting}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleImport}
            disabled={rows.length === 0 || isImporting}
            className="bg-sky-500 hover:bg-sky-400 text-white"
          >
            {isImporting ? "Importing…" : `Import ${rows.length} contacts`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
