/// <reference types="@react-three/fiber" />
import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Line, Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import type { Scenario, Point, TacticalRegionGeometry, OutcomePreview } from '../types';
import { resolveRegionGeometry } from '../utils/regions';
import {
  type PovCameraState,
  type TouchGestureState,
  initPovCamera,
  createGestureState,
  updatePovCamera,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
  handlePointerPan,
  handleWheel,
  computeOrbitPosition,
} from './camera/povCamera';

// ── Coordinate system ────────────────────────────────────────────────────────
// pitch-x (0 = own goal, 100 = opponent goal) → world Z (+25 near cam → −25 far)
// pitch-y (0 = top touchline, 100 = bottom touchline) → world X (−HALF … +HALF)
const SCALE_Z = 0.5;
const FIELD_ASPECT = 91.4 / 55; // ~1.662
const SCALE_X = SCALE_Z / FIELD_ASPECT; // ≈ 0.301
const FIELD_Z_HALF = 25;
const FIELD_X_HALF = (100 * SCALE_X) / 2; // ≈ 15.1

function pitchToWorld(px: number, py: number, height = 0): [number, number, number] {
  return [(py - 50) * SCALE_X, height, (50 - px) * SCALE_Z];
}

function worldToPitch(wx: number, wz: number): Point {
  return {
    x: Math.max(0, Math.min(100, 50 - wz / SCALE_Z)),
    y: Math.max(0, Math.min(100, 50 + wx / SCALE_X)),
  };
}

// ── Camera presets ───────────────────────────────────────────────────────────
type CameraPreset = 'behind_attack' | 'top_down' | 'sideline' | 'pov';
type FixedCameraPreset = Exclude<CameraPreset, 'pov'>;

const CAMERA_PRESETS: Record<FixedCameraPreset, {
  position: [number, number, number];
  target: [number, number, number];
}> = {
  behind_attack: { position: [0, 14, -30],  target: [0, 0, 10] },
  top_down:      { position: [0, 44, 0],   target: [0, 0,   0] },
  sideline:      { position: [-22, 10, 0], target: [0, 0,   0] },
};

// ── Field ground (blue hockey turf with mowing-stripe pattern) ───────────────
function useMowingTexture() {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    const stripeCount = 12;       // number of mowing stripes along length
    canvas.width  = 64;           // small is fine — repeats across plane
    canvas.height = stripeCount * 32;
    const ctx = canvas.getContext('2d')!;
    const light = '#1976D2';      // lighter blue stripe
    const dark  = '#1565C0';      // darker  blue stripe
    const stripeH = canvas.height / stripeCount;
    for (let i = 0; i < stripeCount; i++) {
      ctx.fillStyle = i % 2 === 0 ? light : dark;
      ctx.fillRect(0, i * stripeH, canvas.width, stripeH);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    return tex;
  }, []);
}

function FieldGround() {
  const stripeTex = useMowingTexture();
  return (
    <>
      {/* Dark blue surround / run-off zone */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[90, 100]} />
        <meshLambertMaterial color="#0D47A1" />
      </mesh>
      {/* Blue pitch with mowing stripe texture */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[FIELD_X_HALF * 2, FIELD_Z_HALF * 2]} />
        <meshLambertMaterial map={stripeTex} />
      </mesh>
    </>
  );
}

// ── Field lines ──────────────────────────────────────────────────────────────
function genArc(
  cx: number,
  cz: number,
  rx: number,
  rz: number,
  startAngle: number,
  endAngle: number,
  segments = 48,
): [number, number, number][] {
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const a = startAngle + (endAngle - startAngle) * (i / segments);
    pts.push([cx + rx * Math.cos(a), 0.025, cz + rz * Math.sin(a)]);
  }
  return pts;
}

function FieldLines() {
  const lw = 1.8;
  const c = 'rgba(255,255,255,0.88)';
  const H = 0.025; // slight elevation above ground to avoid z-fighting

  const bdy: [number, number, number][] = [
    [-FIELD_X_HALF, H, -FIELD_Z_HALF],
    [ FIELD_X_HALF, H, -FIELD_Z_HALF],
    [ FIELD_X_HALF, H,  FIELD_Z_HALF],
    [-FIELD_X_HALF, H,  FIELD_Z_HALF],
    [-FIELD_X_HALF, H, -FIELD_Z_HALF],
  ];
  const centerLine: [number, number, number][] = [
    [-FIELD_X_HALF, H, 0], [FIELD_X_HALF, H, 0],
  ];
  // 23m lines (pitchX≈25 → worldZ=12.5 ; pitchX≈75 → worldZ=-12.5)
  const l23a: [number, number, number][] = [
    [-FIELD_X_HALF, H, 12.5], [FIELD_X_HALF, H, 12.5],
  ];
  const l23b: [number, number, number][] = [
    [-FIELD_X_HALF, H, -12.5], [FIELD_X_HALF, H, -12.5],
  ];
  // Center circle (radius ~5m → 2.75 world units)
  const cc = genArc(0, 0, 2.75, 2.75, 0, Math.PI * 2, 64);

  // Shooting D-shapes — home at z=+25, away at z=−25
  // Formula: x = R*cos(θ),  z = zCenter ∓ R*sin(θ),  θ ∈ [0, π]
  const DR = 8; // D radius (≈14.63m scaled)
  const homeD: [number, number, number][] = [];
  const awayD: [number, number, number][] = [];
  for (let i = 0; i <= 64; i++) {
    const a = Math.PI * (i / 64);
    homeD.push([DR * Math.cos(a), H,  FIELD_Z_HALF - DR * Math.sin(a)]);
    awayD.push([DR * Math.cos(a), H, -FIELD_Z_HALF + DR * Math.sin(a)]);
  }

  // Penalty / centre spots
  const centerSpot     = genArc(0,   0, 0.15, 0.15, 0, Math.PI * 2, 16);
  const homePenaltySpot = genArc(0,  20, 0.15, 0.15, 0, Math.PI * 2, 16);
  const awayPenaltySpot = genArc(0, -20, 0.15, 0.15, 0, Math.PI * 2, 16);

  return (
    <group>
      <Line points={bdy}              color={c} lineWidth={lw} />
      <Line points={centerLine}       color={c} lineWidth={lw} />
      <Line points={l23a}             color={c} lineWidth={lw} />
      <Line points={l23b}             color={c} lineWidth={lw} />
      <Line points={cc}               color={c} lineWidth={lw} />
      <Line points={homeD}            color={c} lineWidth={lw} />
      <Line points={awayD}            color={c} lineWidth={lw} />
      <Line points={centerSpot}       color={c} lineWidth={lw + 1} />
      <Line points={homePenaltySpot}  color={c} lineWidth={lw + 1} />
      <Line points={awayPenaltySpot}  color={c} lineWidth={lw + 1} />
    </group>
  );
}

// ── Goals ────────────────────────────────────────────────────────────────────
// Real-life: 3.66m wide × 2.14m tall × 1.2m deep, scaled to world units.
const GOAL_W = 2.0;
const GOAL_H = 1.2;
const GOAL_D = 0.7;
const POST_R = 0.045;

function GoalMesh({ zCenter, depthDir }: { zCenter: number; depthDir: 1 | -1 }) {
  const hw = GOAL_W / 2;
  const backZ = zCenter + depthDir * GOAL_D;
  const midZ  = (zCenter + backZ) / 2;
  const ps    = POST_R * 2; // post size (box dimension)
  const mat   = <meshLambertMaterial color="#cccccc" />;

  return (
    <group>
      {/* 4 vertical posts */}
      <mesh position={[-hw, GOAL_H / 2, zCenter]} castShadow>
        <cylinderGeometry args={[POST_R, POST_R, GOAL_H, 8]} />{mat}
      </mesh>
      <mesh position={[ hw, GOAL_H / 2, zCenter]} castShadow>
        <cylinderGeometry args={[POST_R, POST_R, GOAL_H, 8]} />{mat}
      </mesh>
      <mesh position={[-hw, GOAL_H / 2, backZ]} castShadow>
        <cylinderGeometry args={[POST_R, POST_R, GOAL_H, 8]} />{mat}
      </mesh>
      <mesh position={[ hw, GOAL_H / 2, backZ]} castShadow>
        <cylinderGeometry args={[POST_R, POST_R, GOAL_H, 8]} />{mat}
      </mesh>
      {/* Front crossbar */}
      <mesh position={[0, GOAL_H, zCenter]}>
        <boxGeometry args={[GOAL_W + ps, ps, ps]} />{mat}
      </mesh>
      {/* Back crossbar */}
      <mesh position={[0, GOAL_H, backZ]}>
        <boxGeometry args={[GOAL_W + ps, ps, ps]} />{mat}
      </mesh>
      {/* Top side bars (left/right) */}
      <mesh position={[-hw, GOAL_H, midZ]}>
        <boxGeometry args={[ps, ps, GOAL_D]} />{mat}
      </mesh>
      <mesh position={[ hw, GOAL_H, midZ]}>
        <boxGeometry args={[ps, ps, GOAL_D]} />{mat}
      </mesh>
      {/* Net planes */}
      <mesh position={[0, GOAL_H / 2, backZ]}>
        <planeGeometry args={[GOAL_W, GOAL_H]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, GOAL_H, midZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[GOAL_W, GOAL_D]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-hw, GOAL_H / 2, midZ]} rotation={[0,  Math.PI / 2, 0]}>
        <planeGeometry args={[GOAL_D, GOAL_H]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[ hw, GOAL_H / 2, midZ]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[GOAL_D, GOAL_H]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ── Player mesh ──────────────────────────────────────────────────────────────
function PlayerMesh({
  pitchX, pitchY, color, isTarget, ballPX, ballPY, role,
  onDragStart,
}: {
  pitchX: number;
  pitchY: number;
  color: string;
  isTarget: boolean;
  ballPX: number;
  ballPY: number;
  role: string;
  onDragStart?: () => void;
}) {
  const [wx, , wz] = pitchToWorld(pitchX, pitchY);
  const [bx, , bz] = pitchToWorld(ballPX, ballPY);
  const facingAngle = Math.atan2(bx - wx, bz - wz);

  const legH   = 0.28;
  const bodyH  = 0.40;
  const headR  = 0.095;
  const legR   = 0.055;
  const bodyR  = 0.105;
  const bodyMat = <meshLambertMaterial color={color} />;

  return (
    <group>
      {/* Player body (rotated to face the ball) */}
      <group position={[wx, 0, wz]} rotation={[0, facingAngle, 0]}>
        {/* Left leg */}
        <mesh position={[-0.07, legH / 2, 0]} castShadow>
          <cylinderGeometry args={[legR * 0.8, legR, legH, 6]} />{bodyMat}
        </mesh>
        {/* Right leg */}
        <mesh position={[0.07, legH / 2, 0]} castShadow>
          <cylinderGeometry args={[legR * 0.8, legR, legH, 6]} />{bodyMat}
        </mesh>
        {/* Torso */}
        <mesh position={[0, legH + bodyH / 2, 0]} castShadow>
          <cylinderGeometry args={[bodyR * 0.72, bodyR, bodyH, 8]} />{bodyMat}
        </mesh>
        {/* Head */}
        <mesh position={[0, legH + bodyH + headR + 0.02, 0]} castShadow>
          <sphereGeometry args={[headR, 10, 8]} />
          <meshLambertMaterial color="#f0c09a" />
        </mesh>
        {/* Hockey stick */}
        <mesh position={[0.13, legH + bodyH * 0.35, 0.22]} rotation={[0.55, 0, 0.15]} castShadow>
          <cylinderGeometry args={[0.02, 0.027, 0.62, 5]} />
          <meshLambertMaterial color="#8B6914" />
        </mesh>
        {/* Target player selection ring */}
        {isTarget && (
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.22, 0.30, 32]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.85} side={THREE.DoubleSide} />
          </mesh>
        )}
        {/* Hit-area sphere (transparent) — captures pointer for drag */}
        {isTarget && (
          <mesh
            position={[0, legH + bodyH / 2, 0]}
            onPointerDown={(e) => {
              e.stopPropagation();
              onDragStart?.();
            }}
          >
            <sphereGeometry args={[0.42, 8, 8]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        )}
      </group>
      {/* Role label — flat on ground, large and readable */}
      <Text
        position={[wx, 0.04, wz + 0.55]}
        rotation={[-Math.PI / 2, 0, Math.PI]}
        fontSize={0.5}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.04}
        outlineColor="#000000"
      >
        {role.substring(0, 2).toUpperCase()}
      </Text>
    </group>
  );
}

// ── Ball ─────────────────────────────────────────────────────────────────────
function BallMesh({ pitchX, pitchY }: { pitchX: number; pitchY: number }) {
  const [wx, , wz] = pitchToWorld(pitchX, pitchY);
  return (
    <mesh position={[wx, 0.07, wz]} castShadow>
      <sphereGeometry args={[0.07, 12, 10]} />
      <meshLambertMaterial color="#f1c40f" />
    </mesh>
  );
}

// ── Dashed line helper ────────────────────────────────────────────────────────
/** Splits a straight 3-D line into alternating dash/gap segments. */
function dashedLinePoints(
  from: [number, number, number],
  to: [number, number, number],
  dashLen = 0.55,
  gapLen  = 0.40,
): [number, number, number][][] {
  const [x1, y1, z1] = from;
  const [x2, y2, z2] = to;
  const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (len < 0.01) return [];
  const segs: [number, number, number][][] = [];
  let t = 0;
  while (t < len) {
    const t1 = t / len;
    const t2 = Math.min((t + dashLen) / len, 1);
    segs.push([
      [x1 + dx * t1, y1 + dy * t1, z1 + dz * t1],
      [x1 + dx * t2, y1 + dy * t2, z1 + dz * t2],
    ]);
    t += dashLen + gapLen;
  }
  return segs;
}

// ── Ball → target player dashed line (evaluation view) ───────────────────────
function BallToPlayerLine({ ballPX, ballPY, playerPX, playerPY }: {
  ballPX: number; ballPY: number; playerPX: number; playerPY: number;
}) {
  const [bx, , bz] = pitchToWorld(ballPX, ballPY, 0.06);
  const [px, , pz] = pitchToWorld(playerPX, playerPY, 0.06);
  const segs = dashedLinePoints([bx, 0.06, bz], [px, 0.06, pz], 0.45, 0.35);
  return (
    <>
      {segs.map((pts, i) => (
        <Line key={i} points={pts as [number,number,number][]} color="rgba(255,255,255,0.5)" lineWidth={1.5} />
      ))}
    </>
  );
}

// ── Geometry overlays (tactics / consequences) ───────────────────────────────
const OVERLAY_Y = 0.03;

function GeometryOverlay({
  geo, color, opacity,
}: {
  geo: TacticalRegionGeometry;
  color: string;
  opacity: number;
}) {
  if (geo.type === 'circle') {
    const [cx, , cz] = pitchToWorld(geo.x, geo.y, OVERLAY_Y);
    const rx = geo.r * SCALE_X;
    const rz = geo.r * SCALE_Z;
    return (
      <mesh position={[cx, OVERLAY_Y, cz]} rotation={[-Math.PI / 2, 0, 0]} scale={[rx, rz, 1]}>
        <circleGeometry args={[1, 32]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    );
  }

  if (geo.type === 'rectangle') {
    const [cx, , cz] = pitchToWorld(geo.x + geo.width / 2, geo.y + geo.height / 2, OVERLAY_Y);
    const wx = geo.height * SCALE_X; // pitch-Y → world-X
    const wz = geo.width  * SCALE_Z; // pitch-X → world-Z
    return (
      <mesh position={[cx, OVERLAY_Y, cz]} rotation={[-Math.PI / 2, geo.rotation ?? 0, 0]}>
        <planeGeometry args={[wx, wz]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    );
  }

  if (geo.type === 'polygon') {
    // Shape lives in local XY; after rotation [-π/2,0,0]:  shapeX→worldX,  shapeY→world(-Z)
    // So: shapeX = (pitchY−50)*SCALE_X,  shapeY = (pitchX−50)*SCALE_Z
    const shape = new THREE.Shape();
    geo.vertices.forEach((v, i) => {
      const sx = (v.y - 50) * SCALE_X;
      const sy = (v.x - 50) * SCALE_Z;
      if (i === 0) shape.moveTo(sx, sy); else shape.lineTo(sx, sy);
    });
    shape.closePath();
    return (
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, OVERLAY_Y, 0]}>
        <shapeGeometry args={[shape]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    );
  }

  if (geo.type === 'lane') {
    const [x1, , z1] = pitchToWorld(geo.x1, geo.y1);
    const [x2, , z2] = pitchToWorld(geo.x2, geo.y2);
    const dx  = x2 - x1;
    const dz  = z2 - z1;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.01) return null;
    const cx  = (x1 + x2) / 2;
    const cz  = (z1 + z2) / 2;
    const worldW = geo.width * SCALE_Z;
    // Rotation: R_x(-π/2) then R_y(ay) makes the plane length face lane direction.
    // ay = atan2(-dx, -dz)
    const ay = Math.atan2(-dx, -dz);
    return (
      <mesh position={[cx, OVERLAY_Y, cz]} rotation={[-Math.PI / 2, ay, 0]}>
        <planeGeometry args={[worldW, len]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    );
  }

  return null;
}

// ── Region overlays (evaluation zones + consequence lane highlights) ──────────
function RegionOverlays({
  scenario,
  boardViewMode,
  consequenceOverlay,
  entityPositions,
}: {
  scenario: Scenario;
  boardViewMode: 'evaluation' | 'consequence';
  consequenceOverlay: OutcomePreview | null | undefined;
  entityPositions: Map<string, Point>;
}) {
  if (boardViewMode === 'consequence' && consequenceOverlay) {
    const passStateColors: Record<string, string> = {
      open: '#2ecc71', blocked: '#e74c3c', risky: '#e67e22',
    };
    return (
      <>
        {/* Pass-option lane strips */}
        {consequenceOverlay.pass_option_states?.map((pos, i) => {
          const fromPt = entityPositions.get(pos.from_entity_id);
          const toPt   = entityPositions.get(pos.to_entity_id);
          if (!fromPt || !toPt) return null;
          const laneGeo: TacticalRegionGeometry = {
            type: 'lane', x1: fromPt.x, y1: fromPt.y,
            x2: toPt.x, y2: toPt.y, width: 3,
          };
          return (
            <GeometryOverlay
              key={`po${i}`}
              geo={laneGeo}
              color={passStateColors[pos.state] ?? '#ffffff'}
              opacity={0.22}
            />
          );
        })}
        {/* Lane highlight fill */}
        {consequenceOverlay.lane_highlight && (
          <GeometryOverlay
            geo={consequenceOverlay.lane_highlight.geometry}
            color={consequenceOverlay.lane_highlight.state === 'open' ? '#2ecc71' : '#e74c3c'}
            opacity={0.32}
          />
        )}
      </>
    );
  }

  return (
    <>
      {scenario.acceptable_regions.map((region, i) => {
        const geo = resolveRegionGeometry(region, scenario);
        if (!geo) return null;
        return <GeometryOverlay key={`acc${i}`} geo={geo} color="#ffdc32" opacity={0.22} />;
      })}
      {scenario.ideal_regions.map((region, i) => {
        const geo = resolveRegionGeometry(region, scenario);
        if (!geo) return null;
        return <GeometryOverlay key={`idl${i}`} geo={geo} color="#64ff64" opacity={0.30} />;
      })}
    </>
  );
}

// ── Consequence arrows (3-D line + cone arrowhead) ───────────────────────────
function ConsequenceArrows({
  overlay,
  entityPositions,
}: {
  overlay: OutcomePreview;
  entityPositions: Map<string, Point>;
}) {
  if (!overlay.arrows) return null;

  const colorMap: Record<string, string> = {
    pass: '#ffdc32', run: '#64b9ff', pressure: '#e74c3c', cover_shift: '#2ecc71',
  };

  return (
    <>
      {overlay.arrows.slice(0, 3).map((arrow, i) => {
        const fromPt = arrow.from_entity_id
          ? entityPositions.get(arrow.from_entity_id) : arrow.from_point;
        const toPt = arrow.to_entity_id
          ? entityPositions.get(arrow.to_entity_id) : arrow.to_point;
        if (!fromPt || !toPt) return null;

        const [x1, , z1] = pitchToWorld(fromPt.x, fromPt.y, 0.55);
        const [x2, , z2] = pitchToWorld(toPt.x,   toPt.y,   0.55);
        const dx  = x2 - x1;
        const dz  = z2 - z1;
        const len = Math.sqrt(dx * dx + dz * dz);
        if (len < 0.3) return null;

        const col       = colorMap[arrow.style] ?? '#ffffff';
        const isRun     = arrow.style === 'run';
        const lineWidth = arrow.style === 'pressure' ? 3 : 2;

        // Shorten ends slightly to leave room for arrowhead
        const sx = x1 + (dx / len) * 0.12;
        const sz = z1 + (dz / len) * 0.12;
        const ex = x2 - (dx / len) * 0.22;
        const ez = z2 - (dz / len) * 0.22;

        // Arrowhead cone
        const coneCx = x2 - (dx / len) * 0.14;
        const coneCz = z2 - (dz / len) * 0.14;
        const ay = Math.atan2(dx, dz);

        // Arrowhead: open (unfilled tip) for run; filled cone for others
        const arrowhead = isRun ? (
          // Open arrowhead — two short lines forming a V
          <>
            <Line
              points={[[coneCx - (dz / len) * 0.13, 0.55, coneCz + (dx / len) * 0.13], [x2, 0.55, z2]]}
              color={col} lineWidth={lineWidth}
            />
            <Line
              points={[[coneCx + (dz / len) * 0.13, 0.55, coneCz - (dx / len) * 0.13], [x2, 0.55, z2]]}
              color={col} lineWidth={lineWidth}
            />
          </>
        ) : (
          <mesh position={[coneCx, 0.55, coneCz]} rotation={[-Math.PI / 2, ay, 0]}>
            <coneGeometry args={[0.09, 0.22, 8]} />
            <meshBasicMaterial color={col} />
          </mesh>
        );

        return (
          <group key={i}>
            {isRun ? (
              // Dashed line for run arrows
              dashedLinePoints([sx, 0.55, sz], [ex, 0.55, ez]).map((pts, j) => (
                <Line key={j} points={pts as [number,number,number][]} color={col} lineWidth={lineWidth} />
              ))
            ) : (
              <Line points={[[sx, 0.55, sz], [ex, 0.55, ez]]} color={col} lineWidth={lineWidth} />
            )}
            {arrowhead}
          </group>
        );
      })}
    </>
  );
}

// ── Entity shift ghosts (consequence view) ────────────────────────────────────
function EntityShiftGhosts({
  overlay,
  entityPositions,
  teammateIds,
}: {
  overlay: OutcomePreview;
  entityPositions: Map<string, Point>;
  teammateIds: Set<string>;
}) {
  if (!overlay.entity_shifts) return null;
  return (
    <>
      {overlay.entity_shifts.slice(0, 2).map((shift, i) => {
        const current = entityPositions.get(shift.entity_id);
        if (!current) return null;
        const [cx, , cz] = pitchToWorld(current.x, current.y);
        const [tx, , tz] = pitchToWorld(shift.to_x, shift.to_y);
        const isTeammate = teammateIds.has(shift.entity_id);
        const ghostColor = isTeammate ? '#FFFFFF' : '#FF1744';
        const segs = dashedLinePoints([cx, 0.55, cz], [tx, 0.55, tz]);
        return (
          <group key={i}>
            {segs.map((pts, j) => (
              <Line key={j} points={pts as [number,number,number][]} color="#64b9ff" lineWidth={2} />
            ))}
            {/* Ghost cylinder at target position */}
            <mesh position={[tx, 0.5, tz]} renderOrder={1}>
              <cylinderGeometry args={[0.22, 0.22, 1.0, 10]} />
              <meshBasicMaterial color={ghostColor} transparent opacity={0.35} depthWrite={false} />
            </mesh>
            <mesh position={[tx, 0.5, tz]} renderOrder={1}>
              <cylinderGeometry args={[0.23, 0.23, 1.0, 10]} />
              <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.45} depthWrite={false} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

// ── Shape result badge (consequence view) ────────────────────────────────────
const SHAPE_LABELS: Record<NonNullable<OutcomePreview['shape_result']>, string> = {
  triangle_formed: '△ Triangle',
  line_restored:   '— Line restored',
  overloaded:      '⊕ Overloaded',
  exposed:         '⚠ Exposed',
};

function ShapeResultLabel({
  overlay,
  entityPositions,
}: {
  overlay: OutcomePreview;
  entityPositions: Map<string, Point>;
}) {
  if (!overlay.shape_result) return null;
  const label = SHAPE_LABELS[overlay.shape_result];

  // Position: centroid of entity shift targets, or above ball
  let refX = 0, refZ = 0;
  if (overlay.entity_shifts && overlay.entity_shifts.length > 0) {
    const shifts = overlay.entity_shifts.slice(0, 2);
    refX = shifts.reduce((s, sh) => s + (sh.to_y - 50) * SCALE_X, 0) / shifts.length;
    refZ = shifts.reduce((s, sh) => s + (50 - sh.to_x) * SCALE_Z, 0) / shifts.length;
  } else {
    const ball = entityPositions.get('ball');
    if (ball) { refX = (ball.y - 50) * SCALE_X; refZ = (50 - ball.x) * SCALE_Z; }
  }

  return (
    <Billboard position={[refX, 2.2, refZ]}>
      <Text
        fontSize={0.28}
        color="#e0e0e0"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.04}
        outlineColor="#000000"
        fillOpacity={0.95}
      >
        {label}
      </Text>
    </Billboard>
  );
}

// ── Drag interaction plane ───────────────────────────────────────────────────
function InteractionPlane({
  onPositionChange,
  submitted,
  isDraggingRef,
  onDragEnd,
}: {
  onPositionChange: (pos: Point) => void;
  submitted: boolean;
  isDraggingRef: React.MutableRefObject<boolean>;
  onDragEnd: () => void;
}) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.005, 0]}
      onPointerMove={(e) => {
        if (!isDraggingRef.current || submitted) return;
        e.stopPropagation();
        onPositionChange(worldToPitch(e.point.x, e.point.z));
      }}
      onPointerUp={() => { isDraggingRef.current = false; onDragEnd(); }}
      onPointerLeave={() => { isDraggingRef.current = false; onDragEnd(); }}
    >
      <planeGeometry args={[FIELD_X_HALF * 2 + 10, FIELD_Z_HALF * 2 + 10]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

// ── Camera controller (handles preset transitions) ───────────────────────────
function CameraController({
  preset,
  orbitRef,
}: {
  preset: CameraPreset;
  orbitRef: React.MutableRefObject<unknown>;
}) {
  const { camera } = useThree();

  useEffect(() => {
    // POV mode is managed by PovCameraController — skip preset application
    if (preset === 'pov') return;
    const p = CAMERA_PRESETS[preset];
    camera.position.set(...p.position);
    const orbit = orbitRef.current as { target: THREE.Vector3; update: () => void } | null;
    if (orbit) {
      orbit.target.set(...p.target);
      orbit.update();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  return null;
}

// ── POV camera controller (useFrame-based, inside Canvas) ────────────────────
function PovCameraController({
  povRef,
}: {
  povRef: React.MutableRefObject<PovCameraState | null>;
}) {
  const { camera } = useThree();

  useFrame((_, dt) => {
    const pov = povRef.current;
    if (!pov || !pov.enabled) return;
    updatePovCamera(pov, camera as THREE.PerspectiveCamera, dt);
  });

  return null;
}

// ── Scene content (all Three.js nodes, rendered inside <Canvas>) ─────────────
interface SceneProps {
  scenario: Scenario;
  playerPosition: Point;
  onPositionChange: (pos: Point) => void;
  submitted: boolean;
  showOverlays: boolean;
  boardViewMode: 'evaluation' | 'consequence';
  consequenceOverlay: OutcomePreview | null | undefined;
  isDraggingRef: React.MutableRefObject<boolean>;
  orbitRef: React.MutableRefObject<unknown>;
  cameraPreset: CameraPreset;
  povRef: React.MutableRefObject<PovCameraState | null>;
  onDragStart: () => void;
  onDragEnd: () => void;
}

function SceneContent({
  scenario,
  playerPosition,
  onPositionChange,
  submitted,
  showOverlays,
  boardViewMode,
  consequenceOverlay,
  isDraggingRef,
  orbitRef,
  cameraPreset,
  povRef,
  onDragStart,
  onDragEnd,
}: SceneProps) {
  // Build entity position map for consequence arrows
  const entityPositions = new Map<string, Point>();
  for (const e of [...scenario.teammates, ...scenario.opponents]) {
    entityPositions.set(e.id, { x: e.x, y: e.y });
  }
  entityPositions.set('ball', scenario.ball);
  entityPositions.set(scenario.target_player, playerPosition);

  const teammateIds = new Set(scenario.teammates.map(t => t.id));

  return (
    <>
      {/* Sky / ambient */}
      <color attach="background" args={['#8ec5d6']} />
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[8, 20, 12]}
        intensity={0.9}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      {/* Orbit controls — disabled when POV mode is active */}
      <OrbitControls
        ref={orbitRef as React.MutableRefObject<null>}
        makeDefault
        enabled={cameraPreset !== 'pov'}
        maxPolarAngle={Math.PI / 2.08}
        minDistance={5}
        maxDistance={65}
        enableDamping
        dampingFactor={0.07}
        target={CAMERA_PRESETS.behind_attack.target}
      />

      {/* POV camera controller (useFrame loop) */}
      <PovCameraController povRef={povRef} />

      {/* Field */}
      <FieldGround />
      <FieldLines />
      <GoalMesh zCenter={ FIELD_Z_HALF} depthDir={ 1} />  {/* home  goal */}
      <GoalMesh zCenter={-FIELD_Z_HALF} depthDir={-1} />  {/* away  goal */}

      {/* Opponents */}
      {scenario.opponents.map(opp => (
        <PlayerMesh
          key={opp.id}
          pitchX={opp.x} pitchY={opp.y}
          color="#FF1744"
          isTarget={false}
          ballPX={scenario.ball.x} ballPY={scenario.ball.y}
          role={opp.role}
        />
      ))}

      {/* Teammates (excluding target player) */}
      {scenario.teammates.map(tm =>
        tm.id === scenario.target_player ? null : (
          <PlayerMesh
            key={tm.id}
            pitchX={tm.x} pitchY={tm.y}
            color="#FFFFFF"
            isTarget={false}
            ballPX={scenario.ball.x} ballPY={scenario.ball.y}
            role={tm.role}
          />
        ),
      )}

      {/* Target player (draggable) */}
      {(() => {
        const targetTm = scenario.teammates.find(t => t.id === scenario.target_player);
        return (
          <PlayerMesh
            pitchX={playerPosition.x} pitchY={playerPosition.y}
            color="#00E676"
            isTarget={true}
            ballPX={scenario.ball.x} ballPY={scenario.ball.y}
            role={targetTm?.role ?? 'TP'}
            onDragStart={onDragStart}
          />
        );
      })()}

      {/* Ball */}
      <BallMesh pitchX={scenario.ball.x} pitchY={scenario.ball.y} />

      {/* Dashed line ball → target player (evaluation view, after submission) */}
      {submitted && boardViewMode === 'evaluation' && (
        <BallToPlayerLine
          ballPX={scenario.ball.x} ballPY={scenario.ball.y}
          playerPX={playerPosition.x} playerPY={playerPosition.y}
        />
      )}

      {/* Tactical overlays (shown after submission) */}
      {submitted && showOverlays && (
        <RegionOverlays
          scenario={scenario}
          boardViewMode={boardViewMode}
          consequenceOverlay={consequenceOverlay}
          entityPositions={entityPositions}
        />
      )}

      {/* Consequence arrows, entity shift ghosts, shape badge */}
      {submitted && showOverlays && boardViewMode === 'consequence' && consequenceOverlay && (
        <>
          <ConsequenceArrows overlay={consequenceOverlay} entityPositions={entityPositions} />
          <EntityShiftGhosts
            overlay={consequenceOverlay}
            entityPositions={entityPositions}
            teammateIds={teammateIds}
          />
          <ShapeResultLabel overlay={consequenceOverlay} entityPositions={entityPositions} />
        </>
      )}

      {/* Invisible drag-interaction plane */}
      <InteractionPlane
        onPositionChange={onPositionChange}
        submitted={submitted}
        isDraggingRef={isDraggingRef}
        onDragEnd={onDragEnd}
      />

      {/* Camera preset animator */}
      <CameraController preset={cameraPreset} orbitRef={orbitRef} />
    </>
  );
}

// ── Board3D props (mirrors Board's public interface) ─────────────────────────
interface Board3DProps {
  scenario: Scenario;
  playerPosition: Point;
  onPositionChange: (pos: Point) => void;
  submitted: boolean;
  showOverlays: boolean;
  boardViewMode?: 'evaluation' | 'consequence';
  consequenceOverlay?: OutcomePreview | null;
}

// ── Camera preset labels ──────────────────────────────────────────────────────
const PRESET_LABELS: Record<CameraPreset, string> = {
  behind_attack: '▶ Attack',
  top_down:      '⬆ Top',
  sideline:      '↔ Side',
  pov:           '👁 POV',
};

// ── Board3D (main export) ────────────────────────────────────────────────────
export default function Board3D({
  scenario,
  playerPosition,
  onPositionChange,
  submitted,
  showOverlays,
  boardViewMode = 'evaluation',
  consequenceOverlay,
}: Board3DProps) {
  const isDraggingRef = useRef(false);
  const orbitRef      = useRef<unknown>(null);
  const povRef        = useRef<PovCameraState | null>(null);
  const gestureRef    = useRef<TouchGestureState>(createGestureState());
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const pointerPovRef = useRef<{ lastX: number; lastY: number; down: boolean }>({ lastX: 0, lastY: 0, down: false });
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('behind_attack');

  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true;
    const orbit = orbitRef.current as { enabled: boolean } | null;
    if (orbit) orbit.enabled = false;
  }, []);

  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false;
    if (cameraPreset !== 'pov') {
      const orbit = orbitRef.current as { enabled: boolean } | null;
      if (orbit) orbit.enabled = true;
    }
  }, [cameraPreset]);

  // Initialise POV camera when entering POV mode
  /** Minimum world-space distance between player and ball to use ball as active play target. */
  const MIN_BALL_DISTANCE_FOR_TARGET = 0.5;
  /** Fallback world-space origin used when the target player entity is not found. */
  const DEFAULT_WORLD_ORIGIN = new THREE.Vector3(0, 0, 0);

  const handlePresetChange = useCallback((preset: CameraPreset) => {
    setCameraPreset(preset);

    if (preset === 'pov') {
      // Seed from target player and ball
      const targetTm = scenario.teammates.find(t => t.id === scenario.target_player);
      const playerPos = targetTm
        ? new THREE.Vector3(...pitchToWorld(playerPosition.x, playerPosition.y))
        : DEFAULT_WORLD_ORIGIN.clone();

      const ballWorldPos = new THREE.Vector3(...pitchToWorld(scenario.ball.x, scenario.ball.y));

      // Use ball as active play target if sufficiently far from player
      const dist = playerPos.distanceTo(ballWorldPos);
      const activeTarget = dist > MIN_BALL_DISTANCE_FOR_TARGET ? ballWorldPos : null;

      povRef.current = initPovCamera(playerPos, activeTarget);
      gestureRef.current = createGestureState();

      // Disable orbit controls
      const orbit = orbitRef.current as { enabled: boolean } | null;
      if (orbit) orbit.enabled = false;
    } else {
      // Disable POV
      if (povRef.current) povRef.current.enabled = false;
      // Re-enable orbit controls
      const orbit = orbitRef.current as { enabled: boolean } | null;
      if (orbit) orbit.enabled = true;
    }
  }, [scenario, playerPosition]);

  // Touch gesture handlers for POV mode on the canvas container
  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (cameraPreset !== 'pov' || !povRef.current) return;
      e.preventDefault();
      handleTouchStart(gestureRef.current, e);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (cameraPreset !== 'pov' || !povRef.current) return;
      e.preventDefault();
      const pov = povRef.current;
      const camPos = computeOrbitPosition(pov.pivot, pov.yaw, pov.pitch, pov.distance);
      handleTouchMove(gestureRef.current, pov, camPos, e);
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (cameraPreset !== 'pov' || !povRef.current) return;
      handleTouchEnd(gestureRef.current, e);
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [cameraPreset]);

  // Mouse/pointer fallback for POV desktop panning
  const onPointerDownPov = useCallback((e: React.PointerEvent) => {
    if (cameraPreset !== 'pov' || !povRef.current) return;
    pointerPovRef.current = { lastX: e.clientX, lastY: e.clientY, down: true };
  }, [cameraPreset]);

  const onPointerMovePov = useCallback((e: React.PointerEvent) => {
    if (cameraPreset !== 'pov' || !povRef.current || !pointerPovRef.current.down) return;
    const dx = e.clientX - pointerPovRef.current.lastX;
    const dy = e.clientY - pointerPovRef.current.lastY;
    const pov = povRef.current;
    const camPos = computeOrbitPosition(pov.pivot, pov.yaw, pov.pitch, pov.distance);
    handlePointerPan(pov, camPos, dx, dy);
    pointerPovRef.current.lastX = e.clientX;
    pointerPovRef.current.lastY = e.clientY;
  }, [cameraPreset]);

  const onPointerUpPov = useCallback(() => {
    pointerPovRef.current.down = false;
  }, []);

  // Wheel zoom for POV mode
  const onWheelPov = useCallback((e: React.WheelEvent) => {
    if (cameraPreset !== 'pov' || !povRef.current) return;
    handleWheel(povRef.current, e.deltaY);
  }, [cameraPreset]);

  return (
    <div style={{ position: 'relative', width: '100%', borderRadius: '8px', overflow: 'hidden' }}>
      {/* 3-D canvas */}
      <div
        ref={canvasContainerRef}
        style={{ width: '100%', aspectRatio: '91.4 / 55' }}
        onPointerDown={onPointerDownPov}
        onPointerMove={onPointerMovePov}
        onPointerUp={onPointerUpPov}
        onPointerLeave={onPointerUpPov}
        onWheel={onWheelPov}
      >
        <Canvas
          shadows
          camera={{ position: CAMERA_PRESETS.behind_attack.position, fov: 50 }}
          style={{ width: '100%', height: '100%' }}
        >
          <SceneContent
            scenario={scenario}
            playerPosition={playerPosition}
            onPositionChange={onPositionChange}
            submitted={submitted}
            showOverlays={showOverlays}
            boardViewMode={boardViewMode}
            consequenceOverlay={consequenceOverlay}
            isDraggingRef={isDraggingRef}
            orbitRef={orbitRef}
            cameraPreset={cameraPreset}
            povRef={povRef}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          />
        </Canvas>
      </div>

      {/* Camera preset buttons (HTML overlay, bottom-right) */}
      <div style={{
        position: 'absolute',
        bottom: '8px',
        right: '8px',
        display: 'flex',
        gap: '4px',
      }}>
        {(Object.keys(PRESET_LABELS) as CameraPreset[]).map(key => (
          <button
            key={key}
            onClick={() => handlePresetChange(key)}
            style={{
              padding: '4px 9px',
              borderRadius: '12px',
              border: 'none',
              background: cameraPreset === key ? 'rgba(52,152,219,0.92)' : 'rgba(0,0,0,0.45)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '0.72rem',
              backdropFilter: 'blur(4px)',
            }}
          >
            {PRESET_LABELS[key]}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div style={{
        position: 'absolute',
        bottom: '8px',
        left: '8px',
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        fontSize: '0.68rem',
        color: '#e0e0e0',
        background: 'rgba(0,0,0,0.45)',
        padding: '3px 8px',
        borderRadius: '10px',
        backdropFilter: 'blur(4px)',
      }}>
        <span style={{ color: '#00E676' }}>■</span> You
        <span style={{ color: '#FFFFFF' }}>■</span> Team
        <span style={{ color: '#FF1744' }}>■</span> Opp
        <span style={{ color: '#f1c40f' }}>●</span> Ball
      </div>
    </div>
  );
}
