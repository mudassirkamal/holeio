import { Vector3, type PerspectiveCamera } from "three";
import { POWER_UP_KINDS, POWER_UPS } from "../config/powerUps";
import { SKIN_BY_ID } from "../config/skins";
import { TEAMS } from "../config/teams";
import type { Hole } from "../core/entities";

interface Label {
  root: HTMLDivElement;
  name: HTMLSpanElement;
  crown: HTMLSpanElement;
  powers: HTMLSpanElement;
  /** Skin (or team) the label color was last set from. */
  colorKey: string;
  /** Icons of the active power-ups last shown. */
  powersKey: string;
}

const projected = new Vector3();

/** Player names floating above each hole, with a crown for the leader and active power-ups. */
export class LabelLayer {
  private readonly labels = new Map<number, Label>();
  private readonly root: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "pointer-events-none absolute inset-0 overflow-hidden";
    container.appendChild(this.root);
  }

  private create(hole: Hole): Label {
    const root = document.createElement("div");
    root.className = "hole-label";
    const crown = document.createElement("span");
    crown.className = "hole-label-crown";
    crown.textContent = "👑";
    const name = document.createElement("span");
    name.textContent = hole.name;
    const powers = document.createElement("span");
    powers.className = "hole-label-powers";
    root.append(crown, name, powers);
    if (hole.isPlayer) root.classList.add("is-player");
    this.root.appendChild(root);
    const label = { root, name, crown, powers, colorKey: "", powersKey: "" };
    this.labels.set(hole.id, label);
    return label;
  }

  sync(holes: readonly Hole[], visible: (hole: Hole) => boolean, camera: PerspectiveCamera, width: number, height: number, leaderId: number) {
    for (const hole of holes) {
      const label = this.labels.get(hole.id) ?? this.create(hole);
      if (!visible(hole)) {
        label.root.style.opacity = "0";
        continue;
      }
      // Team matches color labels by team so friend and foe are obvious at a glance.
      const colorKey = hole.team >= 0 ? `team${hole.team}` : hole.skinId;
      if (label.colorKey !== colorKey) {
        label.colorKey = colorKey;
        label.root.style.setProperty("--label-color", hole.team >= 0 ? TEAMS[hole.team].color : SKIN_BY_ID[hole.skinId].colors[0]);
      }
      projected.set(hole.x, 0, hole.z - hole.radius * 1.08).project(camera);
      if (projected.z > 1 || projected.x < -1.2 || projected.x > 1.2 || projected.y < -1.2 || projected.y > 1.2) {
        label.root.style.opacity = "0";
        continue;
      }
      const x = (projected.x * 0.5 + 0.5) * width;
      const y = (-projected.y * 0.5 + 0.5) * height;
      label.root.style.opacity = hole.isProtected ? "0.6" : "1";
      label.root.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
      label.crown.style.display = hole.id === leaderId ? "inline" : "none";
      const powersKey = POWER_UP_KINDS.filter((_, i) => hole.powers[i] > 0).map((k) => POWER_UPS[k].icon).join("");
      if (label.powersKey !== powersKey) {
        label.powersKey = powersKey;
        label.powers.textContent = powersKey;
      }
    }
  }

  /** "+12" style popups rising from a point in the world. */
  popup(text: string, x: number, z: number, camera: PerspectiveCamera, width: number, height: number, className = "") {
    projected.set(x, 0, z).project(camera);
    if (projected.z > 1) return;
    const el = document.createElement("div");
    el.className = `score-popup ${className}`;
    el.textContent = text;
    el.style.left = `${(projected.x * 0.5 + 0.5) * width}px`;
    el.style.top = `${(-projected.y * 0.5 + 0.5) * height}px`;
    this.root.appendChild(el);
    window.setTimeout(() => el.remove(), 1100);
  }

  dispose() {
    this.root.remove();
    this.labels.clear();
  }
}
