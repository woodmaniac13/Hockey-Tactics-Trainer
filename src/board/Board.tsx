import React, { useRef, useEffect, useState } from 'react';
import type { Scenario, Point, TacticalRegion } from '../types';

interface BoardProps {
  scenario: Scenario;
  playerPosition: Point;
  onPositionChange: (pos: Point) => void;
  submitted: boolean;
  showOverlays: boolean;
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

/** Draw a tactical region on the canvas using its native shape. */
function drawRegion(
  ctx: CanvasRenderingContext2D,
  region: TacticalRegion,
  width: number,
  height: number,
): void {
  const scale = Math.min(width, height);
  ctx.beginPath();

  if (!('type' in region) || region.type === 'circle') {
    const cr = region as { x: number; y: number; r: number };
    const { cx, cy } = toCanvas({ x: cr.x, y: cr.y }, width, height);
    const r = (cr.r / 100) * scale;
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
  } else if (region.type === 'rectangle') {
    const rx = (region.x / 100) * width;
    const ry = (region.y / 100) * height;
    const rw = (region.width / 100) * width;
    const rh = (region.height / 100) * height;
    if (region.rotation) {
      const cx = rx + rw / 2;
      const cy = ry + rh / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(region.rotation);
      ctx.rect(-rw / 2, -rh / 2, rw, rh);
      ctx.restore();
      return;
    }
    ctx.rect(rx, ry, rw, rh);
  } else if (region.type === 'polygon') {
    const [first, ...rest] = region.vertices;
    if (!first) return;
    const { cx: fx, cy: fy } = toCanvas(first, width, height);
    ctx.moveTo(fx, fy);
    for (const v of rest) {
      const { cx: vx, cy: vy } = toCanvas(v, width, height);
      ctx.lineTo(vx, vy);
    }
    ctx.closePath();
  } else if (region.type === 'lane') {
    const { cx: x1c, cy: y1c } = toCanvas({ x: region.x1, y: region.y1 }, width, height);
    const { cx: x2c, cy: y2c } = toCanvas({ x: region.x2, y: region.y2 }, width, height);
    const halfW = (region.width / 100) * scale / 2;
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

export default function Board({ scenario, playerPosition, onPositionChange, submitted, showOverlays }: BoardProps) {
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

    // Overlays (submitted)
    if (submitted && showOverlays) {
      // Acceptable regions (yellow dashed)
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(255, 220, 50, 0.7)';
      ctx.lineWidth = 2;
      for (const region of scenario.acceptable_regions) {
        drawRegion(ctx, region, width, height);
      }

      // Ideal regions (green dashed)
      ctx.strokeStyle = 'rgba(100, 255, 100, 0.9)';
      for (const region of scenario.ideal_regions) {
        drawRegion(ctx, region, width, height);
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

    // Opponents (red)
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

    // Teammates (blue)
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

    // Ball (yellow)
    const { cx: bxFinal, cy: byFinal } = toCanvas(scenario.ball, width, height);
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(bxFinal, byFinal, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Target player (highlighted blue with ring)
    const { cx: ppx, cy: ppy } = toCanvas(playerPosition, width, height);
    ctx.fillStyle = '#3498db';
    ctx.beginPath();
    ctx.arc(ppx, ppy, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();
    // Drag indicator ring
    if (!submitted) {
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(ppx, ppy, 24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Target player label
    const targetTm = scenario.teammates.find(t => t.id === scenario.target_player);
    const label = targetTm ? targetTm.role.substring(0, 2).toUpperCase() : 'TP';
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.max(9, Math.round(height / 36))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, ppx, ppy);
  }, [dimensions, scenario, playerPosition, submitted, showOverlays]);

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
    // Larger hit area for touch devices (44px recommended by Apple HIG)
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
