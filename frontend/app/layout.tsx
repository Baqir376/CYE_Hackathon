import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Rozha_One, Spline_Sans_Mono } from "next/font/google";
import { MotionRoot } from "@/components/motion/primitives";
import "./globals.css";

const body = Plus_Jakarta_Sans({ variable: "--font-body", subsets: ["latin"] });
const note = Rozha_One({ variable: "--font-note", subsets: ["latin"], weight: "400" });
const mono = Spline_Sans_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Credence AI · Every number, traced to its source",
  description:
    "Evidence-driven corporate credit analysis: verified spreads, tie-out checks, bank-policy ratios and a number-guarded credit memo where every figure links back to its source page.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${body.variable} ${note.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <MotionRoot>
          {children}
        </MotionRoot>
      </body>
    </html>
  );
}
