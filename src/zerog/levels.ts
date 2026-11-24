export type ColorId =
  | "blue"
  | "brown"
  | "cream"
  | "green"
  | "orange"
  | "peach"
  | "pink"
  | "red"
  | "violet"
  | "yellow";

export const COLOR_HEX: Record<ColorId, string> = {
  blue: "#3a8fe8",
  brown: "#6b3a26",
  cream: "#f3e6c4",
  green: "#2f9a3c",
  orange: "#f2701d",
  peach: "#f7a77c",
  pink: "#f27aa6",
  red: "#e02b3a",
  violet: "#8a3fd1",
  yellow: "#f6cf1f",
};

export interface LevelDef {
  id: number;
  name: string;
  blurb: string;
  colors: ColorId[];
  goal: number;
  time: number;
  // Exponential velocity damping per second; lower = more slippery.
  damping: number;
  population: number;
  wildChance: number;
  sodaChance: number;
  gobstoppers: number;
  // Score needed for 2 and 3 stars (completing the goals earns 1).
  stars: [number, number];
  hints?: boolean;
}

export const LEVELS: LevelDef[] = [
  {
    id: 1,
    name: "First Float",
    blurb: "Learn to sweep, grab and freeze.",
    colors: ["red", "blue", "yellow"],
    goal: 6,
    time: 90,
    damping: 1.6,
    population: 18,
    wildChance: 0,
    sodaChance: 0,
    gobstoppers: 0,
    stars: [3500, 6000],
    hints: true,
  },
  {
    id: 2,
    name: "Golden Hunt",
    blurb: "Wonka Bars match any colour and hide Golden Tickets.",
    colors: ["pink", "green", "orange", "violet"],
    goal: 8,
    time: 90,
    damping: 1.5,
    population: 22,
    wildChance: 0.06,
    sodaChance: 0,
    gobstoppers: 0,
    stars: [6000, 10000],
  },
  {
    id: 3,
    name: "Jawbreakers",
    blurb: "Gobstoppers are heavy. Crack them with nearby pops.",
    colors: ["red", "blue", "cream", "green"],
    goal: 9,
    time: 100,
    damping: 1.3,
    population: 22,
    wildChance: 0.05,
    sodaChance: 0,
    gobstoppers: 2,
    stars: [7500, 12500],
  },
  {
    id: 4,
    name: "Fizz Factory",
    blurb: "Shake a Fizzy Soda hard to make it burst.",
    colors: ["yellow", "violet", "pink", "brown", "orange"],
    goal: 8,
    time: 100,
    damping: 1.2,
    population: 26,
    wildChance: 0.05,
    sodaChance: 0.05,
    gobstoppers: 1,
    stars: [9000, 15000],
  },
  {
    id: 5,
    name: "Chaos Chamber",
    blurb: "Slippery air and every special at once.",
    colors: ["red", "blue", "green", "peach", "violet"],
    goal: 10,
    time: 110,
    damping: 0.9,
    population: 28,
    wildChance: 0.06,
    sodaChance: 0.06,
    gobstoppers: 2,
    stars: [12000, 20000],
  },
];
