import { Suspense } from "react";
import NavBar from "@/components/NavBar";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <Suspense fallback={<div className="h-16" />}><NavBar /></Suspense>
      <main className="flex-1">{children}</main>
    </div>
  );
}
