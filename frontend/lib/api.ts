export const API = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8765").replace(/\/$/, "");

export type Cell = { value: number; raw: string; bbox: number[]; original?: number; overridden?: boolean };
export type Row = {
  id: string;
  statement: "BS" | "IS" | "CF";
  page: number;
  section: string;
  label: string;
  note: string | null;
  values: Record<string, Cell>;
  label_bbox: number[] | null;
  is_subtotal: boolean;
  verified_sum_of: string[];
  doc_id: string;
  unit: number;
  code: string | null;
  confidence: "high" | "medium" | "disputed" | "analyst" | null;
  map_source: string | null;
  rule_code: string | null;
  ai_code: string | null;
};
export type SpreadVal = { value: number; rows: string[]; derived: boolean; formula?: string; inputs?: string[]; doc_id?: string };
export type SpreadItem = { code: string; name: string; statement: string; values: Record<string, SpreadVal> };
export type Check = {
  id: string;
  check: string;
  period: string | null;
  status: "pass" | "fail" | "warn" | "info";
  severity: string | null;
  expected?: number | null;
  actual?: number | null;
  difference?: number | null;
  inputs?: string[];
  rows?: string[];
  note?: string;
  page?: number;
  bbox?: number[];
  doc_id?: string;
  missing?: string[];
};
export type Ratio = {
  key: string;
  name: string;
  unit: "x" | "%" | "days";
  formula: string;
  inputs: string[];
  values: Record<string, number>;
  notes: Record<string, string>;
  higher_is_better: boolean | null;
};
export type PolicyResult = {
  ratio: string;
  name: string;
  unit: string;
  period: string;
  value: number | null;
  rule: Record<string, number>;
  status: "pass" | "watch" | "breach" | "n/a" | "n/m";
  note?: string;
};
export type Signal = { id: string; severity: "high" | "medium" | "low"; title: string; detail: string; facts: string[] };
export type Sentence = { text: string; citations: string[]; status: "verified" | "unverified" | "narrative"; problems: string[] };
export type Fact = { label: string; display: string; value: number | null; kind: string; code: string; period: string };
export type Memo = {
  engine: "llm" | "template";
  llm_meta: { model: string; latency_ms: number } | null;
  llm_error: string | null;
  sections: { title: string; sentences: Sentence[]; edited_by?: string }[];
  stats: { sentences: number; verified: number; unverified: number; narrative?: number; numbers_checked: number };
  questions: string[];
  facts: Record<string, Fact>;
  stale?: boolean;
};
export type TraceStep = { key: string; title: string; status: "running" | "done" | "warn" | "error"; detail: string; ms: number | null };
export type Doc = {
  id: string;
  filename: string;
  size: number;
  pages?: number;
  periods: string[];
  unit: number;
  basis?: string;
  scanned_pages?: number;
  statement_pages?: { page: number; statement: string; width: number; height: number; title: string }[];
  mapping_info?: Record<string, unknown>;
};
export type AuditEntry = { ts: string; actor: string; action: string; detail: string };
export type Case = {
  id: string;
  borrower: string;
  facility: string;
  policy: string;
  analyst: string;
  created_at: string;
  updated_at: string;
  status: "queued" | "processing" | "ready" | "failed" | "in_review" | "submitted" | "returned";
  error?: string;
  documents: Doc[];
  trace: TraceStep[];
  rows: Row[];
  overrides: Record<string, { code?: string | null; values?: Record<string, number>; reason: string; actor: string; ts: string }>;
  confirmed?: Record<string, { actor: string; ts: string }>;
  spread: Record<string, SpreadItem>;
  periods: string[];
  checks: Check[];
  ratios: Record<string, Ratio>;
  policy_results: PolicyResult[];
  policy_name: string;
  policy_description: string;
  signals: Signal[];
  memo?: Memo;
  audit: AuditEntry[];
  signal_count?: number;
  exception_count?: number;
};
export type CaseSummary = Pick<Case, "id" | "borrower" | "status" | "created_at" | "facility" | "periods" | "signal_count" | "exception_count" | "documents">;
export type Meta = {
  policies: { id: string; name: string; description: string }[];
  taxonomy: { code: string; statement: string; name: string }[];
  samples: { id: string; filename: string }[];
};

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API}${path}`, { cache: "no-store", ...init });
  if (!r.ok) {
    let msg = `${r.status}`;
    try {
      const j = await r.json();
      msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch {}
    throw new Error(msg);
  }
  return r.json();
}

export const api = {
  health: () => req<{ ok: boolean; llm: { configured: boolean; model: string }; store: string }>("/api/health"),
  meta: () => req<Meta>("/api/meta"),
  cases: () => req<CaseSummary[]>("/api/cases"),
  get: (id: string) => req<Case>(`/api/cases/${id}`),
  create: (fd: FormData) => req<Case>("/api/cases", { method: "POST", body: fd }),
  sample: (sid: string, policy = "default") => req<Case>(`/api/cases/sample/${sid}?policy=${policy}`, { method: "POST" }),
  post: <T = Case>(path: string, body: unknown) =>
    req<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  pageUrl: (cid: string, did: string, page: number) => `${API}/api/cases/${cid}/documents/${did}/page/${page}`,
};

// ------------------------------------------------------------------ formatting
export function money(v: number | null | undefined, opts: { compact?: boolean } = {}) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const mn = v / 1_000_000;
  const a = Math.abs(mn);
  const s = a >= 1000 ? a.toLocaleString("en-US", { maximumFractionDigits: 0 }) : a.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const body = opts.compact ? s : s;
  return mn < 0 ? `(${body})` : body;
}
export function ratio(v: number | null | undefined, unit: string) {
  if (v === null || v === undefined) return "—";
  if (unit === "%") return `${(v * 100).toFixed(1)}%`;
  if (unit === "days") return `${Math.round(v)}d`;
  return `${v.toFixed(2)}x`;
}
export function rawThousands(v: number) {
  const s = Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}
export const STMT_NAME: Record<string, string> = { BS: "Balance sheet", IS: "Profit & loss", CF: "Cash flow", X: "Derived" };
