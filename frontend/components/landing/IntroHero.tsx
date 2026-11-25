"use client";
import { useSyncExternalStore } from "react";
import IntroLoader from "./IntroLoader";
import LoupeHero from "./LoupeHero";

let first: number | null = null;
const getDelay = () => (first ??= sessionStorage.getItem("credence-intro") || new URLSearchParams(window.location.search).has("nointro") ? 0.1 : 1.5);

export default function IntroHero() {
  const delay = useSyncExternalStore(() => () => {}, getDelay, () => 0.1);
  return <><IntroLoader /><LoupeHero delay={delay} /></>;
}
