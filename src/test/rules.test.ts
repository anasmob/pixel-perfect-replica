import { describe, expect, it } from "vitest";
import { computeCommission, computePackPrice, isMealCountAllowed, computeProjection } from "@/lib/pricing";
import { isEduEmail, safeRedirect, generateOrderCode } from "@/lib/validation";
import { computeResponseDeadline } from "@/lib/deadline";

describe("pack pricing", () => {
  it("applies the restaurant discount to the sum of menu prices", () => {
    const p = computePackPrice(
      [
        { unitPriceCents: 1150, quantity: 2 },
        { unitPriceCents: 1325, quantity: 1 },
      ],
      15,
    );
    expect(p.mealCount).toBe(3);
    expect(p.menuTotalCents).toBe(3625);
    expect(p.totalCents).toBe(3081); // 36.25 * 0.85 = 30.8125 -> 30.81
    expect(p.discountCents).toBe(544);
  });

  it("rounds to cents with a 35% discount", () => {
    const p = computePackPrice([{ unitPriceCents: 1095, quantity: 5 }], 35);
    expect(p.menuTotalCents).toBe(5475);
    expect(p.totalCents).toBe(3559); // 54.75 * 0.65 = 35.5875 -> 35.59
  });

  it("charges commission on the discounted price", () => {
    expect(computeCommission(3081, 10)).toEqual({ commissionCents: 308, restaurantPayoutCents: 2773 });
  });

  it("only allows meal counts inside the restaurant range", () => {
    expect(isMealCountAllowed(2, 3, 10)).toBe(false);
    expect(isMealCountAllowed(3, 3, 10)).toBe(true);
    expect(isMealCountAllowed(10, 3, 10)).toBe(true);
    expect(isMealCountAllowed(11, 3, 10)).toBe(false);
  });

  it("projects weekly amounts for restaurants", () => {
    const r = computeProjection({
      avgDishPrice: 12,
      foodCostPercent: 30,
      packsPerWeek: 10,
      mealsPerPack: 5,
      discountPercent: 20,
      commissionPercent: 10,
    });
    expect(r.packPriceCents).toBe(4800);
    expect(r.commissionPerPackCents).toBe(480);
    expect(r.receivedPerPackCents).toBe(4320);
    expect(r.leftPerPackCents).toBe(4320 - 1800);
    expect(r.weeklyReceivedCents).toBe(43200);
  });
});

describe("sign-up rules", () => {
  it("accepts any .edu email and rejects others", () => {
    expect(isEduEmail("sam@utexas.edu")).toBe(true);
    expect(isEduEmail("Sam@MIT.EDU")).toBe(true);
    expect(isEduEmail("sam@gmail.com")).toBe(false);
    expect(isEduEmail("sam@school.edu.com")).toBe(false);
  });

  it("only redirects to same-origin paths", () => {
    expect(safeRedirect("/orders")).toBe("/orders");
    expect(safeRedirect("//evil.com")).toBe("/restaurants");
    expect(safeRedirect("https://evil.com")).toBe("/restaurants");
  });

  it("creates 6-character order codes", () => {
    expect(generateOrderCode()).toMatch(/^[A-Z2-9]{6}$/);
  });
});

describe("restaurant response deadline", () => {
  const t = (iso: string) => new Date(iso);
  const slot = t("2026-11-16T17:00:00Z");

  it("is 30 minutes when the order is placed during pickup hours", () => {
    const d = computeResponseDeadline(t("2026-11-14T17:10:00Z"), [t("2026-11-14T17:00:00Z"), slot], slot);
    expect(d.toISOString()).toBe("2026-11-14T17:40:00.000Z");
  });

  it("pauses outside pickup hours", () => {
    // Placed at night; next pickup hour starts at 17:00 the next day.
    const d = computeResponseDeadline(t("2026-11-14T03:00:00Z"), [t("2026-11-15T17:00:00Z"), slot], slot);
    expect(d.toISOString()).toBe("2026-11-15T17:30:00.000Z");
  });

  it("carries remaining minutes across pickup hours", () => {
    // 10 minutes left in the 17:00 hour, remaining 20 minutes counted from the next window at 19:00.
    const d = computeResponseDeadline(
      t("2026-11-14T17:50:00Z"),
      [t("2026-11-14T17:00:00Z"), t("2026-11-14T19:00:00Z"), slot],
      slot,
    );
    expect(d.toISOString()).toBe("2026-11-14T19:20:00.000Z");
  });

  it("never passes the start of the booked slot", () => {
    const booked = t("2026-11-15T12:00:00Z");
    const d = computeResponseDeadline(t("2026-11-14T23:00:00Z"), [t("2026-11-15T12:00:00Z")], booked);
    expect(d.toISOString()).toBe("2026-11-15T12:00:00.000Z");
  });
});
