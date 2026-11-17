/** In-memory handoff from food-search → food-servings (URL `name` is unreliable in Expo Router). */
export type FoodDraft = {
  meal: string;
  date: string;
  code: string;
  foodName: string;
  brand: string;
  servingLabel: string;
  cal: number;
  protein: number;
  carbs: number;
  fat: number;
};

let draft: FoodDraft | null = null;

export function setFoodDraft(next: FoodDraft) {
  draft = next;
}

export function getFoodDraft(): FoodDraft | null {
  return draft;
}

export function clearFoodDraft() {
  draft = null;
}

export function paramStr(v: string | string[] | undefined, fallback = ''): string {
  if (Array.isArray(v)) return String(v[0] ?? fallback);
  if (v == null || v === '') return fallback;
  return String(v);
}
