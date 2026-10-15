// Shared motion language (docs/02 "Motion"): long, soft expo-out curves for
// content, quick ones for UI. Keep every animation on these tokens.
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

export const DURATION = {
  ui: 0.25,
  reveal: 0.9,
  hero: 1.1,
  heroImage: 1.6,
} as const;

/** Stagger step between siblings in a revealed group. */
export const STAGGER = 0.08;
