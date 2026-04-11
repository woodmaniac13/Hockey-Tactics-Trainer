/// <reference types="@react-three/fiber" />
import { useRef, useState, useCallback, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { Scenario, Point, TacticalRegionGeometry, OutcomePreview } from '../types';
import { resolveRegionGeometry } from '../utils/regions';

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
type CameraPreset = 'behind_attack' | 'top_down' | 'sideline';

const CAMERA_PRESETS: Record<CameraPreset, {
  position: [number, number, number];
  target: [number, number, number];
}> = {
  behind_attack: { position: [0, 14, 30],  target: [0, 0, -10] },
  top_down:      { position: [0, 44, 0],   target: [0, 0,   0] },
  sideline:      { position: [-22, 10, 0], target: [0, 0,   0] },
};

// ── Field ground ─────────────────────────────────────────────────────────────
function FieldGround() {
  return (
    <>
      {/* Blue surround / run-off zone */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[90, 100]} />
        <meshLambertMaterial color="#1a5c9e" />
      </mesh>
      {/* Green pitch */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[FIELD_X_HALF * 2, FIELD_Z_HALF * 2]} />
        <meshLambertMaterial color="#2d7a2d" />
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
  pitchX, pitchY, color, isTarget, ballPX, ballPY,
  onDragStart,
}: {
  pitchX: number;
  pitchY: number;
  color: string;
  isTarget: boolean;
  ballPX: number;
  ballPY: number;
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
}: {
  scenario: Scenario;
  boardViewMode: 'evaluation' | 'consequence';
  consequenceOverlay: OutcomePreview | null | undefined;
}) {
  if (boardViewMode === 'consequence' && consequenceOverlay) {
    if (!consequenceOverlay.lane_highlight) return null;
    const lh  = consequenceOverlay.lane_highlight;
    const col = lh.state === 'open' ? '#2ecc71' : '#e74c3c';
    return <GeometryOverlay geo={lh.geometry} color={col} opacity={0.32} />;
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

        const col = colorMap[arrow.style] ?? '#ffffff';
        // Shorten both ends slightly
        const sx = x1 + (dx / len) * 0.12;
        const sz = z1 + (dz / len) * 0.12;
        const ex = x2 - (dx / len) * 0.22;
        const ez = z2 - (dz / len) * 0.22;
        const pts: [number, number, number][] = [[sx, 0.55, sz], [ex, 0.55, ez]];

        // Arrowhead cone: default points +Y; rotate R_x(-π/2) to point +Z, then R_y(ay) for direction.
        const coneCx = x2 - (dx / len) * 0.14;
        const coneCz = z2 - (dz / len) * 0.14;
        const ay = Math.atan2(dx, dz); // see coordinate derivation in GeometryOverlay

        return (
          <group key={i}>
            <Line points={pts} color={col} lineWidth={arrow.style === 'pressure' ? 3 : 2} />
            <mesh position={[coneCx, 0.55, coneCz]} rotation={[-Math.PI / 2, ay, 0]}>
              <coneGeometry args={[0.09, 0.22, 8]} />
              <meshBasicMaterial color={col} />
            </mesh>
          </group>
        );
      })}
    </>
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

      {/* Orbit controls */}
      <OrbitControls
        ref={orbitRef as React.MutableRefObject<null>}
        makeDefault
        maxPolarAngle={Math.PI / 2.08}
        minDistance={5}
        maxDistance={65}
        enableDamping
        dampingFactor={0.07}
        target={CAMERA_PRESETS.behind_attack.target}
      />

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
          color="#c0392b"
          isTarget={false}
          ballPX={scenario.ball.x} ballPY={scenario.ball.y}
        />
      ))}

      {/* Teammates (excluding target player) */}
      {scenario.teammates.map(tm =>
        tm.id === scenario.target_player ? null : (
          <PlayerMesh
            key={tm.id}
            pitchX={tm.x} pitchY={tm.y}
            color="#2471a3"
            isTarget={false}
            ballPX={scenario.ball.x} ballPY={scenario.ball.y}
          />
        ),
      )}

      {/* Target player (draggable) */}
      <PlayerMesh
        pitchX={playerPosition.x} pitchY={playerPosition.y}
        color="#3498db"
        isTarget={true}
        ballPX={scenario.ball.x} ballPY={scenario.ball.y}
        onDragStart={onDragStart}
      />

      {/* Ball */}
      <BallMesh pitchX={scenario.ball.x} pitchY={scenario.ball.y} />

      {/* Tactical overlays (shown after submission) */}
      {submitted && showOverlays && (
        <RegionOverlays
          scenario={scenario}
          boardViewMode={boardViewMode}
          consequenceOverlay={consequenceOverlay}
        />
      )}

      {/* Consequence arrows */}
      {submitted && showOverlays && boardViewMode === 'consequence' && consequenceOverlay && (
        <ConsequenceArrows overlay={consequenceOverlay} entityPositions={entityPositions} />
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
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('behind_attack');

  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true;
    const orbit = orbitRef.current as { enabled: boolean } | null;
    if (orbit) orbit.enabled = false;
  }, []);

  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false;
    const orbit = orbitRef.current as { enabled: boolean } | null;
    if (orbit) orbit.enabled = true;
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', borderRadius: '8px', overflow: 'hidden' }}>
      {/* 3-D canvas */}
      <div style={{ width: '100%', aspectRatio: '91.4 / 55' }}>
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
        {(Object.keys(CAMERA_PRESETS) as CameraPreset[]).map(key => (
          <button
            key={key}
            onClick={() => setCameraPreset(key)}
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
        <span style={{ color: '#3498db' }}>■</span> You
        <span style={{ color: '#2471a3' }}>■</span> Team
        <span style={{ color: '#c0392b' }}>■</span> Opp
        <span style={{ color: '#f1c40f' }}>●</span> Ball
      </div>
    </div>
  );
}
