"use client";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cx } from "./ui";

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect x="1" y="1" width="30" height="30" rx="7" fill="#2B1A3D" />
      <path d="M21.5 11.2A7 7 0 1 0 21.5 20.8" stroke="#E9B44C" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <circle cx="21.6" cy="16" r="2.1" fill="#FF9DB2" />
    </svg>
  );
}

export default function NavBar() {
  const path = usePathname();
  const links = [["/", "Product"], ["/how-it-works", "Method"]];
  return (
    <header className="no-print sticky top-0 z-40 h-16 pt-2 px-2 sm:px-4">
      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6 }}
        className={cx("mx-auto h-full flex items-center justify-between pl-3 pr-1.5 sm:px-5 transition-all duration-300",
          "max-w-[1100px] h-12 rounded-full bg-white/85 backdrop-blur-xl border border-white shadow-[0_14px_34px_-18px_rgba(43,26,61,0.55)]")}>
        <Link href="/" className="flex items-center gap-2">
          <Logo />
          <span className={cx("font-display text-[21px] tracking-tight whitespace-nowrap", "text-ink")}>Credence <span className={"text-magenta"}>AI</span></span>
        </Link>
        <nav className="flex items-center gap-1 text-[16px] font-medium">
          {links.map(([href, l]) => {
            const hideOnMobile = href === "/";
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link key={href} href={href} className={cx("relative px-2.5 sm:px-3 py-1.5 rounded-full transition-colors", hideOnMobile && "hidden sm:block",
                "text-ink-2 hover:text-ink")}>
                {active && <motion.span layoutId="nav-pill" className={cx("absolute inset-0 rounded-full", "bg-ink/[0.07]")}
                  transition={{ type: "spring", stiffness: 380, damping: 30 }} />}
                <span className="relative">{l}</span>
              </Link>
            );
          })}
          <Link href="/app" className={cx("sm:ml-2 rounded-full px-3.5 sm:px-4 py-1.5 font-medium whitespace-nowrap transition-colors",
            "bg-mustard text-ink hover:bg-lemon")}>Open app</Link>
        </nav>
      </motion.div>
    </header>
  );
}
