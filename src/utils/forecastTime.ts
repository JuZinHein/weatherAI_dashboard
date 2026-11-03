/**
 * Forecast step time windows for UI labels (Burmese digits).
 * Example: "၃-၁၁-၂၀၂၆ (၀၀:၀၀ မှ ၀၆:၀၀)"
 */

import { toBurmeseNumber } from './burmese';

export function parseForecastUtc(input: string | Date | undefined | null): Date | null {
  if (!input) return null;
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input;
  }
  try {
    const clean = String(input).replace(' UTC', 'Z').replace(' ', 'T');
    let d = new Date(clean);
    if (!Number.isNaN(d.getTime())) return d;
    const match = String(input).match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
    if (match) {
      return new Date(Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5]));
    }
  } catch {
    /* ignore */
  }
  return null;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDayMonthYear(d: Date): string {
  return toBurmeseNumber(`${d.getUTCDate()}-${d.getUTCMonth() + 1}-${d.getUTCFullYear()}`);
}

function formatClock(d: Date): string {
  return toBurmeseNumber(`${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`);
}

export function formatTimeWindow(start: Date, end: Date): string {
  const sameDay =
    start.getUTCFullYear() === end.getUTCFullYear() &&
    start.getUTCMonth() === end.getUTCMonth() &&
    start.getUTCDate() === end.getUTCDate();

  if (sameDay) {
    return `${formatDayMonthYear(start)} (${formatClock(start)} မှ ${formatClock(end)})`;
  }
  return `${formatDayMonthYear(start)} (${formatClock(start)}) မှ ${formatDayMonthYear(end)} (${formatClock(end)})`;
}

/** Compact scrubber line, e.g. "၀၀:၀၀–၀၆:၀၀" */
export function formatTimeWindowShort(start: Date, end: Date): string {
  return `${formatClock(start)}–${formatClock(end)}`;
}

export interface StepTimeWindow {
  start: Date;
  end: Date;
  label: string;
  shortLabel: string;
  dateLabel: string;
}

/**
 * Window for step i: from this step's valid time to the next step
 * (or +6h when it is the last step).
 */
export function getStepTimeWindow(
  validTimesUtc: string[],
  stepIndex: number,
): StepTimeWindow | null {
  const start = parseForecastUtc(validTimesUtc[stepIndex]);
  if (!start) return null;

  const next = parseForecastUtc(validTimesUtc[stepIndex + 1]);
  const end =
    next && next.getTime() > start.getTime()
      ? next
      : new Date(start.getTime() + 6 * 3600 * 1000);

  return {
    start,
    end,
    label: formatTimeWindow(start, end),
    shortLabel: formatTimeWindowShort(start, end),
    dateLabel: formatDayMonthYear(start),
  };
}
