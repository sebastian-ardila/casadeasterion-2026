/** Helpers to extract typed values from FormData. */

export function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export function strReq(fd: FormData, key: string): string {
  const v = str(fd, key);
  if (v === null) throw new Error(`Missing required field: ${key}`);
  return v;
}

export function num(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function tags(fd: FormData, key: string): string[] {
  const v = str(fd, key);
  if (v === null) return [];
  return v
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function bool(fd: FormData, key: string): boolean {
  return fd.get(key) === "on" || fd.get(key) === "true";
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
