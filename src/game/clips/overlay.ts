import { Vector3, type PerspectiveCamera } from "three";
import { SKIN_BY_ID } from "../config/skins";
import { TEAMS } from "../config/teams";
import type { Hole } from "../core/entities";

export interface OverlayState {
  holes: readonly Hole[];
  camera: PerspectiveCamera;
  playerId: number | null;
  /** Live caption for a highlight moment (e.g. "Ate Viper!"). */
  caption: string | null;
  /** Small line under the logo, usually the site address. */
  watermark: string;
}

const projected = new Vector3();
let displayFont: string | null = null;

/** The page's display font (loaded by next/font under a generated family name). */
const fontFamily = () => (displayFont ??= getComputedStyle(document.documentElement).getPropertyValue("--font-lilita").trim() || "sans-serif");

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
}

/** A name tag like the in-game labels: colored pill with white text. */
function pill(ctx: CanvasRenderingContext2D, text: string, x: number, bottom: number, size: number, color: string, highlight: boolean) {
  ctx.font = `${size}px ${fontFamily()}`;
  const w = ctx.measureText(text).width + size * 1.2;
  const h = size * 1.5;
  roundRect(ctx, x - w / 2, bottom - h, w, h);
  ctx.globalAlpha = 0.82;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineWidth = highlight ? size * 0.22 : size * 0.1;
  ctx.strokeStyle = highlight ? "#ffffff" : "rgba(255,255,255,0.7)";
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, x, bottom - h / 2 + size * 0.05);
}

function outlinedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string) {
  ctx.font = `${size}px ${fontFamily()}`;
  ctx.lineJoin = "round";
  ctx.lineWidth = size * 0.16;
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

/** Draws name tags, the player's size, a caption and the watermark onto a recorded frame. */
export function paintOverlay(ctx: CanvasRenderingContext2D, width: number, height: number, state: OverlayState) {
  const unit = Math.min(width, height) / 540;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  let player: Hole | null = null;
  for (const hole of state.holes) {
    if (hole.id === state.playerId) player = hole;
    if (!hole.alive) continue;
    projected.set(hole.x, 0, hole.z - hole.radius * 1.08).project(state.camera);
    if (projected.z > 1 || Math.abs(projected.x) > 1.1 || Math.abs(projected.y) > 1.1) continue;
    const color = hole.team >= 0 ? TEAMS[hole.team].color : SKIN_BY_ID[hole.skinId].colors[0];
    pill(ctx, hole.name, (projected.x * 0.5 + 0.5) * width, (-projected.y * 0.5 + 0.5) * height, 15 * unit, color, hole.id === state.playerId);
  }

  if (player) {
    ctx.textAlign = "left";
    outlinedText(ctx, `${player.name} · ${Math.round(player.score).toLocaleString()}`, 18 * unit, 26 * unit, 20 * unit, "#ffffff");
    ctx.textAlign = "center";
  }
  if (state.caption) outlinedText(ctx, state.caption, width / 2, height * 0.2, 44 * unit, "#ffe066");

  ctx.textAlign = "right";
  outlinedText(ctx, "HOLE RUSH", width - 18 * unit, height - 38 * unit, 26 * unit, "#ffffff");
  outlinedText(ctx, state.watermark, width - 18 * unit, height - 16 * unit, 12 * unit, "rgba(255,255,255,0.85)");
  ctx.textAlign = "center";
}
