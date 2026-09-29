export type Mobility = "static" | "car" | "walker";

interface KindSpec {
  /** Footprint along local X (meters). */
  width: number;
  /** Footprint along local Z (meters). */
  depth: number;
  height: number;
  /** Points awarded when swallowed. */
  value: number;
  mobility?: Mobility;
  /** Override for the minimum hole radius needed to swallow this object. */
  requiredRadius?: number;
}

const SPECS = {
  // Street furniture
  cone: { width: 0.5, depth: 0.5, height: 0.75, value: 1 },
  hydrant: { width: 0.45, depth: 0.45, height: 0.85, value: 1 },
  trashCan: { width: 0.65, depth: 0.65, height: 1.05, value: 2 },
  mailbox: { width: 0.55, depth: 0.5, height: 1.25, value: 2 },
  parkingMeter: { width: 0.3, depth: 0.3, height: 1.35, value: 1 },
  lampPost: { width: 0.45, depth: 0.45, height: 5.6, value: 3 },
  trafficLight: { width: 0.5, depth: 0.5, height: 5.2, value: 4 },
  bench: { width: 1.9, depth: 0.7, height: 0.95, value: 3 },
  bicycle: { width: 1.75, depth: 0.5, height: 1.05, value: 3 },
  bush: { width: 1.4, depth: 1.4, height: 1.1, value: 2 },
  flowerPot: { width: 0.9, depth: 0.9, height: 0.9, value: 2 },
  newsStand: { width: 1.1, depth: 0.8, height: 1.5, value: 3 },
  phoneBooth: { width: 1.1, depth: 1.1, height: 2.4, value: 6 },
  person: { width: 0.6, depth: 0.45, height: 1.75, value: 3, mobility: "walker" },
  busStop: { width: 3.8, depth: 1.6, height: 2.7, value: 12 },
  kiosk: { width: 3.2, depth: 3, height: 3.2, value: 18 },
  // Nature
  tree: { width: 3.4, depth: 3.4, height: 6.2, value: 8, requiredRadius: 1.55 },
  pineTree: { width: 3, depth: 3, height: 7.5, value: 8, requiredRadius: 1.55 },
  palmTree: { width: 3.4, depth: 3.4, height: 8.5, value: 9, requiredRadius: 1.6 },
  cactus: { width: 1.3, depth: 1.3, height: 3, value: 4 },
  rock: { width: 2.2, depth: 1.8, height: 1.3, value: 5 },
  snowman: { width: 1.3, depth: 1.3, height: 2.1, value: 5 },
  beachUmbrella: { width: 2.6, depth: 2.6, height: 2.6, value: 4, requiredRadius: 1.2 },
  deckChair: { width: 0.8, depth: 1.9, height: 0.8, value: 2 },
  // Vehicles (local +X is forward)
  car: { width: 4.3, depth: 1.9, height: 1.5, value: 12, mobility: "car" },
  taxi: { width: 4.4, depth: 1.9, height: 1.65, value: 14, mobility: "car" },
  van: { width: 5.2, depth: 2.1, height: 2.3, value: 20, mobility: "car" },
  truck: { width: 8.5, depth: 2.6, height: 3.6, value: 32, mobility: "car" },
  bus: { width: 11, depth: 2.8, height: 3.3, value: 40, mobility: "car" },
  // Structures
  fountain: { width: 5.5, depth: 5.5, height: 2.8, value: 28 },
  statue: { width: 3.2, depth: 3.2, height: 6.5, value: 32 },
  lifeguardTower: { width: 3, depth: 3, height: 5, value: 22 },
  billboard: { width: 8, depth: 1.2, height: 8, value: 45 },
  waterTower: { width: 7, depth: 7, height: 15, value: 110 },
  // Buildings (local +Z is the front door)
  houseSmall: { width: 8, depth: 8, height: 7, value: 55 },
  house: { width: 10, depth: 9, height: 8.5, value: 75 },
  shop: { width: 12, depth: 10, height: 6.5, value: 95 },
  gasStation: { width: 14, depth: 11, height: 6, value: 120 },
  apartment: { width: 14, depth: 13, height: 22, value: 230 },
  office: { width: 15.5, depth: 15.5, height: 36, value: 420 },
  tower: { width: 17, depth: 17, height: 56, value: 720 },
  skyscraper: { width: 21, depth: 21, height: 82, value: 1150 },
} satisfies Record<string, KindSpec>;

export type ObjectKindId = keyof typeof SPECS;

export interface ObjectKind {
  readonly id: ObjectKindId;
  readonly index: number;
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  readonly value: number;
  readonly mobility: Mobility;
  /** Minimum hole radius needed to swallow the object. */
  readonly requiredRadius: number;
  /** Half diagonal of the footprint. */
  readonly footRadius: number;
}

/**
 * Objects can tip into a hole a little wider than themselves, and tall objects need a
 * noticeably bigger hole — this keeps skyscrapers as an end-game reward.
 */
const computeRequiredRadius = ({ width, depth, height }: KindSpec) => {
  const major = Math.max(width, depth);
  const minor = Math.min(width, depth);
  return 0.5 * (major * 0.78 + minor * 0.38) + height * 0.045;
};

export const OBJECT_KINDS: readonly ObjectKind[] = (Object.keys(SPECS) as ObjectKindId[]).map(
  (id, index) => {
    const spec: KindSpec = SPECS[id];
    return {
      id,
      index,
      width: spec.width,
      depth: spec.depth,
      height: spec.height,
      value: spec.value,
      mobility: spec.mobility ?? "static",
      requiredRadius: spec.requiredRadius ?? computeRequiredRadius(spec),
      footRadius: Math.hypot(spec.width, spec.depth) / 2,
    };
  },
);

export const KIND = Object.fromEntries(OBJECT_KINDS.map((k) => [k.id, k])) as Record<
  ObjectKindId,
  ObjectKind
>;

export const MAX_FOOT_RADIUS = Math.max(...OBJECT_KINDS.map((k) => k.footRadius));
