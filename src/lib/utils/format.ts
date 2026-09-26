export function newId(prefix: string): string {
  return `${prefix}_${globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID().replace(/-/g, "") : Math.random().toString(36).slice(2, 12) + Date.now().toString(36)}`.slice(
    0,
    40,
  );
}

export function now(): number {
  return Date.now();
}

export const MS_MINUTE = 60_000;
export const MS_HOUR = 3_600_000;
export const MS_DAY = 86_400_000;

const BYTES: Array<[number, string]> = [
  [1024 ** 4, "TB"],
  [1024 ** 3, "GB"],
  [1024 ** 2, "MB"],
  [1024, "KB"],
];

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "n/a";
  if (bytes === 0) return "0 B";
  for (const [size, unit] of BYTES) {
    if (bytes >= size) {
      const value = bytes / size;
      return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${unit}`;
    }
  }
  return `${bytes} B`;
}

export function formatDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(ms: number): string {
  const d = new Date(ms);
  return `${formatDate(ms)} · ${d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

export function formatYearYear(birthYear: number | null, today = new Date().getFullYear()): string {
  if (!birthYear) return "Not recorded";
  return `${birthYear} (age ~${Math.max(0, today - birthYear)})`;
}

export function timeAgo(ms: number, nowMs = Date.now()): string {
  const diff = Math.max(0, nowMs - ms);
  if (diff < MS_MINUTE) return "just now";
  if (diff < MS_HOUR) {
    const m = Math.floor(diff / MS_MINUTE);
    return `${m} min ago`;
  }
  if (diff < MS_DAY) {
    const h = Math.floor(diff / MS_HOUR);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  const days = Math.floor(diff / MS_DAY);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export function clampFileExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  if (idx <= 0 || idx === filename.length - 1) return "";
  const ext = filename.slice(idx + 1).toLowerCase();
  return ext.replace(/[^a-z0-9]/g, "").slice(0, 8);
}
