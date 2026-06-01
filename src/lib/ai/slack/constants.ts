/**
 * Personality registers for Pookie. Modeled as an `as const` object + derived
 * type (same pattern as `UserRole`) so we avoid an exported string-union alias.
 */
export const Personality = {
  Cute: "cute",
  Balanced: "balanced",
  Professional: "professional",
} as const;

// eslint-disable-next-line @factory/constants-file-organization, @factory/types-file-organization
export type PersonalityOption = (typeof Personality)[keyof typeof Personality];

export const DEFAULT_PERSONALITY: PersonalityOption = Personality.Balanced;
