export interface JoystickState {
  active: boolean;
  baseX: number;
  baseY: number;
  knobX: number;
  knobY: number;
}

const KEY_DIRS: Record<string, [number, number]> = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

const JOYSTICK_RADIUS = 64;

/**
 * Player steering from mouse (hole follows the cursor), keyboard (WASD / arrows)
 * or touch (floating joystick wherever the thumb lands). Screen right maps to +X
 * and screen down to +Z, matching the camera orientation.
 */
export class HumanInput {
  readonly joystick: JoystickState = { active: false, baseX: 0, baseY: 0, knobX: 0, knobY: 0 };
  private readonly keys = new Set<string>();
  private mouse: { x: number; y: number } | null = null;
  private touchId: number | null = null;
  private originX = 0;
  private originY = 0;

  constructor(private readonly element: HTMLElement) {
    element.addEventListener("pointermove", this.onPointerMove);
    element.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
    element.addEventListener("pointerleave", this.onPointerLeave);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
  }

  /** Screen position of the player's hole, used as the mouse steering origin. */
  setOrigin(x: number, y: number) {
    this.originX = x;
    this.originY = y;
  }

  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === "mouse") {
      const rect = this.element.getBoundingClientRect();
      this.mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    } else if (e.pointerId === this.touchId) {
      const dx = e.clientX - this.joystick.baseX;
      const dy = e.clientY - this.joystick.baseY;
      const d = Math.hypot(dx, dy);
      const k = d > JOYSTICK_RADIUS ? JOYSTICK_RADIUS / d : 1;
      this.joystick.knobX = this.joystick.baseX + dx * k;
      this.joystick.knobY = this.joystick.baseY + dy * k;
    }
  };

  private onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse" || this.touchId !== null) return;
    this.touchId = e.pointerId;
    Object.assign(this.joystick, { active: true, baseX: e.clientX, baseY: e.clientY, knobX: e.clientX, knobY: e.clientY });
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerId !== this.touchId) return;
    this.touchId = null;
    this.joystick.active = false;
  };

  private onPointerLeave = (e: PointerEvent) => {
    if (e.pointerType === "mouse") this.mouse = null;
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (KEY_DIRS[e.code]) {
      this.keys.add(e.code);
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);

  private onBlur = () => {
    this.keys.clear();
    this.touchId = null;
    this.joystick.active = false;
  };

  read(): { x: number; z: number; throttle: number } {
    let kx = 0;
    let kz = 0;
    for (const code of this.keys) {
      kx += KEY_DIRS[code][0];
      kz += KEY_DIRS[code][1];
    }
    if (kx !== 0 || kz !== 0) return { x: kx, z: kz, throttle: 1 };

    if (this.joystick.active) {
      const dx = this.joystick.knobX - this.joystick.baseX;
      const dy = this.joystick.knobY - this.joystick.baseY;
      const d = Math.hypot(dx, dy);
      if (d < 6) return { x: 0, z: 0, throttle: 0 };
      return { x: dx, z: dy, throttle: Math.min(1, d / (JOYSTICK_RADIUS * 0.7)) };
    }

    if (this.mouse) {
      const dx = this.mouse.x - this.originX;
      const dy = this.mouse.y - this.originY;
      const d = Math.hypot(dx, dy);
      const rect = this.element.getBoundingClientRect();
      const full = Math.min(rect.width, rect.height) * 0.22;
      if (d < 12) return { x: 0, z: 0, throttle: 0 };
      return { x: dx, z: dy, throttle: Math.min(1, d / full) };
    }
    return { x: 0, z: 0, throttle: 0 };
  }

  dispose() {
    this.element.removeEventListener("pointermove", this.onPointerMove);
    this.element.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerUp);
    this.element.removeEventListener("pointerleave", this.onPointerLeave);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
  }
}
