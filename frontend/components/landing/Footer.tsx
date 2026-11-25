"use client";
import { motion } from "motion/react";
import Link from "next/link";
import { Reveal } from "../motion/primitives";
import { Edge, Weave } from "../fx/Engrave";

export function Scope() {
  const items = [
    ["Does", "Read, spread and verify audited statements · re-compute totals · apply your policy · draft a sourced memo · keep an audit trail"],
    ["Does not", "Audit or certify accounts · approve or decline loans · replace eCIB reports, Moody's or the analyst's judgement"],
  ];
  return (
    <section id="limits" className="relative bg-[#e1f1e8] text-ink overflow-hidden">
      <Edge from="#F4FAF2" />
      <div className="mx-auto max-w-[1280px] relative px-6 lg:pl-24 2xl:pl-6 pt-44 pb-28 grid md:grid-cols-[0.8fr_1.2fr] gap-10">
        <Reveal><h2 className="font-note text-[clamp(44px,5vw,76px)] leading-[0.95]">What it won&apos;t do.</h2>
          <p className="mt-5 text-[18px] leading-relaxed max-w-sm">The credit decision stays with the bank&apos;s authorised officers. CredIQ makes their analysis faster to verify.</p></Reveal>
        <div className="space-y-4">
          {items.map(([k, v], i) => (
            <Reveal key={k} delay={i * 0.1}>
              <div className="rounded-[14px] bg-white p-6 flex gap-5">
                <span className={`shrink-0 h-8 rounded-full px-3 text-[13px] font-semibold flex items-center ${i === 0 ? "bg-teal-soft text-teal" : "bg-red-soft text-red"}`}>{k}</span>
                <p className="text-[17px] text-ink leading-relaxed">{v}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Footer() {
  return (
    <footer className="relative bg-paper text-ink overflow-hidden">
      <Weave bands={4} lines={9} alpha={0.6} />
      <Edge from="#FBE5A6" />
      <div className="mx-auto max-w-[1280px] relative px-6 lg:pl-24 2xl:pl-6 pt-44 pb-8">
        <div className="grid md:grid-cols-[1.4fr_1fr_1fr_1fr] gap-10 text-[16px]">
          <div>
            <p className="font-note text-[40px] leading-none text-ink">CredIQ</p>
            <p className="mt-3 text-ink-2 max-w-xs leading-relaxed">Evidence-driven corporate credit analysis for banks and institutional lenders in Pakistan.</p>
          </div>
          <FooterCol t="Product" l={[["Open the app", "/app"], ["Cases", "/app/cases"], ["User guide", "/app/guide"]]} />
          <FooterCol t="Under the hood" l={[["PyMuPDF extraction", "/how-it-works"], ["Rules × LLM mapping", "/how-it-works"], ["Number guard", "/how-it-works"]]} />
          <FooterCol t="Built for" l={[["Capital Youth Expo, 04-HK", "/"], ["FinTech track", "/"]]} />
        </div>
        <div className="mt-16 flex flex-wrap justify-between gap-3 text-[14px] text-ink-2 border-t border-line pt-6">
          <span>Demo data is fictional. Policy thresholds are illustrative, not SBP requirements.</span>
          <span>© 2026 CredIQ · hackathon prototype</span>
        </div>
      </div>
      <motion.p initial={{ y: "40%", opacity: 0 }} whileInView={{ y: "0%", opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        aria-hidden className="font-note leading-[0.92] text-[29vw] text-center select-none text-green pb-[7vw]">
        CredIQ
      </motion.p>
    </footer>
  );
}

function FooterCol({ t, l }: { t: string; l: string[][] }) {
  return (
    <div>
      <p className="text-magenta text-[15px] font-semibold">{t}</p>
      <ul className="mt-3 space-y-2">{l.map(([a, h]) => <li key={a}><Link href={h} className="text-ink hover:text-magenta transition-colors">{a}</Link></li>)}</ul>
    </div>
  );
}
