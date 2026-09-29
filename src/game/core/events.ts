import type { ObjectKindId } from "../config/objectCatalog";
import type { PowerUpKind } from "../config/powerUps";

export type GameEvent =
  | { type: "fallStart"; holeId: number; objectId: number; kindId: ObjectKindId; x: number; z: number }
  | {
      type: "objectEaten";
      holeId: number;
      kindId: ObjectKindId;
      value: number;
      x: number;
      z: number;
      combo: number;
    }
  | { type: "levelUp"; holeId: number; level: number }
  | { type: "holeEaten"; eaterId: number; victimId: number; x: number; z: number; gain: number }
  | { type: "holeRespawned"; holeId: number }
  | { type: "powerUpSpawned"; id: number; kind: PowerUpKind; x: number; z: number }
  | { type: "powerUpTaken"; id: number; holeId: number; kind: PowerUpKind }
  | { type: "powerUpExpired"; id: number }
  | { type: "matchEnd" };
