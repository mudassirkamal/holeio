import { POWER_UPS, type PowerUpKind } from "../config/powerUps";

const SIZE = 128;
const badges = new Map<PowerUpKind, HTMLCanvasElement>();

type Glyph = (ctx: CanvasRenderingContext2D) => void;

const polygon = (ctx: CanvasRenderingContext2D, points: number[]) => {
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
  ctx.closePath();
  ctx.fill();
};

// Vector glyphs (not emoji) so the badge looks the same on every device.
const GLYPHS: Record<PowerUpKind, Glyph> = {
  turbo: (ctx) => polygon(ctx, [72, 16, 34, 70, 60, 70, 52, 112, 94, 54, 68, 54, 80, 16]),
  magnet: (ctx) => {
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.moveTo(38, 26);
    ctx.lineTo(38, 58);
    ctx.arc(64, 58, 26, Math.PI, 0, true);
    ctx.lineTo(90, 26);
    ctx.stroke();
    ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
    ctx.fillRect(27, 24, 22, 14);
    ctx.fillRect(79, 24, 22, 14);
  },
  shield: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(64, 16);
    ctx.lineTo(102, 30);
    ctx.lineTo(100, 62);
    ctx.quadraticCurveTo(96, 94, 64, 112);
    ctx.quadraticCurveTo(32, 94, 28, 62);
    ctx.lineTo(26, 30);
    ctx.closePath();
    ctx.fill();
  },
  giant: (ctx) => polygon(ctx, [64, 14, 104, 58, 79, 58, 79, 110, 49, 110, 49, 58, 24, 58]),
};

/** Round icon for a power-up (world pickups and the minimap), drawn once per kind. */
export function powerUpBadge(kind: PowerUpKind): HTMLCanvasElement {
  const cached = badges.get(kind);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  const color = POWER_UPS[kind].color;

  const fill = ctx.createRadialGradient(48, 40, 8, 64, 64, 60);
  fill.addColorStop(0, "#ffffff");
  fill.addColorStop(0.35, color);
  fill.addColorStop(1, color);
  ctx.beginPath();
  ctx.arc(64, 64, 56, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();

  ctx.save();
  ctx.translate(64, 64);
  ctx.scale(0.72, 0.72);
  ctx.translate(-64, -64);
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = ctx.strokeStyle = "#ffffff";
  GLYPHS[kind](ctx);
  ctx.restore();

  badges.set(kind, canvas);
  return canvas;
}
