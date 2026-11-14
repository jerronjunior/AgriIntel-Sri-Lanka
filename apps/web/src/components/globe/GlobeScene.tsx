"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Line2 } from "three-stdlib";

const R = 1;
const LK = { lat: 7.87, lon: 80.77 };
const MARKERS = [
  { name: "Anuradhapura", lat: 8.33, lon: 80.4 }, { name: "Monaragala", lat: 6.87, lon: 81.35 },
  { name: "Kurunegala", lat: 7.48, lon: 80.36 }, { name: "Ampara", lat: 7.28, lon: 81.62 }, { name: "Jaffna", lat: 9.68, lon: 80.05 },
];

export function toVec(lat: number, lon: number, r = R) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

const lkDir = toVec(LK.lat, LK.lon);
const FACE_Y = -Math.atan2(lkDir.x, lkDir.z);
const FACE_X = Math.atan2(lkDir.y, Math.hypot(lkDir.x, lkDir.z));

const dotVert = /* glsl */ `
  attribute float aHi; varying float vHi; varying float vFacing;
  void main() {
    vHi = aHi;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vFacing = dot(normalize(normalMatrix * normalize(position)), vec3(0.0, 0.0, 1.0));
    gl_PointSize = (aHi > 0.5 ? 3.4 : 2.6) * (3.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;
const dotFrag = /* glsl */ `
  varying float vHi; varying float vFacing; uniform float uTime;
  void main() {
    vec2 c = gl_PointCoord - 0.5; if (length(c) > 0.5) discard;
    float fade = smoothstep(-0.15, 0.5, vFacing);
    vec3 land = vec3(0.36, 0.56, 0.66);
    vec3 lk = vec3(0.063, 0.725, 0.506) * (1.15 + 0.25 * sin(uTime * 2.0));
    gl_FragColor = vec4(mix(land, lk, vHi), fade * (vHi > 0.5 ? 1.0 : 0.75));
  }`;
const atmoVert = /* glsl */ `varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `;
const atmoFrag = /* glsl */ `varying vec3 vN; void main(){ float i = pow(0.68 - dot(vN, vec3(0,0,1.0)), 3.0); gl_FragColor = vec4(0.133, 0.827, 0.933, 1.0) * i; }`;

function LandDots({ dots }: { dots: [number, number][] }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const geo = useMemo(() => {
    const pos = new Float32Array(dots.length * 3);
    const hi = new Float32Array(dots.length);
    dots.forEach(([lon, lat], i) => {
      const v = toVec(lat, lon, R * 1.002);
      pos.set([v.x, v.y, v.z], i * 3);
      hi[i] = lat > 5.5 && lat < 10.2 && lon > 79.3 && lon < 82.2 ? 1 : 0;
    });
    // extra dense dots over Sri Lanka so the island reads clearly
    const extra: number[] = [];
    for (let lat = 6.0; lat <= 9.8; lat += 0.5)
      for (let lon = 79.7; lon <= 81.9; lon += 0.5) {
        const inside = (lat - 7.85) ** 2 / 1.9 ** 2 + (lon - 80.75 - (lat - 7.85) * -0.12) ** 2 / 1.0 ** 2 < 1;
        if (inside) extra.push(lat, lon);
      }
    const n = extra.length / 2;
    const p2 = new Float32Array((dots.length + n) * 3);
    p2.set(pos);
    const h2 = new Float32Array(dots.length + n);
    h2.set(hi);
    for (let k = 0; k < n; k++) {
      const v = toVec(extra[k * 2], extra[k * 2 + 1], R * 1.004);
      p2.set([v.x, v.y, v.z], (dots.length + k) * 3);
      h2[dots.length + k] = 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p2, 3));
    g.setAttribute("aHi", new THREE.BufferAttribute(h2, 1));
    return g;
  }, [dots]);
  useFrame(({ clock }) => { if (mat.current) mat.current.uniforms.uTime.value = clock.elapsedTime; });
  return (
    <points geometry={geo}>
      <shaderMaterial ref={mat} vertexShader={dotVert} fragmentShader={dotFrag} transparent depthWrite={false} uniforms={{ uTime: { value: 0 } }} />
    </points>
  );
}

function Marker({ lat, lon, main = false }: { lat: number; lon: number; main?: boolean }) {
  const ring = useRef<THREE.Mesh>(null);
  const p = useMemo(() => toVec(lat, lon, R * 1.006), [lat, lon]);
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), p.clone().normalize()), [p]);
  useFrame(({ clock }) => {
    if (!ring.current) return;
    const t = (clock.elapsedTime * (main ? 0.6 : 0.9) + lat) % 1;
    ring.current.scale.setScalar(1 + t * (main ? 3.5 : 2));
    (ring.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.8;
  });
  return (
    <group position={p} quaternion={q}>
      <mesh><circleGeometry args={[main ? 0.012 : 0.006, 24]} /><meshBasicMaterial color={main ? "#10B981" : "#22D3EE"} /></mesh>
      <mesh ref={ring}><ringGeometry args={[main ? 0.014 : 0.008, main ? 0.017 : 0.01, 40]} /><meshBasicMaterial color={main ? "#10B981" : "#22D3EE"} transparent side={THREE.DoubleSide} /></mesh>
    </group>
  );
}

function Satellite({ radius, incl, speed, phase, linkTarget }: { radius: number; incl: number; speed: number; phase: number; linkTarget: THREE.Vector3 }) {
  const sat = useRef<THREE.Group>(null);
  const beam = useRef<Line2 | null>(null);
  const orbit = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius).applyAxisAngle(new THREE.Vector3(1, 0, 0), incl));
    }
    return pts;
  }, [radius, incl]);
  const beamPts = useMemo(() => [new THREE.Vector3(), new THREE.Vector3()], []);
  useFrame(({ clock }) => {
    const a = clock.elapsedTime * speed + phase;
    const pos = new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius).applyAxisAngle(new THREE.Vector3(1, 0, 0), incl);
    if (sat.current) { sat.current.position.copy(pos); sat.current.lookAt(0, 0, 0); }
    if (beam.current) {
      const visible = pos.clone().normalize().dot(linkTarget.clone().normalize()) > 0.35;
      beam.current.visible = visible;
      if (visible) {
        beamPts[0].copy(pos); beamPts[1].copy(linkTarget);
        beam.current.geometry.setPositions([pos.x, pos.y, pos.z, linkTarget.x, linkTarget.y, linkTarget.z]);
        const m = beam.current.material as unknown as { dashOffset: number };
        m.dashOffset -= 0.01;
      }
    }
  });
  return (
    <>
      <Line points={orbit} color="#22D3EE" lineWidth={0.6} transparent opacity={0.22} />
      <group ref={sat}>
        <mesh><boxGeometry args={[0.03, 0.03, 0.045]} /><meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.3} /></mesh>
        <mesh position={[0.06, 0, 0]}><boxGeometry args={[0.07, 0.002, 0.03]} /><meshStandardMaterial color="#1e3a5f" emissive="#22D3EE" emissiveIntensity={0.25} /></mesh>
        <mesh position={[-0.06, 0, 0]}><boxGeometry args={[0.07, 0.002, 0.03]} /><meshStandardMaterial color="#1e3a5f" emissive="#22D3EE" emissiveIntensity={0.25} /></mesh>
      </group>
      <Line ref={beam as never} points={beamPts} color="#10B981" lineWidth={1} dashed dashSize={0.03} gapSize={0.025} transparent opacity={0.85} />
    </>
  );
}

function Earth({ dots, progress }: { dots: [number, number][]; progress: React.RefObject<number> }) {
  const g = useRef<THREE.Group>(null);
  const lkWorld = useRef(new THREE.Vector3());
  useFrame(({ camera, clock, size }, dt) => {
    if (!g.current) return;
    const p = progress.current ?? 0;
    // idle spin blends into "face Sri Lanka" as the user scrolls
    const idle = FACE_Y + Math.sin(clock.elapsedTime * 0.12) * 0.9 - 0.6;
    const ty = THREE.MathUtils.lerp(idle, FACE_Y, Math.min(1, p * 1.6));
    g.current.rotation.y = THREE.MathUtils.damp(g.current.rotation.y, ty, 3, dt);
    g.current.rotation.x = THREE.MathUtils.damp(g.current.rotation.x, FACE_X * Math.min(1, p * 1.6) + 0.15 * (1 - p), 3, dt);
    // keep the whole globe (plus orbits) inside narrow/portrait canvases; zoom in gently while scrolling
    const fit = Math.max(1, 1.08 / (size.width / size.height));
    camera.position.z = THREE.MathUtils.damp(camera.position.z, (3.6 - p * 0.8) * fit, 3, dt);
    lkWorld.current.copy(lkDir).multiplyScalar(1.006).applyEuler(g.current.rotation);
  });
  return (
    <>
      <group ref={g}>
        <mesh><sphereGeometry args={[R, 64, 64]} /><meshStandardMaterial color="#061421" roughness={0.9} transparent opacity={0.94} /></mesh>
        <LandDots dots={dots} />
        <Marker lat={LK.lat} lon={LK.lon} main />
        {MARKERS.map((m) => <Marker key={m.name} lat={m.lat} lon={m.lon} />)}
      </group>
      <mesh scale={1.17}><sphereGeometry args={[R, 64, 64]} />
        <shaderMaterial vertexShader={atmoVert} fragmentShader={atmoFrag} blending={THREE.AdditiveBlending} side={THREE.BackSide} transparent depthWrite={false} />
      </mesh>
      <Satellite radius={1.45} incl={0.5} speed={0.22} phase={0} linkTarget={lkWorld.current} />
      <Satellite radius={1.62} incl={-0.35} speed={0.17} phase={2.2} linkTarget={lkWorld.current} />
      <Satellite radius={1.3} incl={1.25} speed={0.28} phase={4.1} linkTarget={lkWorld.current} />
    </>
  );
}

function Particles() {
  const geo = useMemo(() => {
    const n = 600, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(4 + Math.random() * 6);
      pos.set([v.x, v.y, v.z], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  return <points geometry={geo}><pointsMaterial size={0.012} color="#94A3B8" transparent opacity={0.5} /></points>;
}

export default function GlobeScene({ progress }: { progress: React.RefObject<number> }) {
  const [dots, setDots] = useState<[number, number][] | null>(null);
  useEffect(() => { fetch("/geo/globe-dots.json").then((r) => r.json()).then(setDots).catch(() => setDots([])); }, []);
  return (
    <Canvas camera={{ position: [0, 0, 3.6], fov: 42 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 2, 4]} intensity={1.4} color="#bfefff" />
      <Particles />
      {dots && <Earth dots={dots} progress={progress} />}
    </Canvas>
  );
}
