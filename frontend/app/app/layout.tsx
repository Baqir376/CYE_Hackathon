import type { Metadata } from "next";
import { Suspense } from "react";
import { AppBackdrop, Rail } from "@/components/app/AppShell";
import CommandPalette from "@/components/fx/CommandPalette";

export const metadata: Metadata = { title: "CredIQ workspace" };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <Suspense fallback={null}><AppBackdrop /><Rail /><CommandPalette /></Suspense>
      <main id="main" className="md:pl-[96px] pb-20 md:pb-0 print:pl-0">{children}</main>
    </div>
  );
}
