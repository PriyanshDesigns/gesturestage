import type { Body } from "./physics";
import type { ColorId } from "./levels";

export interface Group {
  color: ColorId;
  members: Body[];
}

const TOUCH = 1.1;

function find(parent: number[], i: number): number {
  while (parent[i] !== i) {
    parent[i] = parent[parent[i]];
    i = parent[i];
  }
  return i;
}

// Groups of 3+ touching candies of one colour. A Wonka Bar (wild) joins any
// colour's group, but a group needs at least 2 real candies.
export function findGroups(bodies: Body[], colors: ColorId[]): Group[] {
  const live = bodies.filter((b) => !b.dead && (b.kind === "candy" || b.kind === "wild"));
  const n = live.length;
  const pairs: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = live[i];
    for (let j = i + 1; j < n; j++) {
      const b = live[j];
      if (a.kind === "wild" && b.kind === "wild") continue;
      if (a.kind === "candy" && b.kind === "candy" && a.color !== b.color) continue;
      const reach = (a.r + b.r) * TOUCH;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      if (dx * dx + dy * dy < reach * reach) pairs.push([i, j]);
    }
  }

  const groups: Group[] = [];
  for (const color of colors) {
    const parent = live.map((_, i) => i);
    const inColor = (b: Body) => b.kind === "wild" || b.color === color;
    for (const [i, j] of pairs) {
      if (!inColor(live[i]) || !inColor(live[j])) continue;
      parent[find(parent, i)] = find(parent, j);
    }
    const byRoot = new Map<number, Body[]>();
    live.forEach((b, i) => {
      if (!inColor(b)) return;
      const root = find(parent, i);
      const list = byRoot.get(root);
      if (list) list.push(b);
      else byRoot.set(root, [b]);
    });
    for (const members of byRoot.values()) {
      const real = members.filter((m) => m.kind === "candy").length;
      if (members.length >= 3 && real >= 2) groups.push({ color, members });
    }
  }
  return groups;
}
