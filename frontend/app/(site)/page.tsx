import SideLine from "@/components/fx/SideLine";
import Bento from "@/components/landing/Bento";
import Footer, { Scope } from "@/components/landing/Footer";
import IntroHero from "@/components/landing/IntroHero";
import { Manifesto, StressTeaser } from "@/components/landing/Manifesto";
import Pipeline from "@/components/landing/Pipeline";
import { FinalCta, Proof, UseIt } from "@/components/landing/Sections";
import SpotIt from "@/components/landing/SpotIt";
import Story from "@/components/landing/Story";

const STOPS = [
  { id: "top", label: "The glass" }, { id: "why", label: "Why" }, { id: "story", label: "Paper to memo" }, { id: "proof", label: "Proof" }, { id: "game", label: "Spot the mistake" }, { id: "stress", label: "Stress it" },
  { id: "steps", label: "Three steps" }, { id: "how", label: "How it works" }, { id: "features", label: "Features" }, { id: "limits", label: "Limits" }, { id: "start", label: "Try it" },
];

export default function Home() {
  return (
    <>
      <SideLine stops={STOPS} />
      <IntroHero />
      <Manifesto />
      <Story />
      <Proof />
      <SpotIt />
      <StressTeaser />
      <UseIt />
      <Pipeline />
      <Bento />
      <Scope />
      <FinalCta />
      <Footer />
    </>
  );
}
