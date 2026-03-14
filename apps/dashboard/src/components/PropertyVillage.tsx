import React, { useRef, useMemo, useCallback, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { Html, ContactShadows, Float, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { THEME } from '@apm/shared';
import type { PropertyState } from '../hooks/useSSE';
import { MiniCalendar } from './MiniCalendar';

interface Props {
  properties: PropertyState[];
  onPropertyClick: (property: PropertyState) => void;
  compact?: boolean;
}

/* ─── Module-scoped state (avoids React re-renders) ───────────────────── */
const globalPointer = { x: 0, y: 0, over: false };
const activeHouse = { idx: -1 };
// Canvas rect — cached on mount, updated on pointer enter
let canvasRect: DOMRect | null = null;

/* ─── Color palettes ───────────────────────────────────────────────────── */
const PALETTES = [
  { walls: '#F5F0EB', accent: '#B8875A', roof: '#7EAE96', glass: '#89C5D4', door: '#4A7A6A', base: '#D4CFC5' },
  { walls: '#F5F2ED', accent: '#8B7355', roof: '#7BB0E0', glass: '#B8D8F8', door: '#4A6A8A', base: '#D4CFC5' },
  { walls: '#F5EDE4', accent: '#A08060', roof: '#CCA04E', glass: '#C8A860', door: '#8A6A3A', base: '#BEB5A8' },
];

const STATUS_ROOF: Record<string, string> = {
  attention: '#F0C53A',
  emergency: '#F87171',
};

const RIM_COLOR = '#F5E6D0';

const WARM_GLOW = {
  glass: '#FFD580',
  light: '#FFE0A0',
};

/* ─── Toon gradient ────────────────────────────────────────────────────── */
function useGradientMap() {
  return useMemo(() => {
    const data = Uint8Array.of(50, 130, 200, 255);
    const tex = new THREE.DataTexture(data, 4, 1, THREE.RedFormat);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    return tex;
  }, []);
}

/* ─── Smoothstep for proximity falloff ─────────────────────────────────── */
function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/* ═══════════════════════════════════════════════════════════════════════ */
/*  PropertyVillage                                                        */
/* ═══════════════════════════════════════════════════════════════════════ */
export const PropertyVillage: React.FC<Props> = ({ properties, onPropertyClick, compact = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Track mouse globally so proximity works even when pointer is outside the canvas
  React.useEffect(() => {
    if (containerRef.current) canvasRect = containerRef.current.getBoundingClientRect();
    const onMove = (e: PointerEvent) => {
      globalPointer.x = e.clientX;
      globalPointer.y = e.clientY;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  return (
  <div
    ref={containerRef}
    style={{
      ...containerStyle,
      height: '340px',
    }}
    onPointerEnter={() => {
      if (containerRef.current) canvasRect = containerRef.current.getBoundingClientRect();
      globalPointer.over = true;
    }}
    onPointerLeave={() => {
      globalPointer.over = false;
    }}
  >
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [0, 5.5, 10], fov: 28 }}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl, camera }) => {
        gl.toneMapping = THREE.NoToneMapping;
        camera.lookAt(0, 0.0, 0);
      }}
      style={{ background: 'transparent', overflow: 'visible' }}
    >
      <SceneContent properties={properties} onPropertyClick={onPropertyClick} />
    </Canvas>
  </div>
  );
};

const containerStyle: React.CSSProperties = {
  width: '100%',
  flexShrink: 0,
  overflow: 'visible',
  transition: 'height 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
};

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Scene                                                                  */
/* ═══════════════════════════════════════════════════════════════════════ */
const SceneContent: React.FC<Props> = ({ properties, onPropertyClick }) => {
  const gm = useGradientMap();

  return (
    <>
      <hemisphereLight args={['#FFF5E8', '#E8DDD0', 0.4]} />
      <ambientLight intensity={0.2} color="#FFF5E8" />
      <directionalLight
        position={[5, 8, 5]}
        intensity={0.85}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={1}
        shadow-camera-far={25}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={8}
        shadow-camera-bottom={-4}
        shadow-bias={-0.001}
      />
      <directionalLight position={[-4, 4, -3]} intensity={0.12} color="#D4D8FF" />

      {properties.map((p, i) => (
        <House
          key={p.id}
          property={p}
          idx={i}
          pos={[(i - 1) * 4.8, 0, 0]}
          pal={PALETTES[i % PALETTES.length]}
          gm={gm}
          onClick={() => onPropertyClick(p)}
        />
      ))}

      <ContactShadows position={[0, 0.004, 0]} opacity={0.2} scale={20} blur={3} far={3} frames={1} color="#7B7060" />

      {LANDSCAPE.map((l, i) => {
        if (l.type === 'pine') return <PineTree key={i} position={l.pos} scale={l.s} color={l.c} gm={gm} />;
        if (l.type === 'round') return <RoundTree key={i} position={l.pos} scale={l.s} color={l.c} gm={gm} />;
        return <Bush key={i} position={l.pos} scale={l.s} color={l.c} gm={gm} />;
      })}
    </>
  );
};

const LANDSCAPE: { type: 'pine' | 'round' | 'bush'; pos: [number, number, number]; s: number; c: string }[] = [
  { type: 'round', pos: [-6.5, 0, -0.3], s: 0.7, c: '#6EAD72' },
  { type: 'round', pos: [-5.8, 0, 1.1], s: 0.5, c: '#82BD86' },
  { type: 'bush', pos: [-5.1, 0, 0.2], s: 0.35, c: '#7BBF80' },
  { type: 'pine', pos: [-1.6, 0, 1.0], s: 0.65, c: '#5A9A5E' },
  { type: 'pine', pos: [1.5, 0, 0.8], s: 0.5, c: '#4E8E52' },
  { type: 'round', pos: [6.3, 0, -0.1], s: 0.7, c: '#6EAD72' },
  { type: 'round', pos: [7.0, 0, 1.3], s: 0.5, c: '#82BD86' },
  { type: 'bush', pos: [5.4, 0, 0.9], s: 0.3, c: '#7BBF80' },
];

/* ═══════════════════════════════════════════════════════════════════════ */
/*  House                                                                  */
/* ═══════════════════════════════════════════════════════════════════════ */
const VARIANTS = [BeachModern, ClassicCottage, DesertModern];

interface HouseProps {
  property: PropertyState;
  idx: number;
  pos: [number, number, number];
  pal: (typeof PALETTES)[0];
  gm: THREE.DataTexture;
  onClick: () => void;
}

/* ─── Check if property is booked now or within 48h ────────────────── */
function isBookedSoon(property: PropertyState): boolean {
  const now = Date.now();
  const h48 = 48 * 60 * 60 * 1000;
  return property.bookings.some(b => {
    const checkIn = new Date(b.checkIn).getTime();
    const checkOut = new Date(b.checkOut).getTime();
    return checkIn <= now + h48 && checkOut >= now;
  });
}

function House({ property, idx, pos, pal, gm, onClick }: HouseProps) {
  const group = useRef<THREE.Group>(null!);
  const calGroup = useRef<THREE.Group>(null!);
  const liftY = useRef(0);
  const shake = useRef(0);
  const entrance = useRef(0);
  const prlxX = useRef(0);
  const prlxY = useRef(0);
  const ndcAnchor = useRef<{ x: number; y: number } | null>(null);
  const wasNear = useRef(false);
  const [hovered, setHovered] = useState(false);

  const emergency = property.status === 'emergency';
  const roofCol = STATUS_ROOF[property.status] ?? pal.roof;
  const Variant = VARIANTS[idx % VARIANTS.length];
  const lit = isBookedSoon(property);

  useFrame((state, dt) => {
    if (!group.current) return;

    // Compute static screen-space anchor once (never recomputed)
    if (!ndcAnchor.current) {
      const v = new THREE.Vector3(pos[0], 1, 0).project(state.camera);
      ndcAnchor.current = { x: v.x, y: v.y };
    }

    // Entrance
    if (entrance.current < 1) {
      entrance.current = Math.min(1, entrance.current + dt * (2.5 - idx * 0.3));
      group.current.scale.setScalar(easeOutBack(entrance.current));
    }

    // Pixel-space distance to static anchor (aspect-correct)
    let dx = 0, dy = 0, distPx = 9999;
    if (canvasRect) {
      const anchorScreenX = (ndcAnchor.current.x * 0.5 + 0.5) * canvasRect.width + canvasRect.left;
      const anchorScreenY = (-ndcAnchor.current.y * 0.5 + 0.5) * canvasRect.height + canvasRect.top;
      const pxX = globalPointer.x - anchorScreenX;
      const pxY = globalPointer.y - anchorScreenY;
      distPx = Math.sqrt(pxX * pxX + pxY * pxY);
      // Also compute NDC-space offset for rotation direction
      dx = ((globalPointer.x - canvasRect.left) / canvasRect.width) * 2 - 1 - ndcAnchor.current.x;
      dy = -(((globalPointer.y - canvasRect.top) / canvasRect.height) * 2 - 1) - ndcAnchor.current.y;
    }

    // Hover lift — pixel radius, aspect-correct; require pointer over the village
    const isNear = globalPointer.over && distPx < 120;
    const liftTarget = isNear ? 0.25 : 0;
    liftY.current += (liftTarget - liftY.current) * Math.min(1, dt * 8);
    group.current.position.y = liftY.current;

    // Cursor + hover state (only update React state on change)
    if (isNear && !wasNear.current) {
      activeHouse.idx = idx;
      document.body.style.cursor = 'pointer';
      setHovered(true);
    } else if (!isNear && wasNear.current && activeHouse.idx === idx) {
      activeHouse.idx = -1;
      document.body.style.cursor = 'auto';
      setHovered(false);
    }
    wasNear.current = isNear;

    // Parallax rotation — pixel-based radius, steep quadratic dropoff
    const raw = 1 - smoothstep(20, 400, distPx);
    const prox = raw * raw;
    const tRY = dx * prox * 0.4;
    const tRX = -dy * prox * 0.2;
    const damp = Math.min(1, dt * 5);
    prlxX.current += (tRX - prlxX.current) * damp;
    prlxY.current += (tRY - prlxY.current) * damp;
    group.current.rotation.x = prlxX.current;
    group.current.rotation.y = prlxY.current;

    // Emergency shake
    if (emergency) {
      shake.current += dt * 6;
      const shakeX = Math.sin(shake.current * 4) * 0.04;
      const shakeZ = Math.sin(shake.current * 3) * 0.012;
      group.current.position.x = shakeX;
      group.current.rotation.z = shakeZ;
      // Counter-shake the calendar group so it stays stable
      if (calGroup.current) {
        calGroup.current.position.x = -shakeX;
        calGroup.current.rotation.z = -shakeZ;
      }
    } else {
      group.current.position.x = 0;
      group.current.rotation.z = 0;
      if (calGroup.current) {
        calGroup.current.position.x = 0;
        calGroup.current.rotation.z = 0;
      }
    }
  });

  const priceDelta = property.current_price - property.base_price;
  const onClk = useCallback((e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick(); }, [onClick]);

  return (
    <group position={pos}>
      <group ref={group} scale={0} onClick={onClk}>
        <Float speed={1.2 + idx * 0.3} rotationIntensity={0.05} floatIntensity={0.15} floatingRange={[-0.03, 0.03]}>
          <Variant pal={pal} gm={gm} emergency={emergency} roofCol={roofCol} lit={lit} />
        </Float>

        {emergency && (
          <Sparkles count={15} size={2} speed={0.3} scale={[2.5, 2, 2]} color="#F87171" opacity={0.35} noise={0.8} />
        )}

        {/* Property info label */}
        <Html position={[0, -1.1, 1.6]} center zIndexRange={[1, 0]} style={{ pointerEvents: 'none', userSelect: 'none', overflow: 'visible' }}>
          <div style={lbl.wrap}>
            <div style={lbl.name}>{property.name}</div>
            <div style={lbl.loc}>{property.location}</div>
            <div style={lbl.row}>
              <span style={{
                ...lbl.price,
                backgroundColor: priceDelta > 0 ? 'rgba(5,150,105,0.1)' : priceDelta < 0 ? 'rgba(220,38,38,0.1)' : 'rgba(0,0,0,0.04)',
                color: priceDelta > 0 ? THEME.status.normal : priceDelta < 0 ? THEME.status.emergency : THEME.text.accent,
              }}>
                ${property.current_price}/night
              </span>
              <span style={lbl.rating}><span style={{ color: '#FBBF24' }}>★</span> {property.rating}</span>
            </div>
            <div style={lbl.guest}>{property.guestFlow}</div>
            {property.status !== 'normal' && (
              <div style={{
                ...lbl.badge,
                backgroundColor: emergency ? 'rgba(220,38,38,0.08)' : 'rgba(217,119,6,0.08)',
                color: emergency ? THEME.status.emergency : THEME.status.attention,
                borderColor: emergency ? 'rgba(220,38,38,0.2)' : 'rgba(217,119,6,0.2)',
              }}>
                {emergency ? '⚠ Emergency' : '● Attention'}
              </div>
            )}
          </div>
        </Html>

        {/* Hover calendar — counter-shake group keeps it stable */}
        <group ref={calGroup}>
          <Html position={[2.2, 0.6, 1.0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
            <div style={{
              opacity: hovered ? 1 : 0,
              transform: hovered ? 'translateX(0)' : 'translateX(-8px)',
              transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
            }}>
              <div style={lbl.calendarCard}>
                <MiniCalendar bookings={property.bookings} currentPrice={property.current_price} basePrice={property.base_price} compact />
              </div>
            </div>
          </Html>
        </group>
      </group>
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Building Variants                                                      */
/* ═══════════════════════════════════════════════════════════════════════ */
interface VariantProps {
  pal: (typeof PALETTES)[0];
  gm: THREE.DataTexture;
  emergency: boolean;
  roofCol: string;
  lit: boolean;
}

function BeachModern({ pal, gm, emergency, roofCol, lit }: VariantProps) {
  const gc = emergency ? '#FCA5A5' : lit ? WARM_GLOW.glass : pal.glass;
  return (
    <>
      <mesh position={[0, 0.02, 0]} castShadow>
        <boxGeometry args={[2.15, 0.04, 1.65]} />
        <meshToonMaterial color={pal.base} gradientMap={gm} />
      </mesh>
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.0, 0.9, 1.5]} />
        <meshToonMaterial color={pal.walls} gradientMap={gm} />
      </mesh>
      <RimHull position={[0, 0.5, 0]} args={[2.0, 0.9, 1.5]} />
      <mesh position={[0.15, 1.35, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.6, 0.8, 1.3]} />
        <meshToonMaterial color={pal.walls} gradientMap={gm} />
      </mesh>
      <RimHull position={[0.15, 1.35, 0]} args={[1.6, 0.8, 1.3]} />
      <mesh position={[0.15, 1.78, 0]} castShadow>
        <boxGeometry args={[1.8, 0.06, 1.5]} />
        <meshToonMaterial color={roofCol} gradientMap={gm} />
      </mesh>
      <mesh position={[-0.52, 1.35, 0.651]}>
        <planeGeometry args={[0.54, 0.76]} />
        <meshToonMaterial color={pal.accent} gradientMap={gm} />
      </mesh>
      <GlassPanel pos={[0.32, 1.35, 0.651]} size={[0.85, 0.68]} color={gc} frame={pal.base} gm={gm} flicker={emergency} lit={lit} />
      <GlassPanel pos={[0.15, 0.58, 0.751]} size={[1.3, 0.35]} color={gc} frame={pal.base} gm={gm} flicker={emergency} off={0.8} lit={lit} />
      <GlassPanel pos={[1.001, 0.58, 0.15]} size={[0.5, 0.35]} color={gc} frame={pal.base} gm={gm} rot={[0, Math.PI / 2, 0]} lit={lit} />
      {lit && <pointLight position={[0, 0.8, 0.2]} intensity={0.6} color={WARM_GLOW.light} distance={3} decay={2} />}
      <mesh position={[-0.65, 0.3, 0.752]}>
        <planeGeometry args={[0.3, 0.5]} />
        <meshToonMaterial color={pal.door} gradientMap={gm} />
      </mesh>
      <mesh position={[0, 0.05, 1.05]}>
        <boxGeometry args={[2.0, 0.04, 0.5]} />
        <meshToonMaterial color={pal.accent} gradientMap={gm} />
      </mesh>
      {[-0.7, 0, 0.7].map((x, i) => (
        <mesh key={i} position={[x, 0.2, 1.28]}>
          <boxGeometry args={[0.03, 0.3, 0.03]} />
          <meshToonMaterial color={pal.base} gradientMap={gm} />
        </mesh>
      ))}
      <mesh position={[0, 0.32, 1.28]}>
        <boxGeometry args={[1.44, 0.025, 0.025]} />
        <meshToonMaterial color={pal.base} gradientMap={gm} />
      </mesh>
    </>
  );
}

function ClassicCottage({ pal, gm, emergency, roofCol, lit }: VariantProps) {
  const gc = emergency ? '#FCA5A5' : lit ? WARM_GLOW.glass : pal.glass;
  const w = 1.8, h = 1.3, d = 1.5, roofH = 0.85, ovh = 0.15;

  const roofGeo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-(w / 2 + ovh), 0);
    shape.lineTo(0, roofH);
    shape.lineTo(w / 2 + ovh, 0);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: d + ovh * 2, bevelEnabled: false });
    geo.translate(0, h, -(d / 2 + ovh));
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <>
      <mesh position={[0, 0.03, 0]} castShadow>
        <boxGeometry args={[w + 0.08, 0.06, d + 0.08]} />
        <meshToonMaterial color={pal.base} gradientMap={gm} />
      </mesh>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshToonMaterial color={pal.walls} gradientMap={gm} />
      </mesh>
      <RimHull position={[0, h / 2, 0]} args={[w, h, d]} />
      <mesh geometry={roofGeo} castShadow>
        <meshToonMaterial color={roofCol} gradientMap={gm} />
      </mesh>
      <PanedWindow pos={[-w * 0.24, h * 0.6, d / 2 + 0.005]} size={[0.32, 0.36]} color={gc} frame={pal.accent} gm={gm} flicker={emergency} lit={lit} />
      <PanedWindow pos={[w * 0.24, h * 0.6, d / 2 + 0.005]} size={[0.32, 0.36]} color={gc} frame={pal.accent} gm={gm} flicker={emergency} off={1.2} lit={lit} />
      <PanedWindow pos={[w / 2 + 0.005, h * 0.58, 0]} size={[0.28, 0.3]} color={gc} frame={pal.accent} gm={gm} rot={[0, Math.PI / 2, 0]} lit={lit} />
      {lit && <pointLight position={[0, 0.7, 0.2]} intensity={0.5} color={WARM_GLOW.light} distance={2.5} decay={2} />}
      <mesh position={[0, h * 0.22, d / 2 + 0.006]}>
        <planeGeometry args={[0.32, h * 0.42]} />
        <meshToonMaterial color={pal.door} gradientMap={gm} />
      </mesh>
      <mesh position={[0, h * 0.43 + 0.02, d / 2 + 0.008]}>
        <planeGeometry args={[0.38, 0.04]} />
        <meshToonMaterial color={pal.accent} gradientMap={gm} />
      </mesh>
      <mesh position={[0, 0.04, d / 2 + 0.12]}>
        <boxGeometry args={[0.5, 0.05, 0.14]} />
        <meshToonMaterial color={pal.base} gradientMap={gm} />
      </mesh>
      <mesh position={[0.42, h + roofH * 0.5, -d * 0.15]} castShadow>
        <boxGeometry args={[0.2, roofH * 0.7, 0.2]} />
        <meshToonMaterial color="#C4A882" gradientMap={gm} />
      </mesh>
      <mesh position={[0.42, h + roofH * 0.85, -d * 0.15]}>
        <boxGeometry args={[0.26, 0.05, 0.26]} />
        <meshToonMaterial color="#A89070" gradientMap={gm} />
      </mesh>
      {[0.18, 0.35, 0.52].map((z, i) => (
        <mesh key={i} position={[0, 0.015, d / 2 + z]}>
          <boxGeometry args={[0.14 + i * 0.02, 0.02, 0.08]} />
          <meshToonMaterial color="#C8C2B6" gradientMap={gm} />
        </mesh>
      ))}
      {[-0.6, -0.35, 0.35, 0.6].map((x, i) => (
        <mesh key={i} position={[x, 0.14, d / 2 + 0.55]}>
          <boxGeometry args={[0.03, 0.26, 0.03]} />
          <meshToonMaterial color="#DDD8CE" gradientMap={gm} />
        </mesh>
      ))}
      <mesh position={[0, 0.2, d / 2 + 0.55]}>
        <boxGeometry args={[1.24, 0.025, 0.025]} />
        <meshToonMaterial color="#DDD8CE" gradientMap={gm} />
      </mesh>
      <mesh position={[0, 0.1, d / 2 + 0.55]}>
        <boxGeometry args={[1.24, 0.025, 0.025]} />
        <meshToonMaterial color="#DDD8CE" gradientMap={gm} />
      </mesh>
    </>
  );
}

function DesertModern({ pal, gm, emergency, roofCol, lit }: VariantProps) {
  const gc = emergency ? '#FCA5A5' : lit ? WARM_GLOW.glass : pal.glass;
  return (
    <>
      <mesh position={[0, 0.02, 0]} castShadow>
        <boxGeometry args={[2.35, 0.04, 1.75]} />
        <meshToonMaterial color={pal.base} gradientMap={gm} />
      </mesh>
      <mesh position={[0, 0.62, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 1.2, 1.6]} />
        <meshToonMaterial color={pal.walls} gradientMap={gm} />
      </mesh>
      <RimHull position={[0, 0.62, 0]} args={[2.2, 1.2, 1.6]} />
      <mesh position={[0, 0.12, 0.001]}>
        <boxGeometry args={[2.22, 0.2, 1.62]} />
        <meshToonMaterial color={pal.accent} gradientMap={gm} />
      </mesh>
      <mesh position={[0, 1.25, 0]} castShadow>
        <boxGeometry args={[2.5, 0.06, 1.85]} />
        <meshToonMaterial color={roofCol} gradientMap={gm} />
      </mesh>
      <mesh position={[0.7, 0.48, -1.2]} castShadow>
        <boxGeometry args={[1.1, 0.9, 0.8]} />
        <meshToonMaterial color={pal.walls} gradientMap={gm} />
      </mesh>
      <mesh position={[0.7, 0.96, -1.2]}>
        <boxGeometry args={[1.3, 0.05, 1.0]} />
        <meshToonMaterial color={roofCol} gradientMap={gm} />
      </mesh>
      <GlassPanel pos={[0.15, 0.72, 0.801]} size={[1.6, 0.5]} color={gc} frame={pal.base} gm={gm} flicker={emergency} lit={lit} />
      {[-0.3, 0.2, 0.7].map((x, i) => (
        <mesh key={i} position={[x, 0.72, 0.808]}>
          <planeGeometry args={[0.025, 0.52]} />
          <meshToonMaterial color={pal.base} gradientMap={gm} />
        </mesh>
      ))}
      <GlassPanel pos={[1.101, 0.7, 0.2]} size={[0.55, 0.4]} color={gc} frame={pal.base} gm={gm} rot={[0, Math.PI / 2, 0]} lit={lit} />
      <GlassPanel pos={[1.251, 0.5, -1.2]} size={[0.5, 0.45]} color={gc} frame={pal.base} gm={gm} rot={[0, Math.PI / 2, 0]} lit={lit} />
      {lit && <pointLight position={[0, 0.7, 0.2]} intensity={0.6} color={WARM_GLOW.light} distance={3} decay={2} />}
      <mesh position={[-0.78, 0.35, 0.802]}>
        <planeGeometry args={[0.35, 0.6]} />
        <meshToonMaterial color={pal.door} gradientMap={gm} />
      </mesh>
      <mesh position={[-0.78, 0.68, 1.0]}>
        <boxGeometry args={[0.7, 0.04, 0.5]} />
        <meshToonMaterial color={pal.base} gradientMap={gm} />
      </mesh>
      {[-1.08, -0.48].map((x, i) => (
        <mesh key={i} position={[x, 0.35, 1.22]}>
          <boxGeometry args={[0.04, 0.65, 0.04]} />
          <meshToonMaterial color={pal.base} gradientMap={gm} />
        </mesh>
      ))}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Rim Light                                                              */
/* ═══════════════════════════════════════════════════════════════════════ */
function RimHull({ position, args }: { position: [number, number, number]; args: [number, number, number] }) {
  return (
    <mesh position={position} scale={1.015}>
      <boxGeometry args={args} />
      <meshBasicMaterial color={RIM_COLOR} side={THREE.BackSide} transparent opacity={0.22} depthWrite={false} />
    </mesh>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Windows                                                                */
/* ═══════════════════════════════════════════════════════════════════════ */
function GlassPanel({ pos, size, color, frame, gm, rot, flicker, off = 0, lit }: {
  pos: [number, number, number]; size: [number, number]; color: string; frame: string;
  gm: THREE.DataTexture; rot?: [number, number, number]; flicker?: boolean; off?: number; lit?: boolean;
}) {
  const mat = useRef<THREE.MeshPhysicalMaterial>(null!);
  useFrame(({ clock }) => {
    if (flicker && mat.current) {
      mat.current.opacity = 0.25 + 0.25 * Math.sin(clock.elapsedTime * 5 + off);
    } else if (lit && mat.current) {
      mat.current.opacity = 0.7;
    }
  });
  return (
    <group position={pos} rotation={rot}>
      <mesh>
        <planeGeometry args={[size[0] + 0.03, size[1] + 0.03]} />
        <meshToonMaterial color={frame} gradientMap={gm} />
      </mesh>
      <mesh position={[0, 0, 0.003]}>
        <planeGeometry args={size} />
        <meshPhysicalMaterial
          ref={mat}
          color={color}
          transparent
          opacity={lit ? 0.7 : 0.45}
          roughness={0.15}
          metalness={0.05}
          emissive={lit ? WARM_GLOW.light : '#000000'}
          emissiveIntensity={lit ? 0.4 : 0}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

function PanedWindow({ pos, size, color, frame, gm, rot, flicker, off = 0, lit }: {
  pos: [number, number, number]; size: [number, number]; color: string; frame: string;
  gm: THREE.DataTexture; rot?: [number, number, number]; flicker?: boolean; off?: number; lit?: boolean;
}) {
  const mat = useRef<THREE.MeshToonMaterial>(null!);
  useFrame(({ clock }) => {
    if (flicker && mat.current) {
      mat.current.opacity = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 5 + off);
    } else if (lit && mat.current) {
      mat.current.opacity = 0.85;
    }
  });
  return (
    <group position={pos} rotation={rot}>
      <mesh>
        <planeGeometry args={[size[0] + 0.04, size[1] + 0.04]} />
        <meshToonMaterial color={frame} gradientMap={gm} />
      </mesh>
      <mesh position={[0, 0, 0.003]}>
        <planeGeometry args={size} />
        <meshToonMaterial
          ref={mat}
          color={color}
          gradientMap={gm}
          transparent
          opacity={lit ? 0.85 : 0.7}
          emissive={lit ? WARM_GLOW.light : '#000000'}
          emissiveIntensity={lit ? 0.3 : 0}
        />
      </mesh>
      <mesh position={[0, 0, 0.006]}>
        <planeGeometry args={[size[0], 0.025]} />
        <meshToonMaterial color={frame} gradientMap={gm} />
      </mesh>
      <mesh position={[0, 0, 0.006]}>
        <planeGeometry args={[0.025, size[1]]} />
        <meshToonMaterial color={frame} gradientMap={gm} />
      </mesh>
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Landscaping                                                            */
/* ═══════════════════════════════════════════════════════════════════════ */
function PineTree({ position, scale, color, gm }: {
  position: [number, number, number]; scale: number; color: string; gm: THREE.DataTexture;
}) {
  const upper = useRef<THREE.Mesh>(null!);
  const lower = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const off = position[0] * 0.5;
    if (upper.current) upper.current.rotation.z = Math.sin(t * 1.2 + off) * 0.06;
    if (lower.current) lower.current.rotation.z = Math.sin(t * 1.0 + off) * 0.04;
  });
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.05, 0.07, 0.7, 6]} />
        <meshToonMaterial color="#8B7355" gradientMap={gm} />
      </mesh>
      <mesh ref={lower} position={[0, 0.95, 0]}>
        <coneGeometry args={[0.5, 0.85, 6]} />
        <meshToonMaterial color={color} gradientMap={gm} />
      </mesh>
      <mesh ref={upper} position={[0, 1.5, 0]}>
        <coneGeometry args={[0.38, 0.7, 6]} />
        <meshToonMaterial color={color} gradientMap={gm} />
      </mesh>
    </group>
  );
}

function RoundTree({ position, scale, color, gm }: {
  position: [number, number, number]; scale: number; color: string; gm: THREE.DataTexture;
}) {
  const canopy = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    if (canopy.current) {
      canopy.current.rotation.z = Math.sin(clock.elapsedTime * 0.9 + position[0] * 0.5) * 0.05;
    }
  });
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.04, 0.06, 1.0, 8]} />
        <meshToonMaterial color="#8B7355" gradientMap={gm} />
      </mesh>
      <mesh ref={canopy} position={[0, 1.2, 0]}>
        <sphereGeometry args={[0.5, 8, 6]} />
        <meshToonMaterial color={color} gradientMap={gm} />
      </mesh>
    </group>
  );
}

function Bush({ position, scale, color, gm }: {
  position: [number, number, number]; scale: number; color: string; gm: THREE.DataTexture;
}) {
  return (
    <mesh position={[position[0], position[1] + scale * 0.35, position[2]]} scale={scale}>
      <sphereGeometry args={[0.45, 7, 5]} />
      <meshToonMaterial color={color} gradientMap={gm} />
    </mesh>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────────── */
function easeOutBack(t: number): number {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
}

/* ─── Label styles ────────────────────────────────────────────────────── */
const lbl: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', whiteSpace: 'nowrap',
    fontFamily: "'Plus Jakarta Sans','Inter',system-ui,sans-serif",
    backgroundColor: 'rgba(255,255,255,0.82)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    padding: '6px 12px',
    borderRadius: '10px',
    border: '1px solid rgba(0,0,0,0.06)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  name: { fontSize: '14px', fontWeight: 700, color: THEME.text.accent, lineHeight: '1.2', textAlign: 'center' },
  loc: { fontSize: '11px', color: THEME.text.muted },
  row: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' },
  price: { fontSize: '13px', fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", padding: '2px 8px', borderRadius: '6px' },
  rating: { fontSize: '12px', fontWeight: 600, color: THEME.text.secondary },
  guest: { fontSize: '11px', color: THEME.text.muted, fontWeight: 500 },
  badge: { fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', marginTop: '3px', border: '1px solid' },
  calendarCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    backdropFilter: 'blur(8px)',
    borderRadius: '10px',
    padding: '8px',
    border: '1px solid rgba(0,0,0,0.08)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  },
};
