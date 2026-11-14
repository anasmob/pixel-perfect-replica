/**
 * The restaurant has 30 minutes to respond, but only minutes that fall inside
 * its pickup hours count. Pickup hours are the union of its 1-hour slot windows.
 * The deadline never goes past the start of the booked pickup slot.
 */
export const RESPONSE_MINUTES = 30;
const HOUR = 60 * 60 * 1000;

export function computeResponseDeadline(
  placedAt: Date,
  slotStarts: Date[],
  bookedSlotStart: Date,
  minutes = RESPONSE_MINUTES,
): Date {
  const placed = placedAt.getTime();
  const budget = minutes * 60 * 1000;
  const cap = Math.max(bookedSlotStart.getTime(), placed + budget);
  let remaining = budget;
  const starts = [...new Set(slotStarts.map((s) => s.getTime()))].sort((a, b) => a - b);
  let cursor = placed;
  for (const start of starts) {
    const end = start + HOUR;
    const from = Math.max(start, cursor);
    if (end <= from) continue;
    const available = end - from;
    if (available >= remaining) return new Date(Math.min(from + remaining, cap));
    remaining -= available;
    cursor = end;
  }
  return new Date(cap);
}
