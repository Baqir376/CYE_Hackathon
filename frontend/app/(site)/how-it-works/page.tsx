import Link from "next/link";
import Backdrop from "@/components/fx/Backdrop";
import { Glass } from "@/components/fx/Glass";
import SideLine from "@/components/fx/SideLine";
import { Reveal } from "@/components/motion/primitives";

const STEPS = [
  ["Locate", "Finds the statement of financial position, profit or loss and cash flows inside a full annual report (200+ pages), choosing standalone or consolidated statements and skipping the table of contents, summaries and notes.", "PyMuPDF, deterministic"],
  ["Extract", "Reads every line item and figure from the PDF text layer with its exact page coordinates. It handles Pakistani layouts: Rupees in '000, brackets for negatives, note columns and unlabelled subtotals.", "No AI: figures are never generated"],
  ["Re-compute", "Re-adds every printed subtotal and grand total from its component lines. A total that doesn't cast is flagged as a possible typing or casting error.", "Arithmetic verification"],
  ["Classify", "Two independent classifiers, a rules engine built on Pakistani terms (trade debts, stock-in-trade, accrued mark-up, running finance) and an LLM, map each line to the bank's template. Disagreements go to the analyst.", "Rules + Groq LLM, cross-checked"],
  ["Tie-out", "Assets = equity + liabilities, gross profit, net profit, CFO + CFI + CFF = net change, and closing cash reconciled to the balance sheet (including the running-finance netting common in Pakistan).", "Deterministic checks"],
  ["Analyse", "Calculates liquidity, leverage, debt service, profitability, efficiency and growth ratios, then applies the bank's own policy thresholds (configurable, not one universal score) and trend-based risk signals.", "Deterministic, explainable"],
  ["Draft", "The LLM writes sentences with placeholders and Python fills in each figure with its source. The number guard then checks that every figure, its name, year, sign, unit and direction match that source, and blocks the sentence if not. Sentences without figures are marked qualitative: they are for you to judge.", "LLM + number guard"],
  ["Review", "The analyst corrects, confirms and annotates. Every change needs a reason and is written to the audit trail. A case can't be submitted while blocked sentences or disputed classifications remain.", "Human accountability"],
];

const STOPS = STEPS.map(([t]) => ({ id: t.toLowerCase(), label: t }));

export default function HowItWorks() {
  return (
    <div className="relative isolate bg-paper min-h-screen -mt-16 pt-16 text-ink">
    <div className="relative mx-auto max-w-4xl px-5 sm:px-6 py-16">
      <Backdrop theme="sky" />
      <SideLine stops={STOPS} />
      <p className="text-[17px] text-magenta font-semibold">How it works</p>
      <h1 className="font-note text-[clamp(50px,6.4vw,92px)] leading-[0.95] mt-2">Python handles the numbers.</h1>
      <p className="mt-6 text-ink-2 text-[20px] leading-relaxed">
        Generic AI tools summarise financial statements; CredIQ does credit work. Python reads, verifies and calculates every figure. The language model classifies rows and writes prose, and every figure in that prose is checked against the source it cites.
      </p>
      <ol className="mt-10 space-y-4">
        {STEPS.map(([t, d, tag], i) => (
          <li key={t} id={t.toLowerCase()} className="scroll-mt-28"><Reveal><Glass tilt={3} className="p-6 text-ink"><div className="flex gap-5">
            <span className="num text-2xl text-magenta font-semibold w-8 shrink-0">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <div className="flex items-center gap-3 flex-wrap"><h2 className="font-display text-[24px]">{t}</h2>
                <span className="text-[14px] rounded-md border border-line px-1.5 py-0.5 text-ink-2">{tag}</span></div>
              <p className="text-[17px] text-ink-2 mt-1.5 leading-relaxed">{d}</p>
            </div>
          </div></Glass></Reveal></li>
        ))}
      </ol>
      <div className="mt-10 glass p-6 text-[17px] text-ink-2 leading-relaxed">
        <p className="font-semibold text-magenta">Scope</p>
        CredIQ analyses financial statements that have already been prepared or audited. It does not audit or certify accounts,
        approve loans, or replace eCIB reports, Moody&apos;s, or the analyst&apos;s judgement. Policy thresholds shown are illustrative:
        SBP does not prescribe one universal minimum ratio, so each bank configures its own.
      </div>
      <Link href="/app" className="inline-block mt-8 note-btn bg-mustard text-ink">Open the app</Link>
    </div>
    </div>
  );
}
