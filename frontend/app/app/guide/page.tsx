import Link from "next/link";
import { Banner } from "@/components/fx/Engrave";

const STEPS = [
  ["Start a case", "Go to New and drop in the borrower's audited statements, or run the sample. Text PDFs only for now: scanned pages are reported but not read."],
  ["Let it run", "You'll see the statement pages it found, the figures it read and each check as it finishes. Nothing to do here."],
  ["Follow the four boxes", "At the top of every case, the dark box is your next job. Press its button and you land in the right place."],
  ["Click any underlined figure", "The source page opens with that exact cell highlighted. Ratios show their formula and inputs first."],
  ["Correct what's wrong", "Press Edit on a line, or use the re-computed sum on a failed check. Give a reason: it goes in the audit trail, and everything that depends on the figure updates."],
  ["Finish the memo", "Edit a section if you need to. A figure must match the source it cites or its sentence is blocked. Then submit it to the approver."],
];
const WORDS = [
  ["Spread", "The company's figures arranged in your bank's standard template."],
  ["Tie-out", "A check that figures which should agree really do, such as assets = equity + liabilities."],
  ["Disputed", "The rules and the AI put a line in different places. The rules answer is used until you decide."],
  ["Watch / breach", "Close to, or outside, the limit in the credit policy you picked."],
  ["Qualitative", "A memo sentence with no figure in it. Credence can't verify opinions, so read these yourself."],
];

export default function Guide() {
  return (
    <div className="mx-auto max-w-[860px] px-5 sm:px-8 pt-6 md:pt-9 pb-16">
      <Banner tint="#FFE7DF" className="px-7 sm:px-10 py-11"><h1 className="font-display text-[clamp(34px,4.4vw,52px)] leading-[1.05]">How to use Credence</h1></Banner>
      <ol className="mt-8 glass px-7">
        {STEPS.map(([t, d], i) => (
          <li key={t} className="flex gap-5 py-5 border-t border-line first:border-0">
            <span className="h-9 w-9 shrink-0 rounded-full bg-magenta text-white flex items-center justify-center font-semibold">{i + 1}</span>
            <p className="text-[16px] leading-relaxed"><span className="font-semibold block text-[18px]">{t}</span><span className="text-ink-2">{d}</span></p>
          </li>
        ))}
      </ol>
      <h2 className="mt-12 font-display text-[30px]">Words you&apos;ll see</h2>
      <dl className="mt-4 glass px-7">
        {WORDS.map(([t, d]) => <div key={t} className="grid sm:grid-cols-[170px_1fr] gap-1 py-4 border-t border-line first:border-0"><dt className="font-semibold">{t}</dt><dd className="text-ink-2">{d}</dd></div>)}
      </dl>
      <Link href="/app" className="inline-block mt-8 rounded-[12px] bg-blue text-white px-7 py-3.5 font-bold hover:bg-ink transition-colors">Start a case</Link>
    </div>
  );
}
