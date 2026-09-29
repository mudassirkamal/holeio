import { MathUtils, PerspectiveCamera, Vector3 } from "three";
import { damp } from "../core/math";

/**
 * Tilted follow camera that zooms out as the hole grows, leads slightly in the
 * direction of travel and supports short screen shakes.
 */
export class CameraRig {
  readonly camera: PerspectiveCamera;
  readonly target = new Vector3();
  private distance = 40;
  private shake = 0;
  private readonly pitch = MathUtils.degToRad(56);
  private orbit = 0;
  private viewWidth = 1;
  private viewHeight = 1;
  private shiftX = 0;
  private shiftY = 0;
  private shiftTargetX = 0;
  private shiftTargetY = 0;

  constructor(aspect: number) {
    // A narrow field of view keeps the near-isometric look with little edge distortion.
    this.camera = new PerspectiveCamera(32, aspect, 1, 5000);
  }

  setViewport(width: number, height: number) {
    this.viewWidth = Math.max(1, width);
    this.viewHeight = Math.max(1, height);
    this.camera.aspect = this.viewWidth / this.viewHeight;
    this.applyShift();
  }

  /**
   * Moves the followed point on screen, as fractions of the width and height
   * (x 0.25 puts it at 75% across, y -0.2 at 30% down) — keeps it clear of menus.
   */
  setScreenShift(x: number, y = 0) {
    this.shiftTargetX = x;
    this.shiftTargetY = y;
  }

  private applyShift() {
    if (Math.abs(this.shiftX) < 1e-3 && Math.abs(this.shiftY) < 1e-3) this.camera.clearViewOffset();
    else this.camera.setViewOffset(this.viewWidth, this.viewHeight, -this.shiftX * this.viewWidth, -this.shiftY * this.viewHeight, this.viewWidth, this.viewHeight);
    this.camera.updateProjectionMatrix();
  }

  addShake(amount: number) {
    this.shake = Math.min(1.5, this.shake + amount);
  }

  /**
   * Desired camera distance for a hole of `radius`. Portrait screens pull back further
   * so phones still see threats coming from the sides.
   */
  static distanceFor(radius: number, aspect: number) {
    const portrait = aspect < 1 ? 1 / aspect : 1;
    return (36 + radius * 7.6) * Math.min(2.1, 1.1 + (portrait - 1) * 0.72);
  }

  snap(x: number, z: number, radius: number) {
    this.target.set(x, 0, z);
    this.distance = CameraRig.distanceFor(radius, this.camera.aspect);
    this.apply();
  }

  update(dt: number, x: number, z: number, vx: number, vz: number, radius: number, orbitSpeed = 0, zoom = 1) {
    const lead = 0.35;
    this.target.x = damp(this.target.x, x + vx * lead, 6, dt);
    this.target.z = damp(this.target.z, z + vz * lead, 6, dt);
    this.distance = damp(this.distance, CameraRig.distanceFor(radius, this.camera.aspect) * zoom, 2.2, dt);
    this.orbit += orbitSpeed * dt;
    this.shake = Math.max(0, this.shake - dt * 2.5);
    if (this.shiftX !== this.shiftTargetX || this.shiftY !== this.shiftTargetY) {
      const ease = (value: number, target: number) => (Math.abs(target - value) < 1e-3 ? target : damp(value, target, 6, dt));
      this.shiftX = ease(this.shiftX, this.shiftTargetX);
      this.shiftY = ease(this.shiftY, this.shiftTargetY);
      this.applyShift();
    }
    this.apply();
  }

  private apply() {
    const horizontal = Math.cos(this.pitch) * this.distance;
    const height = Math.sin(this.pitch) * this.distance;
    const shakeX = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    const shakeZ = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    this.camera.position.set(
      this.target.x + Math.sin(this.orbit) * horizontal + shakeX,
      height,
      this.target.z + Math.cos(this.orbit) * horizontal + shakeZ,
    );
    this.camera.lookAt(this.target.x + shakeX * 0.5, 0, this.target.z + shakeZ * 0.5);
  }

  /** Radius of ground the camera roughly covers (for shadows/weather). */
  get viewRadius() {
    return this.distance * 0.75;
  }
}
