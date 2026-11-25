"use client";
import { Environment, Lightformer, PerformanceMonitor, RoundedBox, useTexture } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

// Real FY2026 cells from the fictional sample PDF. box = [x0, y0, x1, y1] as a fraction of the page (from the parser).
const CELLS = [
  { page: 0, name: "Net revenue", raw: "4,850,000", p: 4, box: [0.6552, 0.1821, 0.7224, 0.1968] },
  { page: 0, name: "Finance cost", raw: "(342,000)", p: 4, box: [0.6577, 0.3341, 0.7224, 0.3489] },
  { page: 0, name: "Net profit", raw: "125,000", p: 4, box: [0.6678, 0.3877, 0.7224, 0.4024] },
  { page: 1, name: "Trade debts", raw: "1,420,000", p: 3, box: [0.6552, 0.3341, 0.7224, 0.3489] },
  { page: 1, name: "Total assets", raw: "5,377,000", p: 3, box: [0.6552, 0.4328, 0.7224, 0.4476] },
  { page: 1, name: "Short-term borrowings", raw: "1,580,000", p: 3, box: [0.6552, 0.7107, 0.7224, 0.7254] },
  { page: 2, name: "Operating cash flow", raw: "(396,000)", p: 5, box: [0.6577, 0.4138, 0.7224, 0.4286] },
];
const PAGE_IMG = ["/ledger/p4.png", "/ledger/p3.png", "/ledger/p5.png"];
const PH = 3, PW = 3 * (595.28 / 841.89);
const MW = 2.75, MH = 3.3;
const SEG = 20;

const clamp = (x: number) => Math.min(1, Math.max(0, x));
/** eased 0..1 progress of t between a and b */
const span = (t: number, a: number, b: number) => { const x = clamp((t - a) / (b - a)); return x * x * (3 - 2 * x); };
const mix = THREE.MathUtils.lerp;

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  draw(cv.getContext("2d")!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
const SANS = "'Segoe UI', system-ui, sans-serif";

const slotY = (i: number) => MH / 2 - 0.98 - i * 0.315;

function Scene({ progress, pointer }: { progress: RefObject<number>; pointer: RefObject<{ x: number; y: number }> }) {
  const root = useRef<THREE.Group>(null);
  const pages = useRef<(THREE.Group | null)[]>([]);
  const pageMats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const glows = useRef<(THREE.Mesh | null)[]>([]);
  const chips = useRef<(THREE.Mesh | null)[]>([]);
  const memo = useRef<THREE.Group>(null);
  const memoMats = useRef<(THREE.Material | null)[]>([]);
  const light = useRef<THREE.PointLight>(null);
  const smooth = useRef(0);
  const textures = useTexture(PAGE_IMG);

  const chipTex = useMemo(() => CELLS.map((c) => canvasTexture(512, 128, (g) => {
    g.fillStyle = "#fff8e7";
    g.beginPath(); g.roundRect(6, 6, 500, 116, 34); g.fill();
    g.lineWidth = 7; g.strokeStyle = "#b82e54"; g.stroke();
    g.fillStyle = "#2b1a3d";
    g.font = "600 62px ui-monospace, Consolas, monospace";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(c.raw, 256, 68);
  })), []);

  const memoTex = useMemo(() => canvasTexture(1100, 1320, (g) => {
    const py = (y: number) => ((MH / 2 - y) / MH) * 1320;
    g.fillStyle = "#f4d35e"; g.font = `600 30px ${SANS}`; g.fillText("CREDIT MEMO  ·  DRAFT FOR REVIEW", 84, 118);
    g.fillStyle = "#ffffff"; g.font = `600 62px ${SANS}`; g.fillText("Sutlej Demo Textiles", 84, 202);
    g.fillStyle = "rgba(255,255,255,.72)"; g.font = `400 30px ${SANS}`; g.fillText("FY2026  ·  Rupees in '000  ·  fictional sample", 84, 254);
    CELLS.forEach((c, i) => {
      const y = py(slotY(i));
      g.strokeStyle = "rgba(255,255,255,.14)"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(84, y + 60); g.lineTo(1016, y + 60); g.stroke();
      g.fillStyle = "#ffffff"; g.font = `500 38px ${SANS}`; g.textBaseline = "middle"; g.fillText(c.name, 84, y - 8);
      g.fillStyle = "rgba(255,255,255,.65)"; g.font = `400 26px ${SANS}`; g.fillText(`page ${c.p}`, 84, y + 30);
      g.textBaseline = "alphabetic";
    });
  }), []);

  const shadowTex = useMemo(() => canvasTexture(256, 256, (g) => {
    g.filter = "blur(22px)"; g.fillStyle = "rgba(30,10,40,0.9)"; g.fillRect(48, 48, 160, 160);
  }), []);

  const threads = useMemo(() => CELLS.map(() => {
    const line = new Line2(new LineGeometry(), new LineMaterial({ color: 0xf4d35e, linewidth: 2, transparent: true, opacity: 0, depthWrite: false }));
    line.geometry.setPositions(new Float32Array(SEG * 3));
    line.frustumCulled = false;
    return line;
  }), []);

  useEffect(() => () => {
    chipTex.forEach((t) => t.dispose()); memoTex.dispose(); shadowTex.dispose();
    threads.forEach((l) => { l.geometry.dispose(); l.material.dispose(); });
  }, [chipTex, memoTex, shadowTex, threads]);

  const buf = useMemo(() => CELLS.map(() => new Float32Array(SEG * 3)), []);
  const tmp = useMemo(() => ({ src: new THREE.Vector3(), dst: new THREE.Vector3(), up: new THREE.Vector3(), n: new THREE.Vector3(), q: new THREE.Quaternion(), p: new THREE.Vector3() }), []);

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const time = state.clock.elapsedTime;
    smooth.current = THREE.MathUtils.damp(smooth.current, progress.current ?? 0, 1.9, dt);
    const t = smooth.current;
    const fan = span(t, 0.02, 0.3), lift = span(t, 0.26, 0.48), fly = span(t, 0.5, 0.86), glass = span(t, 0.48, 0.82);
    const px = pointer.current?.x ?? 0, py = pointer.current?.y ?? 0;

    if (root.current) {
      root.current.rotation.y = THREE.MathUtils.damp(root.current.rotation.y, px * 0.2 - 0.12 * (1 - glass), 4, dt);
      root.current.rotation.x = THREE.MathUtils.damp(root.current.rotation.x, -py * 0.12, 4, dt);
      root.current.position.x = state.viewport.width * 0.225;
      root.current.position.y = 0.2 + Math.sin(time * 0.6) * 0.05;
      const s = Math.min(1, state.viewport.width / 10.2, state.viewport.height / 5.25);
      root.current.scale.setScalar(s);
    }
    if (light.current) { light.current.position.set(px * 5 + 1.5, py * 3.2, 3.6); light.current.intensity = mix(15, 0.6, glass); }

    for (let i = 0; i < 3; i++) {
      const g = pages.current[i];
      if (!g) continue;
      const k = i - 1;
      const bob = Math.sin(time * 0.8 + i * 1.7) * 0.05;
      g.position.set(
        mix(mix(k * 0.16, k * 1.12, fan), k * 1.35, glass),
        mix(k * -0.1, k * -0.08, fan) + bob + glass * (0.2 - Math.abs(k) * 0.1),
        mix(mix(-k * 0.34, -Math.abs(k) * 0.35, fan), -2.6 + Math.abs(k) * 0.5, glass),
      );
      g.rotation.set(mix(-0.2, -0.05, fan), mix(-0.5, -k * 0.34, fan), mix(k * -0.07 + 0.06, 0, fan));
      const m = pageMats.current[i];
      if (m) m.color.setScalar(mix(1, 0.86, glass));
    }

    if (memo.current) {
      memo.current.position.set(0, mix(-3.6, 0, glass), mix(-0.6, 0.55, glass));
      memo.current.rotation.set(mix(-0.9, 0, glass), mix(0.7, 0, glass), 0);
      memo.current.visible = glass > 0.002;
    }
    memoMats.current.forEach((m, i) => { if (m) m.opacity = glass * (i === 0 ? 0.93 : 1); });

    CELLS.forEach((c, i) => {
      const pg = pages.current[c.page], chip = chips.current[i], glow = glows.current[i];
      if (!pg || !chip) return;
      const [x0, y0, x1, y1] = c.box;
      tmp.src.set(((x0 + x1) / 2 - 0.5) * PW, (0.5 - (y0 + y1) / 2) * PH, 0.02).applyQuaternion(pg.quaternion).add(pg.position);
      tmp.n.set(0, 0, 1).applyQuaternion(pg.quaternion);
      const li = span(lift, i * 0.06, 0.6 + i * 0.06), fi = span(fly, i * 0.055, 0.64 + i * 0.055);
      tmp.up.copy(tmp.src).addScaledVector(tmp.n, li * (0.55 + 0.07 * i));
      tmp.up.y += li * 0.12 + Math.sin(time * 1.4 + i) * 0.02 * li;
      tmp.dst.set(0.83, slotY(i) + 0.02, 0.1);
      if (memo.current) tmp.dst.applyQuaternion(memo.current.quaternion).add(memo.current.position);
      tmp.p.lerpVectors(tmp.up, tmp.dst, fi);
      tmp.p.z += Math.sin(fi * Math.PI) * 0.9;
      tmp.p.y += Math.sin(fi * Math.PI) * 0.35;
      chip.position.copy(tmp.p);
      tmp.q.copy(pg.quaternion);
      if (memo.current) tmp.q.slerp(memo.current.quaternion, fi);
      chip.quaternion.copy(tmp.q);
      chip.scale.setScalar(mix(mix(0.16, 0.86, li), 0.92, fi));
      (chip.material as THREE.MeshBasicMaterial).opacity = span(t, 0.2, 0.28);
      if (glow) (glow.material as THREE.MeshBasicMaterial).opacity = span(t, 0.14, 0.24) * mix(0.85, 0.55, glass);

      const line = threads[i];
      const pts = buf[i];
      for (let s = 0; s < SEG; s++) {
        const u = s / (SEG - 1), bow = Math.sin(u * Math.PI) * (0.12 + fi * 0.35);
        pts[s * 3] = mix(tmp.src.x, tmp.p.x, u);
        pts[s * 3 + 1] = mix(tmp.src.y, tmp.p.y, u) + bow * 0.25;
        pts[s * 3 + 2] = mix(tmp.src.z, tmp.p.z, u) + bow * 0.35;
      }
      line.geometry.setPositions(pts);
      line.material.opacity = li * mix(0.95, 0.7, fi);
    });
  });

  return (
    <>
      <ambientLight intensity={1.15} />
      <directionalLight position={[3, 5, 6]} intensity={1.35} />
      <pointLight ref={light} color="#fff1c9" intensity={15} distance={11} />
      <Environment resolution={128}>
        <Lightformer intensity={2.2} position={[0, 4, 4]} scale={[8, 3, 1]} />
        <Lightformer intensity={1.2} color="#ff9db2" position={[-5, 0, 3]} scale={[2, 6, 1]} />
        <Lightformer intensity={0.9} color="#fde68a" position={[5, -1, 3]} scale={[2, 6, 1]} />
      </Environment>
      <group ref={root}>
        {textures.map((tex, i) => (
          <group key={i} ref={(g) => { pages.current[i] = g; }}>
            <mesh position={[0.1, -0.14, -0.12]}><planeGeometry args={[PW * 1.28, PH * 1.2]} /><meshBasicMaterial map={shadowTex} transparent depthWrite={false} opacity={0.5} toneMapped={false} /></mesh>
            <RoundedBox args={[PW + 0.04, PH + 0.04, 0.025]} radius={0.012} position={[0, 0, -0.016]}>
              <meshStandardMaterial color="#e9e4da" roughness={0.6} />
            </RoundedBox>
            <mesh>
              <planeGeometry args={[PW, PH]} />
              <meshBasicMaterial ref={(m) => { pageMats.current[i] = m; }} map={tex} toneMapped={false} />
            </mesh>
            {CELLS.map((c, j) => c.page === i && (
              <mesh key={j} ref={(m) => { glows.current[j] = m; }}
                position={[((c.box[0] + c.box[2]) / 2 - 0.5) * PW, (0.5 - (c.box[1] + c.box[3]) / 2) * PH, 0.006]}>
                <planeGeometry args={[(c.box[2] - c.box[0]) * PW + 0.05, (c.box[3] - c.box[1]) * PH + 0.03]} />
                <meshBasicMaterial color="#ffc53d" transparent opacity={0} depthWrite={false} blending={THREE.MultiplyBlending} premultipliedAlpha />
              </mesh>
            ))}
          </group>
        ))}
        {threads.map((l, i) => <primitive key={i} object={l} />)}
        <group ref={memo} visible={false}>
          <RoundedBox args={[MW, MH, 0.07]} radius={0.034} smoothness={5}>
            <meshPhysicalMaterial ref={(m) => { memoMats.current[0] = m; }} color="#3a2552" emissive="#2b1a3d" emissiveIntensity={0.9} roughness={0.42} metalness={0.2} clearcoat={1}
              clearcoatRoughness={0.35} envMapIntensity={1.1} transparent opacity={0} />
          </RoundedBox>
          <mesh position={[0, 0, 0.045]}>
            <planeGeometry args={[MW, MH]} />
            <meshBasicMaterial ref={(m) => { memoMats.current[1] = m; }} map={memoTex} transparent opacity={0} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
        {CELLS.map((c, i) => (
          <mesh key={c.name} ref={(m) => { chips.current[i] = m; }} renderOrder={5}>
            <planeGeometry args={[0.92, 0.23]} />
            <meshBasicMaterial map={chipTex[i]} transparent opacity={0} toneMapped={false} depthWrite={false} depthTest={false} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
    </>
  );
}

export default function LedgerScene({ progress, active, onFail }: { progress: RefObject<number>; active: boolean; onFail: () => void }) {
  const pointer = useRef({ x: 0, y: 0 });
  const [dpr, setDpr] = useState(1.5);
  useEffect(() => {
    const h = (e: PointerEvent) => { pointer.current = { x: (e.clientX / window.innerWidth) * 2 - 1, y: -((e.clientY / window.innerHeight) * 2 - 1) }; };
    window.addEventListener("pointermove", h, { passive: true });
    return () => window.removeEventListener("pointermove", h);
  }, []);
  return (
    <Canvas dpr={dpr} frameloop={active ? "always" : "never"} camera={{ position: [0, 0, 7.2], fov: 38 }} gl={{ antialias: true, alpha: true, powerPreference: new URLSearchParams(window.location.search).has("lowpower") ? "low-power" : "high-performance" }}
      onCreated={({ gl }) => gl.domElement.addEventListener("webglcontextlost", onFail, { once: true })} aria-hidden>
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.75)} flipflops={3} onFallback={() => setDpr(0.8)} />
      <Suspense fallback={null}><Scene progress={progress} pointer={pointer} /></Suspense>
    </Canvas>
  );
}
