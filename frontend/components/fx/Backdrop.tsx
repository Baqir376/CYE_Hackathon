import { Weave } from "./Engrave";

/** A clean light page with the twisted spirals behind it, shared by the whole app. Still unless the mouse passes. */
const THEMES = {
  mint: "linear-gradient(180deg, #f3faf4 0%, #eef7f1 100%)",
  sky: "linear-gradient(180deg, #f3f7fe 0%, #eaf1fc 100%)",
  peach: "linear-gradient(180deg, #fff8f2 0%, #fef1e9 100%)",
} as const;
export type Theme = keyof typeof THEMES;

export default function Backdrop({ theme = "mint", className }: { theme?: Theme; className?: string }) {
  return (
    <div aria-hidden className={`no-print fixed inset-0 -z-10 pointer-events-none overflow-hidden ${className || ""}`} style={{ background: THEMES[theme] }}>
      <Weave bands={5} lines={9} alpha={0.62} />
    </div>
  );
}
