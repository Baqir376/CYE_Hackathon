import type { Case } from "./api";

/** Latest-year figures in rupees. Costs are positive; np can be negative. */
export type Base = { rev: number; oi: number; cogs: number; ebit: number; fc: number; np: number; debt: number; ca: number; cl: number; inv: number; recv: number; equity: number; liab: number; dep: number; cpltd: number };
export type Shock = { sales: number; rate: number; days: number; vary: number };
export type Rule = { min?: number; max?: number; warn_min?: number; warn_max?: number };
export type Limits = Record<string, Rule>;
export type Knob = "sales" | "rate" | "days";
export const CALM: Shock = { sales: 0, rate: 0, days: 0, vary: 0.85 };

/** One-step scenario. With CALM it reproduces the reported figures exactly. */
export function stress(b: Base, s: Shock) {
  const rev = b.rev * (1 + s.sales);
  const cogs = b.cogs * (1 + s.sales * s.vary);
  const oldDays = b.rev ? (b.recv / b.rev) * 365 : 0;
  const recv = (rev * (oldDays + s.days)) / 365;
  const dRecv = recv - b.recv; // extra money tied up in customers, assumed borrowed
  const ebit = b.ebit + (rev - b.rev) - (cogs - b.cogs);
  const debt = Math.max(0, b.debt + dRecv);
  const cost = b.debt ? b.fc / b.debt : 0;
  const fc = b.fc + debt * s.rate + (debt - b.debt) * cost;
  const pbt = ebit - fc, pbt0 = b.ebit - b.fc;
  const taxRate = pbt0 > 0 ? Math.max(0, (pbt0 - b.np) / pbt0) : 0;
  const tax = pbt > 0 ? pbt * taxRate : pbt0 <= 0 ? pbt0 - b.np : 0;
  const np = pbt - tax, dNp = np - b.np;
  const equity = b.equity + dNp, ca = b.ca + dRecv + dNp, cl = b.cl + dRecv;
  const opex = rev + b.oi - cogs - ebit;
  const div = (x: number, y: number) => (y ? x / y : null);
  const ratios: Record<string, number | null> = {
    current_ratio: div(ca, cl), quick_ratio: div(ca - b.inv, cl), debt_to_equity: div(debt, equity), leverage: div(b.liab + dRecv, equity),
    interest_cover: div(ebit, fc), dscr: div(ebit + b.dep, fc + b.cpltd), net_margin: div(np, rev), receivable_days: div(recv * 365, rev),
  };
  return { rev, cogs, opex, ebit, fc, tax, np, debt, recv, oi: b.oi, ratios };
}

export function verdict(v: number | null | undefined, r: Rule, key = ""): "pass" | "watch" | "breach" | "n/a" {
  if (v === null || v === undefined) return "n/a";
  // negative equity makes these two look better than they are
  if ((key === "debt_to_equity" || key === "leverage") && v < 0) return "breach";
  if ((r.min !== undefined && v < r.min) || (r.max !== undefined && v > r.max)) return "breach";
  if ((r.warn_min !== undefined && v < r.warn_min) || (r.warn_max !== undefined && v > r.warn_max)) return "watch";
  return "pass";
}

/** How far one thing can move, on its own, before a hard limit breaks. */
export function room(b: Base, limits: Limits, key: Knob, far: number, vary = CALM.vary): { at: number | null; ratio: string | null; already?: boolean } {
  const broken = (x: number) => {
    const r = stress(b, { ...CALM, vary, [key]: x }).ratios;
    return Object.keys(limits).find((k) => k in r && verdict(r[k], limits[k], k) === "breach") || null;
  };
  const now = broken(0);
  if (now) return { at: 0, ratio: now, already: true };
  const STEPS = 400;
  for (let i = 1; i <= STEPS; i++) {
    if (!broken((far * i) / STEPS)) continue;
    let lo = (far * (i - 1)) / STEPS, hi = (far * i) / STEPS;
    for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (broken(m)) hi = m; else lo = m; }
    return { at: hi, ratio: broken(hi) };
  }
  return { at: null, ratio: null };
}

export function baseOf(c: Case): Base | null {
  const p = c.periods[0];
  const v = (k: string) => c.spread[k]?.values[p]?.value;
  const a = (k: string) => Math.abs(v(k) ?? 0);
  const need = ["IS.REVENUE", "IS.COGS", "X.EBIT", "IS.NET_PROFIT", "BS.TOTAL_EQUITY"];
  if (!p || need.some((k) => v(k) === undefined)) return null;
  return { rev: a("IS.REVENUE"), oi: Math.max(0, v("IS.OTHER_INCOME") ?? 0), cogs: a("IS.COGS"), ebit: v("X.EBIT")!, fc: a("IS.FINANCE_COST"), np: v("IS.NET_PROFIT")!, debt: a("X.TOTAL_DEBT"),
    ca: a("BS.TOTAL_CA"), cl: a("BS.TOTAL_CL"), inv: a("BS.INVENTORY"), recv: a("BS.TRADE_RECEIVABLES"), equity: v("BS.TOTAL_EQUITY")!, liab: a("BS.TOTAL_LIABILITIES"), dep: a("CF.DEPRECIATION"), cpltd: a("BS.CURRENT_PORTION_LTD") };
}

export const limitsOf = (c: Case): Limits => Object.fromEntries(c.policy_results.map((p) => [p.ratio, p.rule as Rule]));
