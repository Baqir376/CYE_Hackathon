import { Suspense } from "react";
import CaseWorkspace from "@/components/case/CaseWorkspace";

export default function CasePage() {
  return (
    <Suspense fallback={<div className="p-10 text-muted">Loading case…</div>}>
      <CaseWorkspace />
    </Suspense>
  );
}
