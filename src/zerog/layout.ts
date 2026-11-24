// Stage geometry in design units (matches the 402 x 874 Game UI mockup).
export const STAGE_W = 402;
export const STAGE_H = 874;

export const WORLD = 1000;

// Inner chocolate area of ui/candy-bg.png, where the physics world lives.
export const CHAMBER = { x: 32, y: 208, w: 340, h: 340 };
export const WORLD_SCALE = CHAMBER.w / WORLD;

export function worldToStage(x: number, y: number) {
  return { x: CHAMBER.x + x * WORLD_SCALE, y: CHAMBER.y + y * WORLD_SCALE };
}

export function stageToWorld(x: number, y: number) {
  return { x: (x - CHAMBER.x) / WORLD_SCALE, y: (y - CHAMBER.y) / WORLD_SCALE };
}

// The basket's 5 columns taper with perspective: boundaries at the top of the
// grid (y = BASKET_TOP) and further down (y = BASKET_BOTTOM).
export const BASKET_TOP = 640;
export const BASKET_BOTTOM = 800;
const COL_TOP = [64, 117, 175, 231, 288, 346];
const COL_BOTTOM = [88, 134, 180, 226, 272, 318];
export const BASKET_COLS = 5;

export function basketColumnX(col: number, y: number): number {
  const t = Math.min(1, Math.max(0, (y - BASKET_TOP) / (BASKET_BOTTOM - BASKET_TOP)));
  const l = COL_TOP[col] + (COL_BOTTOM[col] - COL_TOP[col]) * t;
  const r = COL_TOP[col + 1] + (COL_BOTTOM[col + 1] - COL_TOP[col + 1]) * t;
  return (l + r) / 2;
}

// Popped candies stack from just above the footer upward.
export const STACK_BASE_Y = 772;
export const STACK_ICON = 30;

export function stackSlot(col: number, index: number, step: number) {
  const y = STACK_BASE_Y - index * step;
  return { x: basketColumnX(col, y), y };
}
