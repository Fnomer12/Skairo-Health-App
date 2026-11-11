import type { Reading } from "../db/records";

/**
 * trendData — pure helpers behind the Trends card.
 * - filters out physically impossible values (typos / sensor errors)
 * - limits readings to a time range (7D / 30D / 3M / 1Y / All)
 * - groups into one point per day for long ranges (avg + min/max)
 * - works out low / avg / high, latest and change since last
 */

export type VitalKey = "heartRate" | "temperature" | "spo2" | "respiratoryRate";
export type RangeKey = "7D" | "30D" | "3M" | "1Y" | "ALL";

export const RANGES: RangeKey[] = ["7D", "30D", "3M", "1Y", "ALL"];
export const VITAL_ORDER: VitalKey[] = ["heartRate", "temperature", "spo2", "respiratoryRate"];

export const VITAL_META: Record<
  VitalKey,
  {
    short: string;
    label: string;
    unit: string;
    decimals: number;
    /** values outside this are treated as errors and hidden */
    plausible: [number, number];
    /** NEWS2 sub-score 0 range (the healthy band on the chart) */
    normal: [number, number];
    /** smallest change worth showing as up/down */
    minChange: number;
  }
> = {
  heartRate: { short: "Heart", label: "Heart rate", unit: "bpm", decimals: 0, plausible: [20, 250], normal: [51, 90], minChange: 1 },
  temperature: { short: "Temp", label: "Temperature", unit: "°C", decimals: 1, plausible: [34, 43], normal: [36.1, 38.0], minChange: 0.1 },
  spo2: { short: "SpO₂", label: "Oxygen (SpO₂)", unit: "%", decimals: 0, plausible: [70, 100], normal: [96, 100], minChange: 1 },
  respiratoryRate: { short: "Resp", label: "Breathing rate", unit: "/min", decimals: 0, plausible: [4, 60], normal: [12, 20], minChange: 1 },
};

/** NEWS2 single-parameter score (SpO₂ scale 1) for the 4 vitals we measure. */
export function subScore(vital: VitalKey, v: number): number {
  switch (vital) {
    case "respiratoryRate":
      return v <= 8 ? 3 : v <= 11 ? 1 : v <= 20 ? 0 : v <= 24 ? 2 : 3;
    case "spo2":
      return v <= 91 ? 3 : v <= 93 ? 2 : v <= 95 ? 1 : 0;
    case "temperature":
      return v <= 35.0 ? 3 : v <= 36.0 ? 1 : v <= 38.0 ? 0 : v <= 39.0 ? 1 : 2;
    case "heartRate":
      return v <= 40 ? 3 : v <= 50 ? 1 : v <= 90 ? 0 : v <= 110 ? 1 : v <= 130 ? 2 : 3;
  }
}

export function valueOf(r: Reading, vital: VitalKey): number | null {
  const v = (r as unknown as Record<string, unknown>)[vital];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function isPlausible(vital: VitalKey, v: number): boolean {
  const [lo, hi] = VITAL_META[vital].plausible;
  return v >= lo && v <= hi;
}

/** True when any value in the reading is impossible (e.g. 56 °C). */
export function readingLooksImplausible(r: Reading): boolean {
  return VITAL_ORDER.some((k) => {
    const v = valueOf(r, k);
    return v != null && !isPlausible(k, v);
  });
}

const DAY = 24 * 3600 * 1000;

export function rangeStart(range: RangeKey, now: number): number | null {
  switch (range) {
    case "7D":
      return now - 7 * DAY;
    case "30D":
      return now - 30 * DAY;
    case "3M":
      return now - 91 * DAY;
    case "1Y":
      return now - 365 * DAY;
    case "ALL":
      return null;
  }
}

export type TrendPoint = {
  t: number; // ms timestamp (for daily points: midday of that day)
  value: number; // the reading, or the daily average
  min: number;
  max: number;
  count: number;
};

export type TrendSeries = {
  vital: VitalKey;
  range: RangeKey;
  points: TrendPoint[]; // oldest → newest
  aggregated: boolean; // true when points are daily averages
  startT: number; // left edge of the chart
  endT: number; // right edge of the chart
  excluded: number; // readings with impossible values hidden in this range
  stats: { low: number; high: number; avg: number; count: number } | null;
  latest: { value: number; t: number } | null;
  previous: { value: number; t: number } | null;
  /** true when there is data, just not in this range */
  hasOlderData: boolean;
};

function round(v: number, decimals: number) {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}

export function buildSeries(
  records: Reading[],
  vital: VitalKey,
  range: RangeKey,
  now: number = Date.now()
): TrendSeries {
  const meta = VITAL_META[vital];
  const start = rangeStart(range, now);

  // A reading with ANY impossible value is left out completely — if one value
  // is wrong (sensor misplaced, typo) the others can't be trusted either.
  const all = records
    .map((r) => ({ t: new Date(r.recordedAt).getTime(), v: valueOf(r, vital), bad: readingLooksImplausible(r) }))
    .filter((p): p is { t: number; v: number; bad: boolean } => p.v != null && Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t);

  const inRange = start == null ? all : all.filter((p) => p.t >= start);
  const valid = inRange.filter((p) => !p.bad);
  const excluded = inRange.length - valid.length;
  const hasOlderData = valid.length === 0 && all.some((p) => !p.bad);

  const longRange = range === "3M" || range === "1Y" || range === "ALL";
  const aggregated = valid.length > 0 && (longRange || valid.length > 40);

  let points: TrendPoint[];
  if (aggregated) {
    const byDay = new Map<string, { t: number; vals: number[] }>();
    for (const p of valid) {
      const d = new Date(p.t);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!byDay.has(key)) {
        const mid = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime();
        byDay.set(key, { t: mid, vals: [] });
      }
      byDay.get(key)!.vals.push(p.v);
    }
    points = Array.from(byDay.values())
      .sort((a, b) => a.t - b.t)
      .map(({ t, vals }) => ({
        t,
        value: round(vals.reduce((a, b) => a + b, 0) / vals.length, meta.decimals),
        min: Math.min(...vals),
        max: Math.max(...vals),
        count: vals.length,
      }));
  } else {
    points = valid.map((p) => ({ t: p.t, value: p.v, min: p.v, max: p.v, count: 1 }));
  }

  const stats =
    valid.length > 0
      ? {
          low: Math.min(...valid.map((p) => p.v)),
          high: Math.max(...valid.map((p) => p.v)),
          avg: round(valid.reduce((a, p) => a + p.v, 0) / valid.length, meta.decimals),
          count: valid.length,
        }
      : null;

  const latestP = valid[valid.length - 1];
  const prevP = valid[valid.length - 2];

  const startT = start ?? (valid[0]?.t ?? now);
  const endT = now;

  return {
    vital,
    range,
    points,
    aggregated,
    startT,
    endT: Math.max(endT, latestP?.t ?? endT),
    excluded,
    stats,
    latest: latestP ? { value: latestP.v, t: latestP.t } : null,
    previous: prevP ? { value: prevP.v, t: prevP.t } : null,
    hasOlderData,
  };
}

/** Y-axis: zoom to the readings when there's a trend; show the healthy band otherwise. */
export function yDomain(series: TrendSeries): [number, number] {
  const [nLo, nHi] = VITAL_META[series.vital].normal;
  const vals = series.points.flatMap((p) => [p.min, p.max]);

  // 0 or 1 reading: keep the healthy range in view so the chart isn't empty
  if (series.points.length < 2) {
    const lo = Math.min(nLo, ...vals);
    const hi = Math.max(nHi, ...vals);
    const pad = (hi - lo) * 0.2 || 1;
    return [lo - pad, series.vital === "spo2" ? Math.min(hi + pad, 101) : hi + pad];
  }

  // 2+ readings: zoom in on them so changes are easy to see
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  const minSpan = series.vital === "temperature" ? 1 : 10; // avoid a flat-looking line
  if (hi - lo < minSpan) {
    const mid = (hi + lo) / 2;
    lo = mid - minSpan / 2;
    hi = mid + minSpan / 2;
  }
  const pad = (hi - lo) * 0.25;
  return [lo - pad, series.vital === "spo2" ? Math.min(hi + pad, 101) : hi + pad];
}

export function formatValue(vital: VitalKey, v: number): string {
  return v.toFixed(VITAL_META[vital].decimals);
}

export function formatAxisDate(t: number, range: RangeKey): string {
  const d = new Date(t);
  if (range === "1Y" || range === "ALL") {
    // "Nov '26" — avoids "Nov 26" being read as the 26th of November
    return `${d.toLocaleDateString(undefined, { month: "short" })} '${String(d.getFullYear()).slice(-2)}`;
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatStamp(t: number): string {
  const d = new Date(t);
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/** Overall badge for the card, based on the newest plausible reading. */
export function overallStatus(records: Reading[]): "in" | "out" | "none" {
  const newest = [...records]
    .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())
    .find((r) => !readingLooksImplausible(r));
  if (!newest) return "none";
  const anyOut = VITAL_ORDER.some((k) => {
    const v = valueOf(newest, k);
    return v != null && subScore(k, v) > 0;
  });
  return anyOut ? "out" : "in";
}