/** Seconds of play that count as one "moment" (a chain of kills, big bites, combos). */
const MOMENT_MS = 7000;
/** Footage kept before the first event and after the last one of a moment. */
const PRE_ROLL_MS = 3000;
const POST_ROLL_MS = 2200;
const MAX_CLIP_MS = 12000;
/** Moments below this aren't worth a clip. */
const MIN_SCORE = 400;
/** A new moment must beat the best so far by this factor to replace its clip. */
const BETTER_BY = 1.2;
/** Events at least this big get a live caption burned into the recording. */
const CAPTION_SCORE = 200;

interface MomentEvent {
  atMs: number;
  score: number;
  caption: string | null;
}

export interface Highlight {
  fromMs: number;
  toMs: number;
  caption: string;
}

/**
 * Finds the match's best moment: the densest few seconds of kills, big swallows and
 * combos. When a moment beats the best so far, it is cut once its post-roll has played.
 */
export class HighlightTracker {
  private recent: MomentEvent[] = [];
  private best = 0;
  private pending: (Highlight & { dueMs: number }) | null = null;
  private live: { text: string; untilMs: number } | null = null;

  add(atMs: number, score: number, caption: string | null = null) {
    this.recent = this.recent.filter((e) => atMs - e.atMs < MOMENT_MS);
    this.recent.push({ atMs, score, caption });
    if (caption && score >= CAPTION_SCORE) this.live = { text: caption, untilMs: atMs + 2200 };

    // Small bites add to a moment's score, but only notable events (kills, big buildings,
    // combos) start or extend a clip — otherwise steady eating would postpone it forever.
    const moment = this.recent.reduce((sum, e) => sum + e.score, 0);
    if (!caption || moment < MIN_SCORE || moment <= this.best * BETTER_BY) return;
    this.best = moment;
    const notable = this.recent.filter((e): e is MomentEvent & { caption: string } => e.caption !== null);
    const top = notable.reduce((a, b) => (b.score > a.score ? b : a));
    const dueMs = atMs + POST_ROLL_MS;
    this.pending = {
      fromMs: Math.max(notable[0].atMs - PRE_ROLL_MS, dueMs - MAX_CLIP_MS),
      toMs: dueMs,
      dueMs,
      caption: top.caption,
    };
  }

  /** The best moment, once its post-roll has been recorded (or right away with `force`). */
  takeDue(nowMs: number, force = false): Highlight | null {
    if (!this.pending || (!force && nowMs < this.pending.dueMs)) return null;
    const { fromMs, dueMs, caption } = this.pending;
    this.pending = null;
    return { fromMs, toMs: Math.min(nowMs, dueMs), caption };
  }

  /** The best moment couldn't be saved (e.g. too little footage yet): let later ones qualify. */
  forgetBest() {
    this.best = 0;
  }

  /** Caption to burn into the recording right now. */
  liveCaption(nowMs: number) {
    return this.live && nowMs < this.live.untilMs ? this.live.text : null;
  }
}
