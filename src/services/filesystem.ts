import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { v4 as uuid } from "uuid";

/**
 * Subfolder names that make up the daily shipment structure.
 * Index order matters – it matches the 01–07 prefixes.
 */
const DAILY_SUBFOLDERS = [
  "01_PICK_LISTS",
  "02_PACKING_SLIPS",
  "03_LABELS",
  "04_BATCHES",
  "05_MANIFESTS",
  "06_EXCEPTIONS",
  "07_LOGS",
] as const;

const LABEL_CHANNEL_DIRS = ["Amazon", "eBay", "Walmart", "Temu", "Manual"] as const;

export type ChannelDir = (typeof LABEL_CHANNEL_DIRS)[number];

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Ensure the full dated folder tree exists for a given day.
 * Returns the absolute path to the day folder.
 *
 *   <root>/YYYY-MM-DD/
 *     01_PICK_LISTS/
 *     02_PACKING_SLIPS/
 *     03_LABELS/  -> Amazon/ eBay/ Walmart/ Temu/ Manual/
 *     04_BATCHES/
 *     05_MANIFESTS/
 *     06_EXCEPTIONS/
 *     07_LOGS/
 */
export function ensureDailyFolders(dateISO: string, rootPath: string): string {
  const dayDir = path.resolve(rootPath, dateISO);
  for (const sub of DAILY_SUBFOLDERS) {
    const full = path.join(dayDir, sub);
    fs.mkdirSync(full, { recursive: true });

    // 03_LABELS gets channel subdirectories
    if (sub === "03_LABELS") {
      for (const ch of LABEL_CHANNEL_DIRS) {
        fs.mkdirSync(path.join(full, ch), { recursive: true });
      }
    }
  }
  return dayDir;
}

/**
 * Write a buffer to disk atomically: write to a temp file first, then rename.
 * This avoids partial files if the process crashes mid-write.
 */
export function writeFileAtomic(filePath: string, buffer: Buffer): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  const tmp = path.join(dir, `.tmp-${uuid()}`);
  fs.writeFileSync(tmp, buffer);
  fs.renameSync(tmp, filePath);
}

/**
 * Sanitize a string for safe use as a filename.
 * Removes or replaces characters that are problematic on Windows / macOS / Linux.
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_") // illegal chars
    .replace(/\s+/g, "_")                     // whitespace → underscore
    .replace(/_{2,}/g, "_")                   // collapse runs
    .replace(/^\.+/, "")                       // no leading dots
    .slice(0, 200);                            // reasonable max length
}

// ─── Path helpers ────────────────────────────────────────────────────────────

export function pickListDir(dayDir: string): string {
  return path.join(dayDir, "01_PICK_LISTS");
}

export function packingSlipDir(dayDir: string): string {
  return path.join(dayDir, "02_PACKING_SLIPS");
}

export function labelsDir(dayDir: string, channel: ChannelDir): string {
  return path.join(dayDir, "03_LABELS", channel);
}

export function batchesDir(dayDir: string): string {
  return path.join(dayDir, "04_BATCHES");
}

export function manifestsDir(dayDir: string): string {
  return path.join(dayDir, "05_MANIFESTS");
}

export function exceptionsDir(dayDir: string): string {
  return path.join(dayDir, "06_EXCEPTIONS");
}

export function logsDir(dayDir: string): string {
  return path.join(dayDir, "07_LOGS");
}

/**
 * Map a ChannelType enum value to the label subfolder name.
 */
export function channelToDir(channel: string): ChannelDir {
  const map: Record<string, ChannelDir> = {
    AMAZON: "Amazon",
    EBAY: "eBay",
    WALMART: "Walmart",
    TEMU: "Temu",
    OTHER: "Manual",
    MANUAL: "Manual",
  };
  return map[channel] ?? "Manual";
}
