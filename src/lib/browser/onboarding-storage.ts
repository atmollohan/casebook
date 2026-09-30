export const ONBOARDING_STEP_IDS = ["directory", "data", "reports"] as const;
export type OnboardingStepId = (typeof ONBOARDING_STEP_IDS)[number];

export interface OnboardingState {
  dismissed: boolean;
  done: OnboardingStepId[];
}

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

export const ONBOARDING_STORAGE_KEY = "casebook.onboarding.v1";

const DEFAULT_STATE: OnboardingState = { dismissed: false, done: [] };

function isStepId(value: unknown): value is OnboardingStepId {
  return typeof value === "string" && (ONBOARDING_STEP_IDS as readonly string[]).includes(value);
}

export function normalizeOnboardingState(value: unknown): OnboardingState | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.dismissed !== "undefined" && typeof record.dismissed !== "boolean") return null;
  if (!Array.isArray(record.done)) return null;
  const done = [...new Set(record.done.filter(isStepId))];
  return { dismissed: record.dismissed === true, done };
}

export function loadOnboardingState(storage: StorageLike | null | undefined): OnboardingState {
  if (!storage) return { ...DEFAULT_STATE };
  try {
    const raw = storage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    return normalizeOnboardingState(JSON.parse(raw)) ?? { ...DEFAULT_STATE };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function saveOnboardingState(storage: StorageLike | null | undefined, state: OnboardingState): void {
  if (!storage) return;
  try {
    storage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage may be unavailable (e.g. blocked, quota exceeded, private mode). The
    // guide still works for the session; it just won't persist.
  }
}
