import type { ColorId } from "./levels";
import type { Kind } from "./physics";

const BASE = `${import.meta.env.BASE_URL}zerog/`;

export const asset = (path: string) => BASE + path;

export const UI = {
  bg: asset("ui/bg.jpg"),
  bgBlur: asset("ui/bg-blur.jpg"),
  header: asset("ui/header.png"),
  mascot: asset("ui/mascot.png"),
  pause: asset("ui/pause.png"),
  chamber: asset("ui/candy-bg.png"),
  chocGrid: asset("ui/choc-grid.png"),
  basket: asset("ui/basket.png"),
  footer: asset("ui/footer.png"),
  settings: asset("ui/icon-button.png"),
  next: asset("ui/btn.png"),
  nextHover: asset("ui/btn-hover.png"),
  box: asset("ui/candy-box.png"),
  lid: asset("ui/candy-lid.png"),
  popupBg: asset("popup/bg.png"),
  star: asset("popup/star.png"),
  retry: asset("popup/retry.png"),
  close: asset("popup/close.png"),
  wonka: asset("specials/wonka.png"),
  power: {
    swirl: asset("powerups/p1.png"),
    surprise: asset("powerups/p2.png"),
    sweet: asset("powerups/p3.png"),
  },
};

export const candyUrl = (c: ColorId) => asset(`candies/${c}.png`);

const SPECIAL_URL: Record<Exclude<Kind, "candy">, string> = {
  wild: asset("specials/candy_bar.png"),
  soda: asset("specials/candy_soda.png"),
  gob: asset("specials/candy_gobstopper.png"),
};
export const specialUrl = (k: Exclude<Kind, "candy">) => SPECIAL_URL[k];

// The PNGs carry different amounts of transparent padding; cropping to the
// visible pixels lets every candy draw at the same apparent size.
export interface Sprite {
  img: HTMLImageElement;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

const sprites = new Map<string, Sprite>();

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${url}`));
    img.src = url;
  });
}

function trim(img: HTMLImageElement): Sprite {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { img, sx: 0, sy: 0, sw: w, sh: h };
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, w, h);
  let x0 = w;
  let y0 = h;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      if (data[(y * w + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 <= x0 || y1 <= y0) return { img, sx: 0, sy: 0, sw: w, sh: h };
  return { img, sx: x0, sy: y0, sw: x1 - x0 + 2, sh: y1 - y0 + 2 };
}

export async function loadSprites(colors: ColorId[]) {
  const urls = [...colors.map(candyUrl), ...Object.values(SPECIAL_URL)].filter((u) => !sprites.has(u));
  const loaded = await Promise.all(urls.map((u) => loadImage(u).then((img) => [u, trim(img)] as const)));
  for (const [u, s] of loaded) sprites.set(u, s);
}

export function spriteFor(kind: Kind, color: ColorId | null): Sprite | undefined {
  return sprites.get(kind === "candy" && color ? candyUrl(color) : specialUrl(kind as Exclude<Kind, "candy">));
}

let fontsReady: Promise<unknown> | null = null;
export function loadFonts() {
  fontsReady ??= Promise.all([
    document.fonts.load('40px "Cherry Bomb One"'),
    document.fonts.load('40px "Chunky Playful"'),
  ]).catch(() => {});
  return fontsReady;
}
