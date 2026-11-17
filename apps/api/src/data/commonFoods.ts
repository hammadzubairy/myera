import type { FoodSearchResult } from '@myera/shared';

type Staple = FoodSearchResult & { keywords: string[] };

/** Built-in foods so search still works when Open Food Facts or USDA is unreachable. */
const STAPLES: Staple[] = [
  food('egg', 'Egg, large', '1 large', 72, 6.3, 0.4, 4.8, ['eggs']),
  food('egg-whites', 'Egg whites', '3 whites', 51, 11, 0.7, 0.2, ['egg white']),
  food('chicken-breast', 'Chicken breast, cooked', '3 oz', 140, 26, 0, 3.1, ['chicken']),
  food('chicken-thigh', 'Chicken thigh, cooked', '3 oz', 164, 21, 0, 8.6, ['chicken']),
  food('ground-beef', 'Ground beef, 90% lean, cooked', '3 oz', 184, 22, 0, 10, ['beef', 'hamburger']),
  food('salmon', 'Salmon, cooked', '3 oz', 175, 19, 0, 10.5, ['fish']),
  food('tuna', 'Tuna, canned in water', '3 oz', 73, 16, 0, 0.8, ['fish']),
  food('shrimp', 'Shrimp, cooked', '3 oz', 84, 18, 0.2, 0.9, ['prawn']),
  food('turkey', 'Turkey breast, cooked', '3 oz', 125, 26, 0, 1.8, ['turkey']),
  food('greek-yogurt', 'Greek yogurt, plain nonfat', '170 g', 100, 17, 6, 0.7, ['yogurt', 'yoghurt']),
  food('cottage-cheese', 'Cottage cheese, low fat', '1/2 cup', 90, 12, 5, 2.5, ['cheese']),
  food('cheddar', 'Cheddar cheese', '1 oz', 114, 7, 0.4, 9.4, ['cheese']),
  food('milk', 'Milk, 2%', '1 cup', 122, 8, 12, 4.8, ['dairy']),
  food('almond-milk', 'Almond milk, unsweetened', '1 cup', 30, 1, 1, 2.5, ['almond']),
  food('oatmeal', 'Oatmeal, cooked', '1 cup', 158, 6, 27, 3.2, ['oats', 'porridge']),
  food('rice', 'White rice, cooked', '1 cup', 206, 4.3, 45, 0.4, ['rice']),
  food('brown-rice', 'Brown rice, cooked', '1 cup', 216, 5, 45, 1.8, ['rice']),
  food('pulao', 'Pulao, cooked', '100 g', 150, 3.5, 28, 3.2, [
    'pilaf',
    'pilau',
    'rice pulao',
    'vegetable pulao',
  ]),
  food('veg-pulao', 'Vegetable pulao, cooked', '100 g', 154, 3.8, 28, 3.5, [
    'pulao',
    'pilaf',
    'veg pulao',
  ]),
  food('chana-pulao', 'Chana pulao, cooked', '100 g', 160, 5.5, 26, 3.8, [
    'pulao',
    'chickpea',
    'chana',
  ]),
  food('pasta', 'Pasta, cooked', '1 cup', 220, 8, 43, 1.3, ['noodles', 'spaghetti']),
  food('bread', 'Bread, whole wheat', '1 slice', 81, 4, 14, 1.1, ['toast']),
  food('tortilla', 'Flour tortilla', '1 medium', 140, 4, 24, 3.5, ['wrap']),
  food('potato', 'Potato, baked', '1 medium', 161, 4.3, 37, 0.2, ['potato']),
  food('sweet-potato', 'Sweet potato, baked', '1 medium', 103, 2.3, 24, 0.1, ['yam']),
  food('banana', 'Banana', '1 medium', 105, 1.3, 27, 0.4, ['fruit']),
  food('apple', 'Apple', '1 medium', 95, 0.5, 25, 0.3, ['fruit']),
  food('berries', 'Mixed berries', '1 cup', 70, 1, 17, 0.4, ['strawberry', 'blueberry', 'fruit']),
  food('avocado', 'Avocado', '1/2 fruit', 120, 1.5, 6, 11, ['fruit']),
  food('broccoli', 'Broccoli, cooked', '1 cup', 55, 3.7, 11, 0.6, ['vegetable']),
  food('spinach', 'Spinach, raw', '2 cups', 14, 1.7, 2.2, 0.2, ['vegetable', 'salad']),
  food('salad', 'Mixed green salad', '2 cups', 20, 1.5, 3, 0.3, ['lettuce', 'vegetable']),
  food('almonds', 'Almonds', '1 oz (23 nuts)', 164, 6, 6, 14, ['nuts']),
  food('peanut-butter', 'Peanut butter', '2 tbsp', 188, 8, 6, 16, ['peanuts']),
  food('olive-oil', 'Olive oil', '1 tbsp', 119, 0, 0, 13.5, ['oil']),
  food('protein-shake', 'Protein shake', '1 scoop prepared', 160, 30, 5, 2.5, ['whey', 'shake', 'protein']),
  food('coffee', 'Coffee, black', '1 cup', 2, 0.3, 0, 0, ['espresso']),
  food('latte', 'Latte with 2% milk', '12 oz', 150, 8, 12, 6, ['coffee']),
  // Expanded staples (GLP-1 / everyday / South Asian)
  food('dal', 'Dal, cooked', '100 g', 116, 7, 18, 2, ['lentil', 'daal', 'daal']),
  food('chicken-curry', 'Chicken curry', '100 g', 160, 14, 4, 10, ['curry', 'murgh']),
  food('biryani', 'Chicken biryani', '100 g', 180, 10, 22, 6, ['rice', 'biryani']),
  food('chapati', 'Chapati / roti', '1 piece (40 g)', 120, 3.5, 22, 2.5, ['roti', 'flatbread']),
  food('naan', 'Naan bread', '1 piece', 260, 8, 45, 5, ['bread', 'naan']),
  food('raita', 'Raita', '100 g', 60, 3, 5, 3, ['yogurt', 'cucumber']),
  food('samosa', 'Vegetable samosa', '1 piece', 180, 4, 20, 10, ['snack']),
  food('pakora', 'Pakora', '100 g', 250, 6, 22, 15, ['fritter', 'snack']),
  food('hummus', 'Hummus', '2 tbsp', 70, 2, 4, 5, ['chickpea']),
  food('falafel', 'Falafel', '3 pieces', 170, 7, 16, 9, ['chickpea']),
  food('quinoa', 'Quinoa, cooked', '1 cup', 222, 8, 39, 3.5, ['grain']),
  food('tofu', 'Tofu, firm', '100 g', 144, 17, 3, 9, ['soy']),
  food('tempeh', 'Tempeh', '100 g', 193, 19, 9, 11, ['soy']),
  food('edamame', 'Edamame', '1 cup', 188, 18, 14, 8, ['soy']),
  food('cod', 'Cod, cooked', '3 oz', 90, 20, 0, 0.7, ['fish', 'white fish']),
  food('tilapia', 'Tilapia, cooked', '3 oz', 110, 22, 0, 2, ['fish']),
  food('turkey-burger', 'Turkey burger patty', '1 patty', 170, 21, 0, 9, ['turkey']),
  food('veggie-burger', 'Veggie burger patty', '1 patty', 150, 12, 14, 5, ['burger']),
  food('soup-chicken', 'Chicken noodle soup', '1 cup', 120, 8, 12, 3.5, ['soup']),
  food('soup-tomato', 'Tomato soup', '1 cup', 90, 2, 16, 2, ['soup']),
  food('stir-fry-veg', 'Vegetable stir-fry', '1 cup', 100, 3, 12, 5, ['stir fry', 'vegetables']),
  food('stir-fry-chicken', 'Chicken stir-fry', '1 cup', 220, 22, 10, 10, ['stir fry']),
  food('omelette', 'Egg omelette, 2 eggs', '1 omelette', 180, 12, 1, 14, ['eggs', 'omelet']),
  food('smoothie-berry', 'Berry protein smoothie', '16 oz', 250, 25, 28, 4, ['smoothie', 'shake']),
  food('granola', 'Granola', '1/3 cup', 180, 4, 28, 7, ['cereal']),
  food('string-cheese', 'String cheese', '1 stick', 80, 7, 1, 5, ['cheese', 'snack']),
  food('protein-bar', 'Protein bar', '1 bar', 200, 20, 22, 7, ['bar', 'snack']),
  food('rice-cakes', 'Rice cakes', '2 cakes', 70, 1.5, 15, 0.5, ['snack']),
  food('cucumber', 'Cucumber', '1 cup sliced', 16, 0.7, 4, 0.1, ['vegetable']),
  food('carrot', 'Carrots', '1 cup', 50, 1, 12, 0.3, ['vegetable']),
  food('bell-pepper', 'Bell pepper', '1 medium', 30, 1, 7, 0.3, ['vegetable']),
  food('tomato', 'Tomato', '1 medium', 22, 1, 5, 0.2, ['vegetable']),
  food('onion', 'Onion', '1/2 cup', 32, 1, 7, 0.1, ['vegetable']),
  food('garlic', 'Garlic', '1 clove', 4, 0.2, 1, 0, ['seasoning']),
  food('ghee', 'Ghee', '1 tbsp', 112, 0, 0, 12.7, ['butter', 'clarified']),
  food('butter', 'Butter', '1 tbsp', 102, 0.1, 0, 11.5, ['dairy']),
  food('honey', 'Honey', '1 tbsp', 64, 0, 17, 0, ['sweetener']),
  food('chai', 'Chai latte', '12 oz', 180, 6, 28, 5, ['tea', 'milk']),
  food('lassi', 'Sweet lassi', '1 cup', 180, 6, 28, 5, ['yogurt', 'drink']),
  food('mango', 'Mango', '1 cup', 99, 1.4, 25, 0.6, ['fruit']),
  food('orange', 'Orange', '1 medium', 62, 1.2, 15, 0.2, ['fruit']),
  food('grapes', 'Grapes', '1 cup', 104, 1, 27, 0.2, ['fruit']),
  food('watermelon', 'Watermelon', '1 cup', 46, 0.9, 11, 0.2, ['fruit']),
  food('popcorn', 'Air-popped popcorn', '3 cups', 90, 3, 18, 1, ['snack']),
  food('dark-chocolate', 'Dark chocolate', '1 oz', 170, 2, 13, 12, ['chocolate', 'snack']),
  food('ice-cream', 'Ice cream, vanilla', '1/2 cup', 140, 2, 16, 7, ['dessert']),
  food('pizza-slice', 'Cheese pizza slice', '1 slice', 285, 12, 36, 10, ['pizza']),
  food('burger', 'Beef burger with bun', '1 sandwich', 450, 25, 35, 22, ['hamburger']),
  food('fries', 'French fries', 'medium', 340, 4, 45, 16, ['potato', 'chips']),
  food('sushi-roll', 'Sushi roll (6 pieces)', '6 pieces', 250, 9, 38, 7, ['sushi', 'rice']),
  food('pho', 'Pho with beef', '1 bowl', 400, 25, 45, 12, ['soup', 'noodles']),
  food('tacos', 'Chicken taco', '1 taco', 180, 12, 16, 8, ['mexican']),
  food('burrito', 'Bean burrito', '1 burrito', 380, 14, 55, 12, ['mexican']),
];

function food(
  code: string,
  name: string,
  serving: string,
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
  keywords: string[]
): Staple {
  return {
    code: `staple:${code}`,
    name,
    brand: null,
    serving_label: serving,
    calories_per_serving: calories,
    protein_g_per_serving: protein,
    carbs_g_per_serving: carbs,
    fat_g_per_serving: fat,
    image_url: null,
    keywords,
  };
}

function withoutKeywords({ keywords: _keywords, ...rest }: Staple): FoodSearchResult {
  return rest;
}

/** Default suggestions when the search box is empty / short. */
export function suggestCommonFoods(limit = 24): FoodSearchResult[] {
  return STAPLES.slice(0, limit).map(withoutKeywords);
}

export function searchCommonFoods(query: string): FoodSearchResult[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const tokens = q.split(/\s+/).filter(Boolean);
  return STAPLES.filter((item) => {
    const hay = `${item.name} ${item.keywords.join(' ')}`.toLowerCase();
    return tokens.every((t) => hay.includes(t));
  })
    .slice(0, 20)
    .map(withoutKeywords);
}
