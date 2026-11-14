/** Pure pricing rules. All amounts are integer cents. */

export const MIN_DISCOUNT = 5;
export const MAX_DISCOUNT = 50;

export interface PackLine {
  unitPriceCents: number;
  quantity: number;
}

export interface PackPrice {
  mealCount: number;
  menuTotalCents: number;
  discountCents: number;
  totalCents: number;
}

/** Pack price = sum of menu prices x (1 - discount), rounded to cents. */
export function computePackPrice(lines: PackLine[], discountPercent: number): PackPrice {
  const mealCount = lines.reduce((n, l) => n + l.quantity, 0);
  const menuTotalCents = lines.reduce((n, l) => n + l.unitPriceCents * l.quantity, 0);
  const totalCents = Math.round((menuTotalCents * (100 - discountPercent)) / 100);
  return { mealCount, menuTotalCents, discountCents: menuTotalCents - totalCents, totalCents };
}

export interface Commission {
  commissionCents: number;
  restaurantPayoutCents: number;
}

/** Commission is applied to the discounted pack price. */
export function computeCommission(totalCents: number, commissionPercent: number): Commission {
  const commissionCents = Math.round((totalCents * commissionPercent) / 100);
  return { commissionCents, restaurantPayoutCents: totalCents - commissionCents };
}

export function isMealCountAllowed(count: number, min: number, max: number): boolean {
  return count >= min && count <= max;
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

export interface ProjectionInput {
  avgDishPrice: number; // dollars
  foodCostPercent: number;
  packsPerWeek: number;
  mealsPerPack: number;
  discountPercent: number;
  commissionPercent: number;
}

/** Restaurant calculator on the "For restaurants" page. Returns weekly cents. */
export function computeProjection(i: ProjectionInput) {
  const dishCents = Math.round(i.avgDishPrice * 100);
  const pack = computePackPrice([{ unitPriceCents: dishCents, quantity: i.mealsPerPack }], i.discountPercent);
  const c = computeCommission(pack.totalCents, i.commissionPercent);
  const foodCostPerPack = Math.round((pack.menuTotalCents * i.foodCostPercent) / 100);
  const leftPerPack = c.restaurantPayoutCents - foodCostPerPack;
  return {
    packPriceCents: pack.totalCents,
    commissionPerPackCents: c.commissionCents,
    receivedPerPackCents: c.restaurantPayoutCents,
    leftPerPackCents: leftPerPack,
    weeklyReceivedCents: c.restaurantPayoutCents * i.packsPerWeek,
    weeklyCommissionCents: c.commissionCents * i.packsPerWeek,
    weeklyLeftCents: leftPerPack * i.packsPerWeek,
    weeklyFoodCostCents: foodCostPerPack * i.packsPerWeek,
  };
}
