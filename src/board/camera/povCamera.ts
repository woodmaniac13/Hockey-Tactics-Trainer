/**
 * POV Camera Controller — tactical map-style camera seeded from a selected player.
 *
 * Gesture semantics:
 *   • single-finger drag → pan (translate pivot in camera plane)
 *   • two-finger pinch → zoom (adjust distance)
 *   • two-finger twist → rotate heading (adjust yaw)
 *
 * Position is always derived from pivot + yaw + pitch + distance (orbit model).
 * No follow-camera behaviour, no automatic re-centering.
 */

import * as THREE from 'three';

// ── Constants ──────────────────────────────────────────────────────────────────

const INITIAL_LOOK_WEIGHT = 0.7;
const INITIAL_PITCH_DEG = -24;
const INITIAL_DISTANCE = 8.8;
const POV_FOV = 46;

const MIN_DISTANCE = 3;
const MAX_DISTANCE = 30;
const MIN_PITCH = -Math.PI / 2 + 0.05;
const MAX_PITCH = -0.05;

const BASE_PAN_SPEED = 0.002;
const TWIST_ROTATE_SPEED = 1.0;

const YAW_SMOOTH = 0.14;
const PIVOT_SMOOTH = 0.14;
const DISTANCE_SMOOTH = 0.12;

/** Fallback offset when no active play target is available — places target in front of player. */
const DEFAULT_TARGET_OFFSET = new THREE.Vector3(0, 0, -3);

const WORLD_UP = new THREE.Vector3(0, 1, 0);

// ── Types ──────────────────────────────────────────────────────────────────────

export type PovCameraState = {
  pivot: THREE.Vector3;
  targetPivot: THREE.Vector3;

  yaw: number;
  targetYaw: number;

  pitch: number;
  targetPitch: number;

  distance: number;
  targetDistance: number;

  fov: number;
  enabled: boolean;
};

export type TouchGestureState = {
  mode: 'none' | 'pan1' | 'gesture2';
  lastSingle?: { x: number; y: number };
  lastMidpoint?: { x: number; y: number };
  lastPinchDistance?: number;
  lastTwistAngle?: number;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function damp(current: number, target: number, smoothing: number, dt: number): number {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-smoothing * 60 * dt));
}

function dampVector3(current: THREE.Vector3, target: THREE.Vector3, smoothing: number, dt: number): void {
  const t = 1 - Math.exp(-smoothing * 60 * dt);
  current.lerp(target, t);
}

function flatten(v: THREE.Vector3): THREE.Vector3 {
  return new THREE.Vector3(v.x, 0, v.z);
}

export function computeOrbitPosition(
  pivot: THREE.Vector3,
  yaw: number,
  pitch: number,
  distance: number,
): THREE.Vector3 {
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);

  const offset = new THREE.Vector3(
    distance * cp * sy,
    distance * sp,
    distance * cp * cy,
  );

  return pivot.clone().sub(offset);
}

// ── Initialization ─────────────────────────────────────────────────────────────

/**
 * Initialise POV camera from selected player position and an active play target.
 *
 * @param playerWorldPos  Selected player position in world space.
 * @param targetWorldPos  Active play target (e.g. ball carrier) in world space.
 *                        If null, a point in front of the player (+Z) is used.
 */
export function initPovCamera(
  playerWorldPos: THREE.Vector3,
  targetWorldPos: THREE.Vector3 | null,
): PovCameraState {
  const target = targetWorldPos ?? playerWorldPos.clone().add(DEFAULT_TARGET_OFFSET);

  const pivot = playerWorldPos.clone().lerp(target, INITIAL_LOOK_WEIGHT);

  const playDir = flatten(target.clone().sub(playerWorldPos));
  const len = playDir.length();
  const yaw = len > 0.01 ? Math.atan2(playDir.x, playDir.z) : 0;

  const pitch = THREE.MathUtils.degToRad(INITIAL_PITCH_DEG);

  return {
    pivot: pivot.clone(),
    targetPivot: pivot.clone(),
    yaw,
    targetYaw: yaw,
    pitch,
    targetPitch: pitch,
    distance: INITIAL_DISTANCE,
    targetDistance: INITIAL_DISTANCE,
    fov: POV_FOV,
    enabled: true,
  };
}

// ── Gesture handling ───────────────────────────────────────────────────────────

export function createGestureState(): TouchGestureState {
  return { mode: 'none' };
}

/**
 * Pan the camera pivot by screen-space deltas.
 * Computes world-space offset in the camera plane and shifts targetPivot.
 */
export function panByScreenDelta(
  pov: PovCameraState,
  dx: number,
  dy: number,
  cameraPosition: THREE.Vector3,
): void {
  const forward = pov.pivot.clone().sub(cameraPosition).normalize();
  const right = new THREE.Vector3().crossVectors(forward, WORLD_UP).normalize();
  const panUp = new THREE.Vector3().crossVectors(right, forward).normalize();

  const panScale = BASE_PAN_SPEED * pov.distance;

  const offset = right.clone().multiplyScalar(-dx * panScale)
    .add(panUp.clone().multiplyScalar(dy * panScale));

  pov.targetPivot.add(offset);
}

/**
 * Adjust zoom (distance) from a pinch scale delta.
 * scaleDelta > 1 means fingers moved apart → zoom in (reduce distance).
 */
/** Fraction of raw pinch scale applied per gesture frame (0–1). */
const PINCH_ZOOM_SENSITIVITY = 0.3;

export function zoomByPinch(pov: PovCameraState, scaleDelta: number): void {
  // Dampen the raw pinch ratio so small finger movements don't jump too far.
  const dampened = 1 + (scaleDelta - 1) * PINCH_ZOOM_SENSITIVITY;
  // Invert: spreading fingers should zoom in (reduce distance)
  pov.targetDistance *= 1 / dampened;
  pov.targetDistance = clamp(pov.targetDistance, MIN_DISTANCE, MAX_DISTANCE);
}

/**
 * Rotate yaw from a twist angle delta (radians).
 */
export function rotateByTwist(pov: PovCameraState, angleDelta: number): void {
  pov.targetYaw += angleDelta * TWIST_ROTATE_SPEED;
}

// ── Per-frame update ───────────────────────────────────────────────────────────

/**
 * Smooth the POV camera state and apply to the Three.js camera.
 * Should be called from useFrame.
 */
export function updatePovCamera(
  pov: PovCameraState,
  camera: THREE.PerspectiveCamera,
  dt: number,
): void {
  if (!pov.enabled) return;

  // Damp orbital parameters
  pov.yaw = damp(pov.yaw, pov.targetYaw, YAW_SMOOTH, dt);
  pov.pitch = damp(pov.pitch, pov.targetPitch, YAW_SMOOTH, dt);
  pov.distance = damp(pov.distance, pov.targetDistance, DISTANCE_SMOOTH, dt);
  dampVector3(pov.pivot, pov.targetPivot, PIVOT_SMOOTH, dt);

  // Clamp pitch
  pov.pitch = clamp(pov.pitch, MIN_PITCH, MAX_PITCH);
  pov.targetPitch = clamp(pov.targetPitch, MIN_PITCH, MAX_PITCH);

  // Derive position from orbit
  const derivedPos = computeOrbitPosition(pov.pivot, pov.yaw, pov.pitch, pov.distance);

  camera.position.copy(derivedPos);
  camera.lookAt(pov.pivot);
  camera.fov = pov.fov;
  camera.updateProjectionMatrix();
}

// ── Touch event processing ─────────────────────────────────────────────────────

function touchMidpoint(t1: Touch, t2: Touch): { x: number; y: number } {
  return { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
}

function touchDistance(t1: Touch, t2: Touch): number {
  const dx = t2.clientX - t1.clientX;
  const dy = t2.clientY - t1.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function touchAngle(t1: Touch, t2: Touch): number {
  return Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);
}

export function handleTouchStart(gesture: TouchGestureState, e: TouchEvent): void {
  if (e.touches.length === 1) {
    gesture.mode = 'pan1';
    gesture.lastSingle = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    gesture.lastMidpoint = undefined;
    gesture.lastPinchDistance = undefined;
    gesture.lastTwistAngle = undefined;
  } else if (e.touches.length === 2) {
    gesture.mode = 'gesture2';
    gesture.lastSingle = undefined;
    gesture.lastMidpoint = touchMidpoint(e.touches[0], e.touches[1]);
    gesture.lastPinchDistance = touchDistance(e.touches[0], e.touches[1]);
    gesture.lastTwistAngle = touchAngle(e.touches[0], e.touches[1]);
  }
}

export function handleTouchMove(
  gesture: TouchGestureState,
  pov: PovCameraState,
  cameraPosition: THREE.Vector3,
  e: TouchEvent,
): void {
  if (e.touches.length === 1 && gesture.mode === 'pan1' && gesture.lastSingle) {
    const dx = e.touches[0].clientX - gesture.lastSingle.x;
    const dy = e.touches[0].clientY - gesture.lastSingle.y;
    panByScreenDelta(pov, dx, dy, cameraPosition);
    gesture.lastSingle = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  } else if (e.touches.length === 2 && gesture.mode === 'gesture2') {
    const mid = touchMidpoint(e.touches[0], e.touches[1]);
    const dist = touchDistance(e.touches[0], e.touches[1]);
    const angle = touchAngle(e.touches[0], e.touches[1]);

    if (gesture.lastPinchDistance != null && gesture.lastPinchDistance > 0) {
      const scaleDelta = dist / gesture.lastPinchDistance;
      zoomByPinch(pov, scaleDelta);
    }

    if (gesture.lastTwistAngle != null) {
      let angleDelta = angle - gesture.lastTwistAngle;
      // Normalise to [-π, π]
      while (angleDelta > Math.PI) angleDelta -= 2 * Math.PI;
      while (angleDelta < -Math.PI) angleDelta += 2 * Math.PI;
      rotateByTwist(pov, angleDelta);
    }

    gesture.lastMidpoint = mid;
    gesture.lastPinchDistance = dist;
    gesture.lastTwistAngle = angle;
  }
}

export function handleTouchEnd(gesture: TouchGestureState, e: TouchEvent): void {
  if (e.touches.length === 0) {
    gesture.mode = 'none';
    gesture.lastSingle = undefined;
    gesture.lastMidpoint = undefined;
    gesture.lastPinchDistance = undefined;
    gesture.lastTwistAngle = undefined;
  } else if (e.touches.length === 1) {
    // Transition back to single-finger pan
    gesture.mode = 'pan1';
    gesture.lastSingle = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    gesture.lastMidpoint = undefined;
    gesture.lastPinchDistance = undefined;
    gesture.lastTwistAngle = undefined;
  }
}

// ── Mouse/pointer fallback for desktop ─────────────────────────────────────────

export function handlePointerPan(
  pov: PovCameraState,
  cameraPosition: THREE.Vector3,
  dx: number,
  dy: number,
): void {
  panByScreenDelta(pov, dx, dy, cameraPosition);
}

export function handleWheel(pov: PovCameraState, deltaY: number): void {
  const factor = deltaY > 0 ? 1.08 : 0.93;
  pov.targetDistance *= factor;
  pov.targetDistance = clamp(pov.targetDistance, MIN_DISTANCE, MAX_DISTANCE);
}
