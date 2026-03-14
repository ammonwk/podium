import React, { useRef, useMemo, useState, useCallback, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { Html, ContactShadows, Float, Environment, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { THEME } from '@apm/shared';
import type { PropertyState } from '../hooks/useSSE';

interface Props {
  properties: PropertyState[];
  onPropertyClick: (property: PropertyState) => void;
}

/* ─── Module-scoped pointer state (avoids React re-renders) ────────────── */
const pointer = { x: 0, y: 0, over: false };

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

/* ═══════════════════════════════════════════════════════════════════════ */
/*  PropertyVillage                                                        */
/* ═══════════════════════════════════════════════════════════════════════ */
export const PropertyVillage: React.FC<Props> = ({ properties, onPropertyClick }) => (
  <div
    style={containerStyle}
    onPointerMove={(e) => {
      const r = e.currentTarget.getBoundingClientRect();
      pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      pointer.over = true;
    }}
    onPointerLeave={() => { pointer.over = false; }}
  >
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 5.5, 10], fov: 28 }}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl, camera, scene }) => {
        gl.toneMapping = THREE.NoToneMapping;
        gl.shadowMap.type = THREE.VSMShadowMap;
        camera.lookAt(0, 1.2, 0);
        scene.environmentIntensity = 0.15;
      }}
      style={{ background: 'transparent' }}
    >
      <SceneContent properties={properties} onPropertyClick={onPropertyClick} />
    </Canvas>
  </div>
);

const containerStyle: React.CSSProperties = { width: '100%', height: '340px', flexShrink: 0 };

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Scene                                                                  */
/* ═══════════════════════════════════════════════════════════════════════ */
const SceneContent: React.FC<Props> = ({ properties, onPropertyClick }) => {
  const gm = useGradientMap();

  return (
    <>
      {/* Lighting — hemisphere + reduced ambient + key + fill + bounce */}
      <hemisphereLight args={['#FFF5E8', '#E8DDD0', 0.35]} />
      <ambientLight intensity={0.25} color="#FFF5E8" />
      <directionalLight
        position={[5, 8, 5]}
        intensity={0.85}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={25}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={8}
        shadow-camera-bottom={-4}
        shadow-bias={-0.0005}
        shadow-radius={4}
      />
      <directionalLight position={[-4, 4, -3]} intensity={0.12} color="#D4D8FF" />
      <pointLight position={[0, 0.5, 3]} intensity={0.15} color="#FFE0C0" distance={10} />

      {/* Environment map for glass reflections (very subtle) */}
      <Suspense fallback={null}>
        <Environment preset="sunset" background={false} />
      </Suspense>

      {/* Houses */}
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

      {/* Contact shadows */}
      <ContactShadows position={[0, 0.004, 0]} opacity={0.2} scale={20} blur={3} far={3} color="#7B7060" />

      {/* Landscaping */}
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

function House({ property, idx, pos, pal, gm, onClick }: HouseProps) {
  const group = useRef<THREE.Group>(null!);
  const [hovered, setHovered] = useState(false);
  const liftY = useRef(0);
  const shake = useRef(0);
  const entrance = useRef(0);
  const prlxX = useRef(0);
  const prlxY = useRef(0);
  const tmpVec = useMemo(() => new THREE.Vector3(), []);

  const emergency = property.status === 'emergency';
  const roofCol = STATUS_ROOF[property.status] ?? pal.roof;
  const Variant = VARIANTS[idx % VARIANTS.length];

  useFrame((state, dt) => {
    if (!group.current) return;

    // Entrance animation
    if (entrance.current < 1) {
      entrance.current = Math.min(1, entrance.current + dt * (2.5 - idx * 0.3));
      group.current.scale.setScalar(easeOutBack(entrance.current));
    }

    // Hover lift
    const target = hovered ? 0.25 : 0;
    liftY.current += (target - liftY.current) * Math.min(1, dt * 10);
    group.current.position.y = pos[1] + liftY.current;

    // Per-house parallax rotation — uses R3F's built-in pointer tracking
    tmpVec.set(pos[0], 1, 0).project(state.camera);
    const dx = state.pointer.x - tmpVec.x;
    const dy = state.pointer.y - tmpVec.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const prox = Math.max(0, 1 - dist / 0.6);
    const tRY = dx * prox * 0.5;
    const tRX = -dy * prox * 0.25;
    const damp = Math.min(1, dt * 5);
    prlxX.current += (tRX - prlxX.current) * damp;
    prlxY.current += (tRY - prlxY.current) * damp;
    group.current.rotation.x = prlxX.current;
    group.current.rotation.y = prlxY.current;

    // Emergency shake (on z-axis, independent)
    if (emergency) {
      shake.current += dt * 6;
      group.current.position.x = pos[0] + Math.sin(shake.current * 4) * 0.04;
      group.current.rotation.z = Math.sin(shake.current * 3) * 0.012;
    } else {
      group.current.position.x = pos[0];
      group.current.rotation.z = 0;
    }
  });

  const priceDelta = property.current_price - property.base_price;

  const onOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer';
  }, []);
  const onOut = useCallback(() => { setHovered(false); document.body.style.cursor = 'auto'; }, []);
  const onClk = useCallback((e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick(); }, [onClick]);

  return (
    <group ref={group} position={pos} scale={0} onPointerOver={onOver} onPointerOut={onOut} onClick={onClk}>
      {/* Gentle idle float */}
      <Float speed={1.2 + idx * 0.3} rotationIntensity={0.06} floatIntensity={0.2} floatingRange={[-0.04, 0.04]}>
        <Variant pal={pal} gm={gm} emergency={emergency} roofCol={roofCol} />
      </Float>

      {/* Emergency sparkles */}
      {emergency && (
        <Sparkles count={15} size={2} speed={0.3} scale={[2.5, 2, 2]} color="#F87171" opacity={0.35} noise={0.8} />
      )}

      {/* Label */}
      <Html position={[0, -1.1, 1.6]} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
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
}

/* ─── Beach Modern ─────────────────────────────────────────────────────── */
function BeachModern({ pal, gm, emergency, roofCol }: VariantProps) {
  const gc = emergency ? '#FCA5A5' : pal.glass;
  return (
    <>
      {/* Foundation */}
      <mesh position={[0, 0.02, 0]} castShadow>
        <boxGeometry args={[2.15, 0.04, 1.65]} />
        <meshToonMaterial color={pal.base} gradientMap={gm} />
      </mesh>

      {/* Lower volume */}
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.0, 0.9, 1.5]} />
        <meshToonMaterial color={pal.walls} gradientMap={gm} />
      </mesh>
      <RimHull position={[0, 0.5, 0]} args={[2.0, 0.9, 1.5]} />

      {/* Upper volume */}
      <mesh position={[0.15, 1.35, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.6, 0.8, 1.3]} />
        <meshToonMaterial color={pal.walls} gradientMap={gm} />
      </mesh>
      <RimHull position={[0.15, 1.35, 0]} args={[1.6, 0.8, 1.3]} />

      {/* Roof slab */}
      <mesh position={[0.15, 1.78, 0]} castShadow>
        <boxGeometry args={[1.8, 0.06, 1.5]} />
        <meshToonMaterial color={roofCol} gradientMap={gm} />
      </mesh>

      {/* Wood accent */}
      <mesh position={[-0.52, 1.35, 0.651]}>
        <planeGeometry args={[0.54, 0.76]} />
        <meshToonMaterial color={pal.accent} gradientMap={gm} />
      </mesh>

      {/* Glass */}
      <GlassPanel pos={[0.32, 1.35, 0.651]} size={[0.85, 0.68]} color={gc} frame={pal.base} gm={gm} flicker={emergency} />
      <GlassPanel pos={[0.15, 0.58, 0.751]} size={[1.3, 0.35]} color={gc} frame={pal.base} gm={gm} flicker={emergency} off={0.8} />
      <GlassPanel pos={[1.001, 0.58, 0.15]} size={[0.5, 0.35]} color={gc} frame={pal.base} gm={gm} rot={[0, Math.PI / 2, 0]} />

      {/* Door */}
      <mesh position={[-0.65, 0.3, 0.752]}>
        <planeGeometry args={[0.3, 0.5]} />
        <meshToonMaterial color={pal.door} gradientMap={gm} />
      </mesh>

      {/* Deck */}
      <mesh position={[0, 0.05, 1.05]} castShadow>
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

/* ─── Classic Cottage ──────────────────────────────────────────────────── */
function ClassicCottage({ pal, gm, emergency, roofCol }: VariantProps) {
  const gc = emergency ? '#FCA5A5' : pal.glass;
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
      {/* Foundation */}
      <mesh position={[0, 0.03, 0]} castShadow>
        <boxGeometry args={[w + 0.08, 0.06, d + 0.08]} />
        <meshToonMaterial color={pal.base} gradientMap={gm} />
      </mesh>

      {/* Walls */}
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshToonMaterial color={pal.walls} gradientMap={gm} />
      </mesh>
      <RimHull position={[0, h / 2, 0]} args={[w, h, d]} />

      {/* Gable roof */}
      <mesh geometry={roofGeo} castShadow>
        <meshToonMaterial color={roofCol} gradientMap={gm} />
      </mesh>

      {/* Front windows — paned */}
      <PanedWindow pos={[-w * 0.24, h * 0.6, d / 2 + 0.005]} size={[0.32, 0.36]} color={gc} frame={pal.accent} gm={gm} flicker={emergency} />
      <PanedWindow pos={[w * 0.24, h * 0.6, d / 2 + 0.005]} size={[0.32, 0.36]} color={gc} frame={pal.accent} gm={gm} flicker={emergency} off={1.2} />

      {/* Side window */}
      <PanedWindow pos={[w / 2 + 0.005, h * 0.58, 0]} size={[0.28, 0.3]} color={gc} frame={pal.accent} gm={gm} rot={[0, Math.PI / 2, 0]} />

      {/* Door + arch */}
      <mesh position={[0, h * 0.22, d / 2 + 0.006]}>
        <planeGeometry args={[0.32, h * 0.42]} />
        <meshToonMaterial color={pal.door} gradientMap={gm} />
      </mesh>
      <mesh position={[0, h * 0.43 + 0.02, d / 2 + 0.008]}>
        <planeGeometry args={[0.38, 0.04]} />
        <meshToonMaterial color={pal.accent} gradientMap={gm} />
      </mesh>

      {/* Doorstep */}
      <mesh position={[0, 0.04, d / 2 + 0.12]}>
        <boxGeometry args={[0.5, 0.05, 0.14]} />
        <meshToonMaterial color={pal.base} gradientMap={gm} />
      </mesh>

      {/* Chimney */}
      <mesh position={[0.42, h + roofH * 0.5, -d * 0.15]} castShadow>
        <boxGeometry args={[0.2, roofH * 0.7, 0.2]} />
        <meshToonMaterial color="#C4A882" gradientMap={gm} />
      </mesh>
      <mesh position={[0.42, h + roofH * 0.85, -d * 0.15]}>
        <boxGeometry args={[0.26, 0.05, 0.26]} />
        <meshToonMaterial color="#A89070" gradientMap={gm} />
      </mesh>

      {/* Stone path */}
      {[0.18, 0.35, 0.52].map((z, i) => (
        <mesh key={i} position={[0, 0.015, d / 2 + z]}>
          <boxGeometry args={[0.14 + i * 0.02, 0.02, 0.08]} />
          <meshToonMaterial color="#C8C2B6" gradientMap={gm} />
        </mesh>
      ))}

      {/* Fence */}
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

/* ─── Desert Modern ────────────────────────────────────────────────────── */
function DesertModern({ pal, gm, emergency, roofCol }: VariantProps) {
  const gc = emergency ? '#FCA5A5' : pal.glass;
  return (
    <>
      {/* Foundation */}
      <mesh position={[0, 0.02, 0]} castShadow>
        <boxGeometry args={[2.35, 0.04, 1.75]} />
        <meshToonMaterial color={pal.base} gradientMap={gm} />
      </mesh>

      {/* Main volume */}
      <mesh position={[0, 0.62, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 1.2, 1.6]} />
        <meshToonMaterial color={pal.walls} gradientMap={gm} />
      </mesh>
      <RimHull position={[0, 0.62, 0]} args={[2.2, 1.2, 1.6]} />

      {/* Stone base band */}
      <mesh position={[0, 0.12, 0.001]} castShadow>
        <boxGeometry args={[2.22, 0.2, 1.62]} />
        <meshToonMaterial color={pal.accent} gradientMap={gm} />
      </mesh>

      {/* Main roof */}
      <mesh position={[0, 1.25, 0]} castShadow>
        <boxGeometry args={[2.5, 0.06, 1.85]} />
        <meshToonMaterial color={roofCol} gradientMap={gm} />
      </mesh>

      {/* Wing */}
      <mesh position={[0.7, 0.48, -1.2]} castShadow receiveShadow>
        <boxGeometry args={[1.1, 0.9, 0.8]} />
        <meshToonMaterial color={pal.walls} gradientMap={gm} />
      </mesh>
      <mesh position={[0.7, 0.96, -1.2]} castShadow>
        <boxGeometry args={[1.3, 0.05, 1.0]} />
        <meshToonMaterial color={roofCol} gradientMap={gm} />
      </mesh>

      {/* Glass */}
      <GlassPanel pos={[0.15, 0.72, 0.801]} size={[1.6, 0.5]} color={gc} frame={pal.base} gm={gm} flicker={emergency} />
      {[-0.3, 0.2, 0.7].map((x, i) => (
        <mesh key={i} position={[x, 0.72, 0.808]}>
          <planeGeometry args={[0.025, 0.52]} />
          <meshToonMaterial color={pal.base} gradientMap={gm} />
        </mesh>
      ))}
      <GlassPanel pos={[1.101, 0.7, 0.2]} size={[0.55, 0.4]} color={gc} frame={pal.base} gm={gm} rot={[0, Math.PI / 2, 0]} />
      <GlassPanel pos={[1.251, 0.5, -1.2]} size={[0.5, 0.45]} color={gc} frame={pal.base} gm={gm} rot={[0, Math.PI / 2, 0]} />

      {/* Door */}
      <mesh position={[-0.78, 0.35, 0.802]}>
        <planeGeometry args={[0.35, 0.6]} />
        <meshToonMaterial color={pal.door} gradientMap={gm} />
      </mesh>

      {/* Covered entry */}
      <mesh position={[-0.78, 0.68, 1.0]} castShadow>
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
/*  Rim Light — inverted hull technique                                    */
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
/*  Window components                                                      */
/* ═══════════════════════════════════════════════════════════════════════ */

/* Modern glass — MeshPhysicalMaterial for subtle reflections */
function GlassPanel({ pos, size, color, frame, gm, rot, flicker, off = 0 }: {
  pos: [number, number, number]; size: [number, number]; color: string; frame: string;
  gm: THREE.DataTexture; rot?: [number, number, number]; flicker?: boolean; off?: number;
}) {
  const mat = useRef<THREE.MeshPhysicalMaterial>(null!);
  useFrame(({ clock }) => {
    if (flicker && mat.current) {
      mat.current.opacity = 0.25 + 0.25 * Math.sin(clock.elapsedTime * 5 + off);
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
          opacity={0.45}
          roughness={0.15}
          metalness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

/* Traditional paned window — toon glass with crossbars */
function PanedWindow({ pos, size, color, frame, gm, rot, flicker, off = 0 }: {
  pos: [number, number, number]; size: [number, number]; color: string; frame: string;
  gm: THREE.DataTexture; rot?: [number, number, number]; flicker?: boolean; off?: number;
}) {
  const mat = useRef<THREE.MeshToonMaterial>(null!);
  useFrame(({ clock }) => {
    if (flicker && mat.current) {
      mat.current.opacity = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 5 + off);
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
        <meshToonMaterial ref={mat} color={color} gradientMap={gm} transparent opacity={0.7} />
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
/*  Landscaping — with wind sway                                           */
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
      <mesh position={[0, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.07, 0.7, 6]} />
        <meshToonMaterial color="#8B7355" gradientMap={gm} />
      </mesh>
      <mesh ref={lower} position={[0, 0.95, 0]} castShadow>
        <coneGeometry args={[0.5, 0.85, 6]} />
        <meshToonMaterial color={color} gradientMap={gm} />
      </mesh>
      <mesh ref={upper} position={[0, 1.5, 0]} castShadow>
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
      const off = position[0] * 0.5;
      canopy.current.rotation.z = Math.sin(clock.elapsedTime * 0.9 + off) * 0.05;
    }
  });
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.06, 1.0, 8]} />
        <meshToonMaterial color="#8B7355" gradientMap={gm} />
      </mesh>
      <mesh ref={canopy} position={[0, 1.2, 0]} castShadow>
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
    <mesh position={[position[0], position[1] + scale * 0.35, position[2]]} scale={scale} castShadow>
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
  wrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', whiteSpace: 'nowrap', fontFamily: "'Plus Jakarta Sans','Inter',system-ui,sans-serif" },
  name: { fontSize: '14px', fontWeight: 700, color: THEME.text.accent, lineHeight: '1.2', textAlign: 'center' },
  loc: { fontSize: '11px', color: THEME.text.muted },
  row: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' },
  price: { fontSize: '13px', fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", padding: '2px 8px', borderRadius: '6px' },
  rating: { fontSize: '12px', fontWeight: 600, color: THEME.text.secondary },
  guest: { fontSize: '11px', color: THEME.text.muted, fontWeight: 500 },
  badge: { fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', marginTop: '3px', border: '1px solid' },
};
