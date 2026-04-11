/**
 * POV Camera Controller — ground-anchored map-style camera seeded from a selected player.
 *
 * Gesture semantics (touch):
 *   • single-finger drag → ground-anchored pan (keeps touched field point under finger)
 *   • two-finger pinch   → zoom toward centroid ground intercept
 *   • two-finger twist   → rotate heading around centroid ground intercept
 *   • two-finger parallel vertical swipe → adjust pitch (horizon tilt)
 *   • two-finger centroid translation → ground-anchored pan (simultaneous with above)
 *
 * Gesture semantics (desktop):
 *   • left mouse drag         → ground-anchored pan
 *   • right mouse / Alt+left  → heading + pitch
 *   • wheel                   → zoom toward cursor ground intercept
 *
 * Position is always derived from pivot + yaw + pitch + distance (orbit model).
 * pivot and targetPivot always lie on the ground plane (y = 0).
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
/** Negative = looking downward; -π/2+ε = top-down */
const MIN_PITCH = -Math.PI / 2 + 0.05;
/** Close to 0 = horizon */
const MAX_PITCH = -0.05;

const TWIST_ROTATE_SPEED = 1.0;
const PINCH_ZOOM_SENSITIVITY = 0.3;
const PITCH_SENSITIVITY = 0.003;
const DESKTOP_ROTATE_SENSITIVITY = 0.004;
const DESKTOP_PITCH_SENSITIVITY = 0.003;

const YAW_SMOOTH = 0.14;
const PIVOT_SMOOTH = 0.14;
const DISTANCE_SMOOTH = 0.12;

/** Fallback offset when no active play target is available — places target in front of player. */
const DEFAULT_TARGET_OFFSET = new THREE.Vector3(0, 0, -3);

// ── Types ──────────────────────────────────────────────────────────────────────

export type PovCameraState = {
  pivot: THREE.Vector3;
  targetPivot: THREE.Vector3;

  yaw: number;
  targetYaw: number;

  /** Negative = looking down, closer to 0 = horizon */
  pitch: number;
  targetPitch: number;

  distance: number;
  targetDistance: number;

  fov: number;
  enabled: boolean;
};

export type GestureMode = 'none' | 'pan1' | 'gesture2';
export type ScreenPoint = { x: number; y: number };

export type TouchGestureState = {
  mode: GestureMode;

  // one-finger
  lastSingle?: ScreenPoint;

  // two-finger — individual positions for pitch detection
  lastTouch0?: ScreenPoint;
  lastTouch1?: ScreenPoint;

  lastMidpoint?: ScreenPoint;
  lastPinchDistance?: number;
  lastTwistAngle?: number;

  /** Stable world anchor under centroid for ground-plane correction. */
  lastAnchorWorld?: THREE.Vector3 | null;
};

export type ViewportRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type DesktopGestureState = {
  down: boolean;
  mode: 'none' | 'pan' | 'rotatePitch';
  lastX: number;
  lastY: number;
};

// ── Numeric helpers ────────────────────────────────────────────────────────────

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

// ── Ray / ground-plane helpers ─────────────────────────────────────────────────

/** Convert DOM client coordinates to NDC (-1…+1). */
export function screenPointToNdc(
  x: number,
  y: number,
  rect: ViewportRect,
): THREE.Vector2 {
  return new THREE.Vector2(
    ((x - rect.left) / rect.width) * 2 - 1,
    -((y - rect.top) / rect.height) * 2 + 1,
  );
}

const _raycaster = new THREE.Raycaster();

/** Cast a ray from the camera through a screen point. */
export function screenPointToRay(
  camera: THREE.PerspectiveCamera,
  x: number,
  y: number,
  rect: ViewportRect,
  raycaster: THREE.Raycaster = _raycaster,
): THREE.Ray {
  const ndc = screenPointToNdc(x, y, rect);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.ray.clone();
}

/** Intersect a ray with a horizontal plane at y = groundY. Returns null if parallel or behind. */
export function intersectGroundPlane(
  ray: THREE.Ray,
  groundY = 0,
  out?: THREE.Vector3,
): THREE.Vector3 | null {
  const denom = ray.direction.y;
  if (Math.abs(denom) < 1e-8) return null; // parallel
  const t = (groundY - ray.origin.y) / denom;
  if (t < 0) return null; // behind camera
  const result = out ?? new THREE.Vector3();
  result.copy(ray.origin).addScaledVector(ray.direction, t);
  return result;
}

/** Raycast from camera through screen point to ground plane y = groundY. */
export function screenPointToGround(
  camera: THREE.PerspectiveCamera,
  x: number,
  y: number,
  rect: ViewportRect,
  groundY = 0,
  raycaster?: THREE.Raycaster,
  out?: THREE.Vector3,
): THREE.Vector3 | null {
  const ray = screenPointToRay(camera, x, y, rect, raycaster);
  return intersectGroundPlane(ray, groundY, out);
}

// ── Orbit position ─────────────────────────────────────────────────────────────

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

// ── Temporary camera pose from state ───────────────────────────────────────────

/**
 * Compute a camera position and target from an orbit-derived state snapshot.
 * Used for anchor correction during event handling without mutating the real camera.
 */
export function computeCameraPoseFromState(
  povLike: {
    pivot: THREE.Vector3;
    yaw: number;
    pitch: number;
    distance: number;
  },
): { position: THREE.Vector3; target: THREE.Vector3 } {
  const position = computeOrbitPosition(
    povLike.pivot,
    povLike.yaw,
    povLike.pitch,
    povLike.distance,
  );
  return { position, target: povLike.pivot.clone() };
}

/**
 * Create a temporary PerspectiveCamera positioned according to the given target state.
 * This is used for anchor correction: after modifying target values we need to know
 * where the centroid would land on the ground under the *new* camera pose.
 */
function buildTempCamera(
  pov: PovCameraState,
  realCamera: THREE.PerspectiveCamera,
): THREE.PerspectiveCamera {
  const temp = realCamera.clone();
  const pose = computeCameraPoseFromState({
    pivot: pov.targetPivot,
    yaw: pov.targetYaw,
    pitch: pov.targetPitch,
    distance: pov.targetDistance,
  });
  temp.position.copy(pose.position);
  temp.lookAt(pose.target);
  temp.updateMatrixWorld(true);
  return temp;
}

// ── State clamping ─────────────────────────────────────────────────────────────

/** Authoritative clamp for all POV state fields. */
export function clampPovState(pov: PovCameraState): void {
  // Distance
  pov.distance = clamp(pov.distance, MIN_DISTANCE, MAX_DISTANCE);
  pov.targetDistance = clamp(pov.targetDistance, MIN_DISTANCE, MAX_DISTANCE);

  // Pitch
  pov.pitch = clamp(pov.pitch, MIN_PITCH, MAX_PITCH);
  pov.targetPitch = clamp(pov.targetPitch, MIN_PITCH, MAX_PITCH);

  // Yaw — normalise to [−π, π]
  pov.yaw = ((pov.yaw % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
  pov.targetYaw = ((pov.targetYaw % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;

  // Ground plane invariant
  pov.pivot.y = 0;
  pov.targetPivot.y = 0;
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
  pivot.y = 0; // enforce ground plane

  const playDir = flatten(target.clone().sub(playerWorldPos));
  const len = playDir.length();
  const yaw = len > 0.01 ? Math.atan2(playDir.x, playDir.z) : 0;

  const pitch = THREE.MathUtils.degToRad(INITIAL_PITCH_DEG);

  const state: PovCameraState = {
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

  clampPovState(state);
  return state;
}

// ── Input helpers (pure state mutations) ───────────────────────────────────────

/**
 * Ground-anchored pan: shift pivot so that the touched field point stays under the finger.
 */
export function panByGroundPoints(
  pov: PovCameraState,
  fromGround: THREE.Vector3,
  toGround: THREE.Vector3,
): void {
  const delta = fromGround.clone().sub(toGround);
  delta.y = 0;
  pov.targetPivot.add(delta);
  pov.targetPivot.y = 0;
}

/**
 * Adjust zoom (distance) from a pinch scale ratio.
 * scaleRatio > 1 means fingers moved apart → zoom in (reduce distance).
 */
export function zoomByPinch(
  pov: PovCameraState,
  scaleRatio: number,
  options?: {
    minDistance?: number;
    maxDistance?: number;
    zoomSensitivity?: number;
  },
): void {
  const minDist = options?.minDistance ?? MIN_DISTANCE;
  const maxDist = options?.maxDistance ?? MAX_DISTANCE;
  const sensitivity = options?.zoomSensitivity ?? PINCH_ZOOM_SENSITIVITY;

  const dampened = 1 + (scaleRatio - 1) * sensitivity;
  pov.targetDistance *= 1 / dampened;
  pov.targetDistance = clamp(pov.targetDistance, minDist, maxDist);
}

/**
 * Rotate heading (yaw) from a twist angle delta (radians).
 */
export function rotateByTwist(
  pov: PovCameraState,
  angleDelta: number,
  rotateSensitivity = TWIST_ROTATE_SPEED,
): void {
  pov.targetYaw += angleDelta * rotateSensitivity;
}

/**
 * Adjust pitch from parallel vertical finger motion.
 *   • positive pitchPixels (fingers moving upward on screen) → tilt toward horizon (increase pitch toward MAX_PITCH / 0)
 *   • negative pitchPixels (fingers moving downward) → tilt toward top-down (decrease pitch toward MIN_PITCH)
 */
export function pitchByParallelVerticalMotion(
  pov: PovCameraState,
  pitchPixels: number,
  pitchSensitivity: number = PITCH_SENSITIVITY,
): void {
  // Screen-up is negative clientY delta, but we receive pitchPixels as average dy
  // where negative dy = upward motion = push pitch toward horizon (closer to 0).
  // Since pitch is negative (looking down), adding a positive value moves toward 0 = horizon.
  pov.targetPitch -= pitchPixels * pitchSensitivity;
  pov.targetPitch = clamp(pov.targetPitch, MIN_PITCH, MAX_PITCH);
}

/**
 * Shift targetPivot so that the ground point under the screen centroid
 * remains stable after a zoom/rotate/pitch change.
 */
export function applyAnchorCorrection(
  pov: PovCameraState,
  anchorBefore: THREE.Vector3 | null,
  anchorAfter: THREE.Vector3 | null,
): void {
  if (!anchorBefore || !anchorAfter) return;
  const correction = anchorBefore.clone().sub(anchorAfter);
  correction.y = 0;
  pov.targetPivot.add(correction);
  pov.targetPivot.y = 0;
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

  // Authoritative clamp
  clampPovState(pov);

  // Derive position from orbit
  const derivedPos = computeOrbitPosition(pov.pivot, pov.yaw, pov.pitch, pov.distance);

  camera.position.copy(derivedPos);
  camera.lookAt(pov.pivot);
  camera.fov = pov.fov;
  camera.updateProjectionMatrix();
}

// ── Gesture state factory ──────────────────────────────────────────────────────

export function createGestureState(): TouchGestureState {
  return { mode: 'none' };
}

export function createDesktopGestureState(): DesktopGestureState {
  return { down: false, mode: 'none', lastX: 0, lastY: 0 };
}

// ── Touch-event helpers ────────────────────────────────────────────────────────

function touchMidpoint(t1: Touch, t2: Touch): ScreenPoint {
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

// ── Touch event processing ─────────────────────────────────────────────────────

export function handleTouchStart(
  gesture: TouchGestureState,
  e: TouchEvent,
  camera: THREE.PerspectiveCamera,
  rect: ViewportRect,
): void {
  if (e.touches.length === 1) {
    gesture.mode = 'pan1';
    const pt: ScreenPoint = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    gesture.lastSingle = pt;
    gesture.lastTouch0 = undefined;
    gesture.lastTouch1 = undefined;
    gesture.lastMidpoint = undefined;
    gesture.lastPinchDistance = undefined;
    gesture.lastTwistAngle = undefined;
    gesture.lastAnchorWorld = screenPointToGround(camera, pt.x, pt.y, rect);
  } else if (e.touches.length === 2) {
    gesture.mode = 'gesture2';
    gesture.lastSingle = undefined;
    const t0: ScreenPoint = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    const t1: ScreenPoint = { x: e.touches[1].clientX, y: e.touches[1].clientY };
    gesture.lastTouch0 = t0;
    gesture.lastTouch1 = t1;
    const mid = touchMidpoint(e.touches[0], e.touches[1]);
    gesture.lastMidpoint = mid;
    gesture.lastPinchDistance = touchDistance(e.touches[0], e.touches[1]);
    gesture.lastTwistAngle = touchAngle(e.touches[0], e.touches[1]);
    gesture.lastAnchorWorld = screenPointToGround(camera, mid.x, mid.y, rect);
  }
}

export function handleTouchMove(
  gesture: TouchGestureState,
  pov: PovCameraState,
  camera: THREE.PerspectiveCamera,
  rect: ViewportRect,
  e: TouchEvent,
): void {
  // ── One-finger: ground-anchored pan ──
  if (e.touches.length === 1 && gesture.mode === 'pan1' && gesture.lastSingle) {
    const prev = gesture.lastSingle;
    const curr: ScreenPoint = { x: e.touches[0].clientX, y: e.touches[0].clientY };

    const groundPrev = screenPointToGround(camera, prev.x, prev.y, rect);
    const groundCurr = screenPointToGround(camera, curr.x, curr.y, rect);

    if (groundPrev && groundCurr) {
      panByGroundPoints(pov, groundPrev, groundCurr);
      clampPovState(pov);
    }

    gesture.lastSingle = curr;
    gesture.lastAnchorWorld = groundCurr ?? gesture.lastAnchorWorld;
    return;
  }

  // ── Two-finger: combined zoom + pitch + rotate + pan ──
  if (e.touches.length === 2 && gesture.mode === 'gesture2') {
    const t0: ScreenPoint = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    const t1: ScreenPoint = { x: e.touches[1].clientX, y: e.touches[1].clientY };
    const mid = touchMidpoint(e.touches[0], e.touches[1]);
    const dist = touchDistance(e.touches[0], e.touches[1]);
    const angle = touchAngle(e.touches[0], e.touches[1]);

    // ── Derive deltas ──
    const scaleRatio = (gesture.lastPinchDistance != null && gesture.lastPinchDistance > 0)
      ? dist / gesture.lastPinchDistance
      : 1;

    let twistDelta = 0;
    if (gesture.lastTwistAngle != null) {
      twistDelta = angle - gesture.lastTwistAngle;
      while (twistDelta > Math.PI) twistDelta -= 2 * Math.PI;
      while (twistDelta < -Math.PI) twistDelta += 2 * Math.PI;
    }

    // Per-finger motion for pitch detection
    let pitchPixels = 0;
    if (gesture.lastTouch0 && gesture.lastTouch1) {
      const v0 = { x: t0.x - gesture.lastTouch0.x, y: t0.y - gesture.lastTouch0.y };
      const v1 = { x: t1.x - gesture.lastTouch1.x, y: t1.y - gesture.lastTouch1.y };

      // Require both fingers to be moving in roughly the same direction
      // and both more vertical than horizontal
      const sameDir = v0.y * v1.y > 0;
      const v0Vert = Math.abs(v0.y) > Math.abs(v0.x) * 0.7;
      const v1Vert = Math.abs(v1.y) > Math.abs(v1.x) * 0.7;

      if (sameDir && v0Vert && v1Vert) {
        pitchPixels = (v0.y + v1.y) * 0.5;
      }
    }

    // ── anchorBefore = ground point under centroid before transforms ──
    const anchorBefore = screenPointToGround(camera, mid.x, mid.y, rect);

    // ── Apply transforms to target state ──
    // 1. Zoom
    if (scaleRatio !== 1) {
      zoomByPinch(pov, scaleRatio);
    }

    // 2. Pitch
    if (pitchPixels !== 0) {
      pitchByParallelVerticalMotion(pov, pitchPixels);
    }

    // 3. Rotate
    if (twistDelta !== 0) {
      rotateByTwist(pov, twistDelta);
    }

    // 4. Centroid pan (ground-anchored)
    if (gesture.lastMidpoint) {
      const groundPrev = screenPointToGround(camera, gesture.lastMidpoint.x, gesture.lastMidpoint.y, rect);
      const groundCurr = screenPointToGround(camera, mid.x, mid.y, rect);
      if (groundPrev && groundCurr) {
        panByGroundPoints(pov, groundPrev, groundCurr);
      }
    }

    clampPovState(pov);

    // 5. Anchor correction — compute where centroid lands under the new target state
    const tempCamera = buildTempCamera(pov, camera);
    const anchorAfter = screenPointToGround(tempCamera, mid.x, mid.y, rect);
    applyAnchorCorrection(pov, anchorBefore, anchorAfter);
    clampPovState(pov);

    // ── Update gesture history ──
    gesture.lastTouch0 = t0;
    gesture.lastTouch1 = t1;
    gesture.lastMidpoint = mid;
    gesture.lastPinchDistance = dist;
    gesture.lastTwistAngle = angle;
    gesture.lastAnchorWorld = anchorBefore;
  }
}

export function handleTouchEnd(
  gesture: TouchGestureState,
  e: TouchEvent,
  camera: THREE.PerspectiveCamera,
  rect: ViewportRect,
): void {
  if (e.touches.length === 0) {
    gesture.mode = 'none';
    gesture.lastSingle = undefined;
    gesture.lastTouch0 = undefined;
    gesture.lastTouch1 = undefined;
    gesture.lastMidpoint = undefined;
    gesture.lastPinchDistance = undefined;
    gesture.lastTwistAngle = undefined;
    gesture.lastAnchorWorld = null;
  } else if (e.touches.length === 1) {
    // Transition from two-touch back to single-finger pan
    gesture.mode = 'pan1';
    const pt: ScreenPoint = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    gesture.lastSingle = pt;
    gesture.lastTouch0 = undefined;
    gesture.lastTouch1 = undefined;
    gesture.lastMidpoint = undefined;
    gesture.lastPinchDistance = undefined;
    gesture.lastTwistAngle = undefined;
    gesture.lastAnchorWorld = screenPointToGround(camera, pt.x, pt.y, rect);
  }
}

// ── Desktop pointer handlers ───────────────────────────────────────────────────

/**
 * Ground-anchored pointer pan (left mouse drag).
 */
export function handlePointerPan(
  pov: PovCameraState,
  camera: THREE.PerspectiveCamera,
  rect: ViewportRect,
  prevX: number,
  prevY: number,
  currX: number,
  currY: number,
): void {
  const groundPrev = screenPointToGround(camera, prevX, prevY, rect);
  const groundCurr = screenPointToGround(camera, currX, currY, rect);
  if (groundPrev && groundCurr) {
    panByGroundPoints(pov, groundPrev, groundCurr);
    clampPovState(pov);
  }
}

/**
 * Desktop rotate + pitch (right mouse drag or Alt+left drag).
 */
export function handlePointerRotatePitch(
  pov: PovCameraState,
  dx: number,
  dy: number,
): void {
  pov.targetYaw += dx * DESKTOP_ROTATE_SENSITIVITY;
  pov.targetPitch -= dy * DESKTOP_PITCH_SENSITIVITY;
  clampPovState(pov);
}

/**
 * Wheel zoom with cursor-anchor correction.
 */
export function handleWheel(
  pov: PovCameraState,
  camera: THREE.PerspectiveCamera,
  rect: ViewportRect,
  clientX: number,
  clientY: number,
  deltaY: number,
): void {
  // anchorBefore under cursor
  const anchorBefore = screenPointToGround(camera, clientX, clientY, rect);

  // Apply zoom
  const factor = deltaY > 0 ? 1.08 : 0.93;
  pov.targetDistance *= factor;
  pov.targetDistance = clamp(pov.targetDistance, MIN_DISTANCE, MAX_DISTANCE);
  clampPovState(pov);

  // Anchor correction
  const tempCamera = buildTempCamera(pov, camera);
  const anchorAfter = screenPointToGround(tempCamera, clientX, clientY, rect);
  applyAnchorCorrection(pov, anchorBefore, anchorAfter);
  clampPovState(pov);
}
