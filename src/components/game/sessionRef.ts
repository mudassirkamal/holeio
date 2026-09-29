import type { GameSession } from "@/game/engine/GameSession";

/** The currently running session, for widgets that poll it every frame (joystick). */
export const sessionRef: { current: GameSession | null } = { current: null };
