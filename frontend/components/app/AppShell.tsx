"use client";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import Backdrop from "../fx/Backdrop";
import { Strand } from "../fx/Engrave";
import { openPalette } from "../fx/CommandPalette";
import { Logo } from "../NavBar";
import { cx } from "../ui";

const I = (d: string) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>;
const ITEMS = [
  { href: "/app", label: "New", icon: I("M12 5v14M5 12h14") },
  { href: "/app/cases", label: "Cases", icon: I("M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z") },
  { href: "/app/guide", label: "Guide", icon: I("M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.6 9.2a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.9M12 16.8h.01") },
];

export function Rail() {
  const path = usePathname();
  return (
    <>
      <aside className="glass no-print hidden md:flex fixed left-3 top-3 bottom-3 w-[76px] z-40 flex-col items-center py-4 ">
        <Link href="/" title="Back to the Credence website" className="rounded-xl p-1.5 hover:bg-paper transition-colors"><Logo size={32} /></Link>
        <nav className="mt-7 flex flex-col gap-1.5" aria-label="App">{ITEMS.map((x) => <Item key={x.href} {...x} path={path} id="rail" />)}</nav>
        <Strand className="flex-1 min-h-0 w-[44px] my-5" />
        <button onClick={openPalette} title="Search and jump (Ctrl K)" className="w-[64px] py-2 rounded-2xl flex flex-col items-center gap-1 text-[13px] text-ink-2 hover:bg-white/70 hover:text-ink transition-colors">{I("M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM16.5 16.5 21 21")}Search</button>
        <Link href="/" className="mt-2 text-[13px] text-ink-2 hover:text-ink">Website</Link>
      </aside>
      <nav aria-label="App" className="no-print md:hidden fixed bottom-0 inset-x-0 z-40 flex justify-around bg-white/85 backdrop-blur-xl border-t border-white py-1.5">
        {ITEMS.map((x) => <Item key={x.href} {...x} path={path} id="tabbar" />)}
      </nav>
    </>
  );
}

function Item({ href, label, icon, path, id }: { href: string; label: string; icon: ReactNode; path: string; id: string }) {
  const active = href === "/app" ? path === "/app" : path.startsWith(href);
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={cx("relative w-[64px] h-[58px] rounded-2xl flex flex-col items-center justify-center gap-1 text-[13px] transition-colors", active ? "text-white" : "text-ink-2 hover:text-ink hover:bg-white/70")}>
      {active && <motion.span layoutId={id} className="absolute inset-0 rounded-[14px] bg-blue" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
      <motion.span className="relative" whileHover={{ y: -3, scale: 1.18 }} transition={{ type: "spring", stiffness: 420, damping: 14 }}>{icon}</motion.span><span className="relative leading-none">{label}</span>
    </Link>
  );
}

/** Each area of the app has its own weather. */
export function AppBackdrop() {
  const path = usePathname();
  return <Backdrop theme={path.startsWith("/app/guide") ? "peach" : /\/app\/cases\/./.test(path) ? "mint" : path.startsWith("/app/cases") ? "sky" : "mint"} />;
}
