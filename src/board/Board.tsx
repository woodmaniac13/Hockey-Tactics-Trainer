import React, { useRef, useEffect, useState } from 'react';
import type { Scenario, Point, TacticalRegionGeometry, OutcomePreview, ArrowStyle } from '../types';
import { resolveRegionGeometry } from '../utils/regions';

interface BoardProps {
  scenario: Scenario;
  playerPosition: Point;
  onPositionChange: (pos: Point) => void;
  submitted: boolean;
  showOverlays: boolean;
  /** When submitted, which view to show: evaluation zones or consequence overlay. */
  boardViewMode?: 'evaluation' | 'consequence';
  /** Authored consequence to render when boardViewMode === 'consequence'. */
  consequenceOverlay?: OutcomePreview | null;
}

const FIELD_WIDTH_M = 91.4;
const FIELD_HEIGHT_M = 55;
const ASPECT_RATIO = FIELD_WIDTH_M / FIELD_HEIGHT_M;

function toCanvas(normalizedPos: Point, canvasWidth: number, canvasHeight: number): { cx: number; cy: number } {
  return {
    cx: (normalizedPos.x / 100) * canvasWidth,
    cy: (normalizedPos.y / 100) * canvasHeight,
  };
}

function fromCanvas(cx: number, cy: number, canvasWidth: number, canvasHeight: number): Point {
  return {
    x: Math.max(0, Math.min(100, (cx / canvasWidth) * 100)),
    y: Math.max(0, Math.min(100, (cy / canvasHeight) * 100)),
  };
}

/** Draw a resolved pitch-space geometry on the canvas (stroke only). */
function drawGeometry(
  ctx: CanvasRenderingContext2D,
  geo: TacticalRegionGeometry,
  width: number,
  height: number,
): void {
  const scale = Math.min(width, height);

  if (geo.type === 'rectangle' && geo.rotation) {
    const rx = (geo.x / 100) * width;
    const ry = (geo.y / 100) * height;
    const rw = (geo.width / 100) * width;
    const rh = (geo.height / 100) * height;
    const cx = rx + rw / 2;
    const cy = ry + rh / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(geo.rotation);
    ctx.beginPath();
    ctx.rect(-rw / 2, -rh / 2, rw, rh);
    ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.beginPath();

  if (geo.type === 'circle') {
    const { cx, cy } = toCanvas({ x: geo.x, y: geo.y }, width, height);
    const r = (geo.r / 100) * scale;
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
  } else if (geo.type === 'rectangle') {
    const rx = (geo.x / 100) * width;
    const ry = (geo.y / 100) * height;
    const rw = (geo.width / 100) * width;
    const rh = (geo.height / 100) * height;
    ctx.rect(rx, ry, rw, rh);
  } else if (geo.type === 'polygon') {
    const [first, ...rest] = geo.vertices;
    if (!first) return;
    const { cx: fx, cy: fy } = toCanvas(first, width, height);
    ctx.moveTo(fx, fy);
    for (const v of rest) {
      const { cx: vx, cy: vy } = toCanvas(v, width, height);
      ctx.lineTo(vx, vy);
    }
    ctx.closePath();
  } else if (geo.type === 'lane') {
    const { cx: x1c, cy: y1c } = toCanvas({ x: geo.x1, y: geo.y1 }, width, height);
    const { cx: x2c, cy: y2c } = toCanvas({ x: geo.x2, y: geo.y2 }, width, height);
    const halfW = (geo.width / 100) * scale / 2;
    const dx = x2c - x1c;
    const dy = y2c - y1c;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;
    const px = (-dy / len) * halfW;
    const py = (dx / len) * halfW;
    ctx.moveTo(x1c + px, y1c + py);
    ctx.lineTo(x2c + px, y2c + py);
    ctx.lineTo(x2c - px, y2c - py);
    ctx.lineTo(x1c - px, y1c - py);
    ctx.closePath();
  }
  ctx.stroke();
}

/** Build the geometry path in the canvas context without stroking or filling. */
function buildGeometryPath(
  ctx: CanvasRenderingContext2D,
  geo: TacticalRegionGeometry,
  width: number,
  height: number,
): void {
  const scale = Math.min(width, height);
  ctx.beginPath();
  if (geo.type === 'circle') {
    const { cx, cy } = toCanvas({ x: geo.x, y: geo.y }, width, height);
    const r = (geo.r / 100) * scale;
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
  } else if (geo.type === 'rectangle') {
    const rx = (geo.x / 100) * width;
    const ry = (geo.y / 100) * height;
    const rw = (geo.width / 100) * width;
    const rh = (geo.height / 100) * height;
    if (geo.rotation) {
      const cx = rx + rw / 2;
      const cy = ry + rh / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(geo.rotation);
      ctx.rect(-rw / 2, -rh / 2, rw, rh);
      ctx.restore();
      return;
    }
    ctx.rect(rx, ry, rw, rh);
  } else if (geo.type === 'polygon') {
    const [first, ...rest] = geo.vertices;
    if (!first) return;
    const { cx: fx, cy: fy } = toCanvas(first, width, height);
    ctx.moveTo(fx, fy);
    for (const v of rest) {
      const { cx: vx, cy: vy } = toCanvas(v, width, height);
      ctx.lineTo(vx, vy);
    }
    ctx.closePath();
  } else if (geo.type === 'lane') {
    const { cx: x1c, cy: y1c } = toCanvas({ x: geo.x1, y: geo.y1 }, width, height);
    const { cx: x2c, cy: y2c } = toCanvas({ x: geo.x2, y: geo.y2 }, width, height);
    const halfW = (geo.width / 100) * Math.min(width, height) / 2;
    const dx = x2c - x1c;
    const dy = y2c - y1c;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;
    const px = (-dy / len) * halfW;
    const py = (dx / len) * halfW;
    ctx.moveTo(x1c + px, y1c + py);
    ctx.lineTo(x2c + px, y2c + py);
    ctx.lineTo(x2c - px, y2c - py);
    ctx.lineTo(x1c - px, y1c - py);
    ctx.closePath();
  }
}

/** Fill a lane-highlight geometry with a semi-transparent color. */
function drawLaneHighlight(
  ctx: CanvasRenderingContext2D,
  geo: TacticalRegionGeometry,
  state: 'open' | 'blocked',
  width: number,
  height: number,
): void {
  ctx.save();
  ctx.fillStyle = state === 'open' ? 'rgba(46, 204, 113, 0.25)' : 'rgba(231, 76, 60, 0.25)';
  ctx.strokeStyle = state === 'open' ? 'rgba(46, 204, 113, 0.55)' : 'rgba(231, 76, 60, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  buildGeometryPath(ctx, geo, width, height);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Draw a consequence arrow on the board with field-hockey visual conventions. */
function drawArrow(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  style: ArrowStyle,
  width: number,
  height: number,
): void {
  const { cx: x1, cy: y1 } = toCanvas(from, width, height);
  const { cx: x2, cy: y2 } = toCanvas(to, width, height);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 4) return;

  const headLen = Math.min(12, len * 0.35);
  const headAngle = Math.PI / 6;
  const angle = Math.atan2(dy, dx);

  ctx.save();

  switch (style) {
    case 'pass':
      ctx.strokeStyle = 'rgba(255, 220, 50, 0.92)';
      ctx.fillStyle = 'rgba(255, 220, 50, 0.92)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([]);
      break;
    case 'run':
      ctx.strokeStyle = 'rgba(100, 185, 255, 0.9)';
      ctx.fillStyle = 'rgba(100, 185, 255, 0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      break;
    case 'pressure':
      ctx.strokeStyle = 'rgba(231, 76, 60, 0.92)';
      ctx.fillStyle = 'rgba(231, 76, 60, 0.92)';
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      break;
    case 'cover_shift':
      ctx.strokeStyle = 'rgba(46, 204, 113, 0.9)';
      ctx.fillStyle = 'rgba(46, 204, 113, 0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      break;
  }

  // Shorten the line slightly so it ends just before the arrowhead tip
  const shortenBy = headLen * 0.75;
  const endX = x2 - (dx / len) * shortenBy;
  const endY = y2 - (dy / len) * shortenBy;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.setLineDash([]);

  if (style === 'run') {
    // Open arrowhead for run arrows
    ctx.beginPath();
    ctx.moveTo(x2 - headLen * Math.cos(angle - headAngle), y2 - headLen * Math.sin(angle - headAngle));
    ctx.lineTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle + headAngle), y2 - headLen * Math.sin(angle + headAngle));
    ctx.stroke();
  } else {
    // Filled arrowhead for pass/pressure/cover_shift
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - headAngle), y2 - headLen * Math.sin(angle - headAngle));
    ctx.lineTo(x2 - headLen * Math.cos(angle + headAngle), y2 - headLen * Math.sin(angle + headAngle));
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

/** Draw a pass-option lane between two pitch-space points as a thin colored strip. */
function drawPassOptionLane(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  state: 'open' | 'blocked' | 'risky',
  width: number,
  height: number,
): void {
  const { cx: x1, cy: y1 } = toCanvas(from, width, height);
  const { cx: x2, cy: y2 } = toCanvas(to, width, height);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 4) return;

  const halfW = 4; // strip half-width in canvas pixels
  const px = (-dy / len) * halfW;
  const py = (dx / len) * halfW;

  let fillColor: string;
  switch (state) {
    case 'open': fillColor = 'rgba(46, 204, 113, 0.22)'; break;
    case 'blocked': fillColor = 'rgba(231, 76, 60, 0.22)'; break;
    case 'risky': fillColor = 'rgba(230, 126, 34, 0.22)'; break;
  }

  ctx.save();
  ctx.fillStyle = fillColor;
  ctx.beginPath();
  ctx.moveTo(x1 + px, y1 + py);
  ctx.lineTo(x2 + px, y2 + py);
  ctx.lineTo(x2 - px, y2 - py);
  ctx.lineTo(x1 - px, y1 - py);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Draw a ghost circle (future entity position) with a dashed run arrow from current to target. */
function drawEntityShift(
  ctx: CanvasRenderingContext2D,
  current: Point,
  target: Point,
  isTeammate: boolean,
  width: number,
  height: number,
): void {
  const { cx: tx, cy: ty } = toCanvas(target, width, height);

  // Draw dashed run arrow first (behind ghost circle)
  drawArrow(ctx, current, target, 'run', width, height);

  // Ghost circle at target position
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = isTeammate ? '#2980b9' : '#e74c3c';
  ctx.beginPath();
  ctx.arc(tx, ty, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.7;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/** Draw a small text badge on the board (suppressed on small canvases). */
function drawShapeLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  cx: number,
  cy: number,
  canvasWidth: number,
): void {
  if (canvasWidth < 400) return;

  ctx.save();
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const textW = ctx.measureText(label).width;
  const padding = 5;
  const bw = textW + padding * 2;
  const bh = 16;

  // Badge background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.beginPath();
  ctx.rect(cx - bw / 2, cy - bh / 2, bw, bh);
  ctx.fill();

  // Badge text
  ctx.fillStyle = '#e0e0e0';
  ctx.fillText(label, cx, cy);
  ctx.restore();
}

/**
 * Map a ConsequenceType to a short human-readable label for shape badges.
 * Returns undefined for types that don't warrant a board label.
 */
function shapeResultLabel(
  shapeResult: NonNullable<OutcomePreview['shape_result']>,
): string {
  switch (shapeResult) {
    case 'triangle_formed': return '△ triangle formed';
    case 'line_restored': return '— line restored';
    case 'overloaded': return '⊕ zone overloaded';
    case 'exposed': return '⚠ shape exposed';
  }
}

export default function Board({
  scenario,
  playerPosition,
  onPositionChange,
  submitted,
  showOverlays,
  boardViewMode = 'evaluation',
  consequenceOverlay,
}: BoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 360 });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = Math.round(w / ASPECT_RATIO);
      setDimensions({ width: w, height: h });
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = dimensions;

    ctx.clearRect(0, 0, width, height);

    // Pitch background
    ctx.fillStyle = '#2d7a2d';
    ctx.fillRect(0, 0, width, height);

    // Grid lines (subtle)
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 10; i < 100; i += 10) {
      const x = (i / 100) * width;
      const y = (i / 100) * height;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    // Pitch lines
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, width - 4, height - 4);

    // Center line
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();

    // Center circle
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, (9 / 100) * height, 0, Math.PI * 2);
    ctx.stroke();

    // Shooting circles (approximate)
    const circleRadius = (14.63 / FIELD_WIDTH_M) * width;
    ctx.beginPath();
    ctx.arc(0, height / 2, circleRadius, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(width, height / 2, circleRadius, Math.PI / 2, -Math.PI / 2);
    ctx.stroke();

    // ── Build entity lookup map for consequence rendering ─────────────────
    const entityPositions = new Map<string, Point>();
    for (const e of [...scenario.teammates, ...scenario.opponents]) {
      entityPositions.set(e.id, { x: e.x, y: e.y });
    }
    entityPositions.set('ball', scenario.ball);
    // Target player's current (dragged) position
    entityPositions.set(scenario.target_player, playerPosition);

    const teammateIds = new Set(scenario.teammates.map(t => t.id));

    // ── Overlays (submitted) ──────────────────────────────────────────────
    if (submitted && showOverlays) {
      const activeConsequence =
        boardViewMode === 'consequence' && consequenceOverlay ? consequenceOverlay : null;

      if (activeConsequence) {
        // ── CONSEQUENCE VIEW ──────────────────────────────────────────────

        // 1. Pass-option lane fills (behind entities)
        if (activeConsequence.pass_option_states) {
          for (const pos of activeConsequence.pass_option_states) {
            const fromPt = entityPositions.get(pos.from_entity_id);
            const toPt = entityPositions.get(pos.to_entity_id);
            if (fromPt && toPt) {
              drawPassOptionLane(ctx, fromPt, toPt, pos.state, width, height);
            }
          }
        }

        // 2. Lane highlight fill (behind entities)
        if (activeConsequence.lane_highlight) {
          drawLaneHighlight(
            ctx,
            activeConsequence.lane_highlight.geometry,
            activeConsequence.lane_highlight.state,
            width,
            height,
          );
        }
      } else {
        // ── EVALUATION VIEW ───────────────────────────────────────────────

        // Acceptable regions (yellow dashed)
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(255, 220, 50, 0.7)';
        ctx.lineWidth = 2;
        for (const region of scenario.acceptable_regions) {
          const geo = resolveRegionGeometry(region, scenario);
          if (geo) drawGeometry(ctx, geo, width, height);
        }

        // Ideal regions (green dashed)
        ctx.strokeStyle = 'rgba(100, 255, 100, 0.9)';
        for (const region of scenario.ideal_regions) {
          const geo = resolveRegionGeometry(region, scenario);
          if (geo) drawGeometry(ctx, geo, width, height);
        }
        ctx.setLineDash([]);

        // Line from ball to player
        const { cx: bx, cy: by } = toCanvas(scenario.ball, width, height);
        const { cx: px, cy: py } = toCanvas(playerPosition, width, height);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(px, py);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // ── Opponents (red) ───────────────────────────────────────────────────
    for (const opp of scenario.opponents) {
      const { cx, cy } = toCanvas({ x: opp.x, y: opp.y }, width, height);
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.max(9, Math.round(height / 36))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(opp.role.substring(0, 2).toUpperCase(), cx, cy);
    }

    // ── Teammates (blue) ──────────────────────────────────────────────────
    for (const tm of scenario.teammates) {
      if (tm.id === scenario.target_player) continue;
      const { cx, cy } = toCanvas({ x: tm.x, y: tm.y }, width, height);
      ctx.fillStyle = '#2980b9';
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.max(9, Math.round(height / 36))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tm.role.substring(0, 2).toUpperCase(), cx, cy);
    }

    // ── Ball (yellow) ─────────────────────────────────────────────────────
    const { cx: bxFinal, cy: byFinal } = toCanvas(scenario.ball, width, height);
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(bxFinal, byFinal, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ── Target player (highlighted blue with ring) ────────────────────────
    const { cx: ppx, cy: ppy } = toCanvas(playerPosition, width, height);
    ctx.fillStyle = '#3498db';
    ctx.beginPath();
    ctx.arc(ppx, ppy, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();
    if (!submitted) {
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(ppx, ppy, 24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const targetTm = scenario.teammates.find(t => t.id === scenario.target_player);
    const label = targetTm ? targetTm.role.substring(0, 2).toUpperCase() : 'TP';
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.max(9, Math.round(height / 36))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, ppx, ppy);

    // ── Consequence overlay layers drawn on top of entities ───────────────
    if (submitted && showOverlays && boardViewMode === 'consequence' && consequenceOverlay) {
      const overlay = consequenceOverlay;

      // 3. Consequence arrows (on top of entities)
      if (overlay.arrows) {
        const visibleArrows = overlay.arrows.slice(0, 3);
        for (const arrow of visibleArrows) {
          const fromPt = arrow.from_entity_id
            ? entityPositions.get(arrow.from_entity_id)
            : arrow.from_point;
          const toPt = arrow.to_entity_id
            ? entityPositions.get(arrow.to_entity_id)
            : arrow.to_point;
          if (fromPt && toPt) {
            drawArrow(ctx, fromPt, toPt, arrow.style, width, height);
          }
        }
      }

      // 4. Entity shift ghosts (on top of arrows)
      if (overlay.entity_shifts) {
        const visibleShifts = overlay.entity_shifts.slice(0, 2);
        for (const shift of visibleShifts) {
          const current = entityPositions.get(shift.entity_id);
          if (current) {
            drawEntityShift(
              ctx,
              current,
              { x: shift.to_x, y: shift.to_y },
              teammateIds.has(shift.entity_id),
              width,
              height,
            );
          }
        }
      }

      // 5. Shape label badge (topmost layer)
      if (overlay.shape_result) {
        // Position badge near the centroid of entity shifts, or near ball if no shifts
        let labelX = bxFinal;
        let labelY = byFinal - 26;
        if (overlay.entity_shifts && overlay.entity_shifts.length > 0) {
          const shiftTargets = overlay.entity_shifts.slice(0, 2);
          const avgX = shiftTargets.reduce((s, sh) => s + sh.to_x, 0) / shiftTargets.length;
          const avgY = shiftTargets.reduce((s, sh) => s + sh.to_y, 0) / shiftTargets.length;
          const pt = toCanvas({ x: avgX, y: avgY }, width, height);
          labelX = pt.cx;
          labelY = pt.cy - 24;
        }
        drawShapeLabel(ctx, shapeResultLabel(overlay.shape_result), labelX, labelY, width);
      }
    }
  }, [dimensions, scenario, playerPosition, submitted, showOverlays, boardViewMode, consequenceOverlay]);

  const getCanvasPos = (e: React.MouseEvent | React.TouchEvent): { cx: number; cy: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      cx: clientX - rect.left,
      cy: clientY - rect.top,
    };
  };

  const isNearPlayer = (cx: number, cy: number): boolean => {
    const { cx: ppx, cy: ppy } = toCanvas(playerPosition, dimensions.width, dimensions.height);
    const d = Math.sqrt((cx - ppx) ** 2 + (cy - ppy) ** 2);
    const hitRadius = 'ontouchstart' in window ? 44 : 30;
    return d < hitRadius;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (submitted) return;
    const pos = getCanvasPos(e);
    if (!pos) return;
    if (isNearPlayer(pos.cx, pos.cy)) setDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || submitted) return;
    const pos = getCanvasPos(e);
    if (!pos) return;
    onPositionChange(fromCanvas(pos.cx, pos.cy, dimensions.width, dimensions.height));
  };

  const handleMouseUp = () => setDragging(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (submitted) return;
    const pos = getCanvasPos(e);
    if (!pos) return;
    if (isNearPlayer(pos.cx, pos.cy)) {
      e.preventDefault();
      setDragging(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragging || submitted) return;
    e.preventDefault();
    const pos = getCanvasPos(e);
    if (!pos) return;
    onPositionChange(fromCanvas(pos.cx, pos.cy, dimensions.width, dimensions.height));
  };

  const handleTouchEnd = () => setDragging(false);

  return (
    <div ref={containerRef} style={{ width: '100%', touchAction: 'none' }}>
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{ display: 'block', width: '100%', cursor: submitted ? 'default' : (dragging ? 'grabbing' : 'grab') }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
    </div>
  );
}
