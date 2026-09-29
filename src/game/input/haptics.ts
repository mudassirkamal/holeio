/**
 * Vibration feedback on phones that support it (Android browsers; iOS Safari has no
 * Vibration API). Pulses are rate-limited so a swallowing spree doesn't buzz nonstop.
 */
class Haptics {
  private enabled = true;
  private lastPulse = 0;

  get supported() {
    return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  /** `pattern` is a vibration length in ms, or alternating vibrate/pause lengths. */
  pulse(pattern: number | number[], minGapMs = 90) {
    if (!this.enabled || !this.supported) return;
    const now = performance.now();
    if (now - this.lastPulse < minGapMs) return;
    this.lastPulse = now;
    navigator.vibrate(pattern);
  }
}

export const haptics = new Haptics();
