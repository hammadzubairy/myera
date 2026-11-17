import { Router } from 'express';
import {
  calorieGoalSchema,
  createFoodLogSchema,
  updateFoodLogSchema,
  type FoodSearchResult,
} from '@myera/shared';
import { requireAuth } from '../middleware/auth';
import { getAdminClient } from '../supabase';
import { env } from '../env';
import { searchCommonFoods, suggestCommonFoods } from '../data/commonFoods';

const router = Router();
const DEFAULT_GOAL = 1600;

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
}

function decodeHtmlEntities(input: string): string {
  return String(input)
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCharCode(code) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      const code = parseInt(h, 16);
      return Number.isFinite(code) ? String.fromCharCode(code) : _;
    });
}

/** Spoon-sized labels are often spice packets / condiments, not meal servings. */
function isTinySpoonServing(label: string): boolean {
  return /\b(tbsp|tsp|tablespoon|teaspoon)\b/i.test(label);
}

function mapOffProduct(p: any): FoodSearchResult | null {
  const name = decodeHtmlEntities(
    (p.product_name || p.product_name_en || p.generic_name || '').trim()
  );
  if (!name) return null;
  const n = p.nutriments || {};
  // Prefer per-serving if OFF provides energy-serving; else scale from per 100g
  let cal = num(n['energy-kcal_serving'] ?? n.energy_kcal_serving);
  let protein = num(n.proteins_serving);
  let carbs = num(n.carbohydrates_serving);
  let fat = num(n.fat_serving);
  let servingLabel = decodeHtmlEntities((p.serving_size || '').trim() || '1 serving');

  const cal100 = num(n['energy-kcal_100g'] ?? n.energy_kcal_100g);
  const protein100 = num(n.proteins_100g);
  const carbs100 = num(n.carbohydrates_100g);
  const fat100 = num(n.fat_100g);

  if (cal <= 0) {
    if (cal100 <= 0) return null;
    // Treat 100g as one serving when no serving data
    cal = cal100;
    protein = protein100;
    carbs = carbs100;
    fat = fat100;
    servingLabel = decodeHtmlEntities((p.serving_size || '').trim() || '100 g');
  } else if (isTinySpoonServing(servingLabel) && cal < 50 && cal100 > 0) {
    // Prefer 100 g for meal-like foods mislabeled with tbsp/tsp servings
    cal = cal100;
    protein = protein100;
    carbs = carbs100;
    fat = fat100;
    servingLabel = '100 g';
  }

  const brandRaw = p.brands ? String(p.brands).split(',')[0].trim() : '';
  return {
    code: String(p.code || p._id || ''),
    name,
    brand: brandRaw ? decodeHtmlEntities(brandRaw) : null,
    serving_label: servingLabel,
    calories_per_serving: Math.round(cal * 10) / 10,
    protein_g_per_serving: Math.round(protein * 10) / 10,
    carbs_g_per_serving: Math.round(carbs * 10) / 10,
    fat_g_per_serving: Math.round(fat * 10) / 10,
    image_url: p.image_front_small_url || p.image_small_url || null,
  };
}

function mergeFoods(...groups: FoodSearchResult[][]): FoodSearchResult[] {
  const seen = new Set<string>();
  const out: FoodSearchResult[] = [];
  for (const group of groups) {
    for (const item of group) {
      const key = item.name.trim().toLowerCase();
      if (!item.code || seen.has(key)) continue;
      seen.add(key);
      out.push(item);
      if (out.length >= 40) return out;
    }
  }
  return out;
}

async function searchOpenFoodFacts(q: string): Promise<FoodSearchResult[]> {
  const url = new URL('https://world.openfoodfacts.org/cgi/search.pl');
  url.searchParams.set('search_terms', q);
  url.searchParams.set('search_simple', '1');
  url.searchParams.set('action', 'process');
  url.searchParams.set('json', '1');
  url.searchParams.set('page_size', '30');
  url.searchParams.set('fields', [
    'code',
    'product_name',
    'product_name_en',
    'generic_name',
    'brands',
    'serving_size',
    'nutriments',
    'image_front_small_url',
    'image_small_url',
  ].join(','));

  const resp = await fetch(url.toString(), {
    headers: { 'User-Agent': 'MyEra/1.0 (member companion; food search)' },
    signal: AbortSignal.timeout(7000),
  });
  if (!resp.ok) throw new Error(`Open Food Facts ${resp.status}`);
  const json = (await resp.json()) as { products?: any[] };
  return (json.products || [])
    .map(mapOffProduct)
    .filter((r): r is FoodSearchResult => !!r && !!r.code);
}

async function searchUsda(q: string): Promise<FoodSearchResult[]> {
  if (!env.usdaFdcApiKey) return [];
  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
  url.searchParams.set('api_key', env.usdaFdcApiKey);
  url.searchParams.set('query', q);
  url.searchParams.set('pageSize', '15');
  const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(7000) });
  if (!resp.ok) throw new Error(`USDA FoodData Central ${resp.status}`);
  const json = (await resp.json()) as { foods?: any[] };
  return (json.foods || [])
    .map((f): FoodSearchResult | null => {
      const nutrients: any[] = f.foodNutrients || [];
      const pick = (id: number) => {
        const n = nutrients.find((x) => x.nutrientId === id || x.nutrientNumber === String(id));
        return num(n?.value);
      };
      const name = decodeHtmlEntities(String(f.description || '').trim());
      if (!name) return null;
      let calories = pick(1008);
      if (calories <= 0) return null;
      let protein = pick(1003);
      let carbs = pick(1005);
      let fat = pick(1004);
      let servingLabel = f.servingSize
        ? `${f.servingSize}${f.servingSizeUnit ? ` ${f.servingSizeUnit}` : ''}`
        : '100 g';
      // USDA spice/seasoning rows often use tbsp with tiny kcal — prefer 100 g
      if (isTinySpoonServing(servingLabel) && calories < 50) {
        servingLabel = '100 g';
      }
      return {
        code: `usda:${f.fdcId}`,
        name: name
          .toLowerCase()
          .replace(/\b\w/g, (c: string) => c.toUpperCase()),
        brand: f.brandName || f.brandOwner || null,
        serving_label: servingLabel,
        calories_per_serving: Math.round(calories * 10) / 10,
        protein_g_per_serving: Math.round(protein * 10) / 10,
        carbs_g_per_serving: Math.round(carbs * 10) / 10,
        fat_g_per_serving: Math.round(fat * 10) / 10,
        image_url: null,
      };
    })
    .filter((r): r is FoodSearchResult => !!r);
}

router.get('/search', requireAuth, async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) {
    return res.json({ results: suggestCommonFoods(24), suggestions: true });
  }

  const local = searchCommonFoods(q);
  const [off, usda] = await Promise.all([
    searchOpenFoodFacts(q).catch((e) => {
      console.warn('[food] open food facts', e?.message || e);
      return [] as FoodSearchResult[];
    }),
    searchUsda(q).catch((e) => {
      console.warn('[food] usda', e?.message || e);
      return [] as FoodSearchResult[];
    }),
  ]);

  return res.json({ results: mergeFoods(local, usda, off) });
});

async function getGoal(userId: string): Promise<number> {
  const { data } = await getAdminClient()
    .from('profiles')
    .select('calorie_goal_kcal')
    .eq('id', userId)
    .single();
  return data?.calorie_goal_kcal ?? DEFAULT_GOAL;
}

function summarize(logs: any[], goal: number, logged_on: string) {
  const calories_eaten = logs.reduce((s, l) => s + num(l.calories), 0);
  const protein_g = logs.reduce((s, l) => s + num(l.protein_g), 0);
  const carbs_g = logs.reduce((s, l) => s + num(l.carbs_g), 0);
  const fat_g = logs.reduce((s, l) => s + num(l.fat_g), 0);
  return {
    logged_on,
    calorie_goal_kcal: goal,
    calories_eaten: Math.round(calories_eaten),
    calories_left: Math.round(goal - calories_eaten),
    protein_g: Math.round(protein_g * 10) / 10,
    carbs_g: Math.round(carbs_g * 10) / 10,
    fat_g: Math.round(fat_g * 10) / 10,
    logs,
  };
}

router.get('/day', requireAuth, async (req, res) => {
  const logged_on =
    String(req.query.date || '').trim() || new Date().toISOString().slice(0, 10);
  const sb = getAdminClient();
  const [{ data: logs, error }, goal] = await Promise.all([
    sb
      .from('food_logs')
      .select('*')
      .eq('user_id', req.user!.id)
      .eq('logged_on', logged_on)
      .order('created_at', { ascending: true }),
    getGoal(req.user!.id),
  ]);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ day: summarize(logs || [], goal, logged_on) });
});

router.post('/logs', requireAuth, async (req, res) => {
  const parsed = createFoodLogSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { data, error } = await getAdminClient()
    .from('food_logs')
    .insert({
      user_id: req.user!.id,
      ...parsed.data,
      off_code: parsed.data.off_code ?? null,
    })
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ log: data });
});

router.patch('/logs/:id', requireAuth, async (req, res) => {
  const parsed = updateFoodLogSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { data, error } = await getAdminClient()
    .from('food_logs')
    .update(parsed.data)
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id)
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ log: data });
});

router.delete('/logs/:id', requireAuth, async (req, res) => {
  const { error } = await getAdminClient()
    .from('food_logs')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

router.patch('/goal', requireAuth, async (req, res) => {
  const parsed = calorieGoalSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { data, error } = await getAdminClient()
    .from('profiles')
    .update({
      calorie_goal_kcal: parsed.data.calorie_goal_kcal,
      updated_at: new Date().toISOString(),
    })
    .eq('id', req.user!.id)
    .select('*, community:communities(*)')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ profile: data });
});

export default router;
export { DEFAULT_GOAL as DEFAULT_CALORIE_GOAL };
