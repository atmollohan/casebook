import { describe, expect, it } from "vitest";
import {
  loadOnboardingState,
  normalizeOnboardingState,
  ONBOARDING_STEP_IDS,
  saveOnboardingState,
  type StorageLike,
} from "@/lib/browser/onboarding-storage";

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key: string, value: string) {
      data[key] = value;
    },
  };
}

describe("normalizeOnboardingState", () => {
  it("accepts a well-formed state", () => {
    expect(normalizeOnboardingState({ dismissed: true, done: ["data", "reports"] })).toEqual({
      dismissed: true,
      done: ["data", "reports"],
    });
  });

  it("rejects non-objects", () => {
    expect(normalizeOnboardingState(null)).toBeNull();
    expect(normalizeOnboardingState("yes")).toBeNull();
    expect(normalizeOnboardingState(42)).toBeNull();
    expect(normalizeOnboardingState(undefined)).toBeNull();
  });

  it("rejects a non-array done field", () => {
    expect(normalizeOnboardingState({ dismissed: false, done: "overview" })).toBeNull();
  });

  it("rejects a non-boolean dismissed field", () => {
    expect(normalizeOnboardingState({ dismissed: "yes", done: [] })).toBeNull();
  });

  it("filters out unknown step ids and dedupes", () => {
    expect(
      normalizeOnboardingState({
        dismissed: false,
        done: ["data", "reports", "not-a-step", "data", 999],
      }),
    ).toEqual({ dismissed: false, done: ["data", "reports"] });
  });
});

describe("loadOnboardingState", () => {
  it("returns the default state when storage is missing", () => {
    expect(loadOnboardingState(null)).toEqual({ dismissed: false, done: [] });
    expect(loadOnboardingState(undefined)).toEqual({ dismissed: false, done: [] });
  });

  it("returns the default state when storage is empty", () => {
    expect(loadOnboardingState(memoryStorage())).toEqual({ dismissed: false, done: [] });
  });

  it("returns the default state when the stored value is malformed JSON", () => {
    const storage = memoryStorage();
    storage.setItem("casebook.onboarding.v1", "{not valid json");
    expect(loadOnboardingState(storage)).toEqual({ dismissed: false, done: [] });
  });

  it("returns the default state when the stored value is an unknown shape", () => {
    const storage = memoryStorage();
    storage.setItem("casebook.onboarding.v1", JSON.stringify({ dismissed: false, done: "all" }));
    expect(loadOnboardingState(storage)).toEqual({ dismissed: false, done: [] });
  });

  it("returns the default state when storage access throws", () => {
    const throwing: StorageLike = {
      getItem() {
        throw new Error("SecurityError: access denied");
      },
      setItem() {
        throw new Error("SecurityError: access denied");
      },
    };
    expect(loadOnboardingState(throwing)).toEqual({ dismissed: false, done: [] });
  });

  it("round-trips a saved state", () => {
    const storage = memoryStorage();
    saveOnboardingState(storage, { dismissed: true, done: ["directory", "data", "reports"] });
    expect(loadOnboardingState(storage)).toEqual({
      dismissed: true,
      done: ["directory", "data", "reports"],
    });
  });

  it("ignores unreadable or throwing storage on save without throwing", () => {
    const throwing: StorageLike = {
      getItem() {
        return null;
      },
      setItem() {
        throw new Error("QuotaExceededError");
      },
    };
    expect(() => saveOnboardingState(throwing, { dismissed: false, done: [] })).not.toThrow();
    expect(() => saveOnboardingState(null, { dismissed: false, done: [] })).not.toThrow();
  });

  it("exposes the full expected step set", () => {
    expect(ONBOARDING_STEP_IDS).toHaveLength(3);
  });
});
