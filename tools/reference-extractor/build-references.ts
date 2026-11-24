/**
 * Turns raw landmarks (from the extractor page) into public/ishaara/templates.json.
 *
 *   npx tsx tools/reference-extractor/build-references.ts <data dir>
 *
 * Per letter: keep samples with the usual number of hands, orient each sample
 * consistently (a left-handed signer, or a swapped hand label, mirrors it),
 * drop outliers, keep the most typical samples, then report how well each
 * letter is told apart from the rest (leave-one-signer-photo-out).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { classify, shapeDistance, toPose, DEFAULT_MATCH_SETTINGS, type HandSide, type Pt, type Template, type TrackedHand } from "../../src/isl/pose";

interface Raw {
  letter: string;
  file: string;
  width: number;
  height: number;
  pass: string;
  hands: TrackedHand[];
}

const dataDir = resolve(process.argv[2] ?? "data");
const outPath = resolve(import.meta.dirname, "../../public/ishaara/templates.json");
const KEEP = 10;
const round = (n: number) => Math.round(n * 1e4) / 1e4;

const raw: Raw[] = JSON.parse(readFileSync(resolve(dataDir, "landmarks.json"), "utf8"));

// Skip photos the dataset padded in as duplicates (manifest: language,class,index,…,is_padded_duplicate).
const padded = new Set<string>();
try {
  const [header, ...rows] = readFileSync(resolve(dataDir, "manifest.csv"), "utf8").trim().split(/\r?\n/);
  const cols = header.split(",");
  const [iLang, iClass, iIndex, iPad] = ["language", "class", "index", "is_padded_duplicate"].map((c) => cols.indexOf(c));
  for (const row of rows) {
    const c = row.split(",");
    if (c[iLang] === "English" && /^true$/i.test(c[iPad])) padded.add(`${c[iClass]}/${c[iIndex]}`);
  }
  console.log(`${padded.size} padded duplicates in the English set`);
} catch {
  console.warn("No manifest.csv; duplicates not filtered.");
}
const isPadded = (r: Raw) => padded.has(`${r.letter}/${r.file.split("/").pop()?.replace(".jpg", "")}`);

const swap = (h: TrackedHand): TrackedHand => ({ ...h, side: h.side === "Right" ? "Left" : "Right" });

/** A mirror image of the photo: what a left-handed signer's photo looks like right-handed. */
const mirrorPhoto = (hands: TrackedHand[]): TrackedHand[] =>
  hands.map((h) => ({ ...swap(h), landmarks: h.landmarks.map((p) => ({ ...p, x: 1 - p.x })) }));

/** Ways a sample could be oriented: as labelled or labels swapped, each as-is or mirrored. */
function variants(r: Raw): Template[] {
  const aspect = r.width / r.height;
  const out: Template[] = [];
  const labelled = r.hands.length === 2 ? [r.hands, r.hands.map(swap)] : [r.hands];
  for (const hands of labelled.flatMap((h) => [h, mirrorPhoto(h)])) {
    const pose = toPose(hands, "Right", aspect);
    if (!pose) continue;
    out.push({ id: r.file, letter: r.letter, sides: pose.sides.length === 1 ? ["Right"] : pose.sides, points: pose.points });
  }
  return out;
}

function medoid(list: Template[]) {
  let best = list[0];
  let bestSum = Infinity;
  for (const a of list) {
    const s = list.reduce((acc, b) => acc + shapeDistance(a.points, b.points), 0);
    if (s < bestSum) [best, bestSum] = [a, s];
  }
  return best;
}

const letters = [...new Set(raw.map((r) => r.letter))].sort();
const kept: Template[] = [];
const report: string[] = [];

for (const letter of letters) {
  const all = raw.filter((r) => r.letter === letter);
  const fresh = all.filter((r) => !isPadded(r) && r.hands.length > 0);
  const counts = [1, 2].map((n) => fresh.filter((r) => r.hands.length === n).length);
  const handCount = counts[1] >= counts[0] ? 2 : 1;
  const usable = fresh.filter((r) => r.hands.length === handCount);
  const options = usable.map(variants).filter((v) => v.length);

  // Start from the as-labelled shapes, then let each sample take whichever
  // orientation agrees best with the letter's typical shape.
  let chosen = options.map((v) => v[0]);
  for (let iter = 0; iter < 4; iter++) {
    const m = medoid(chosen);
    chosen = options.map((v) => v.reduce((a, b) => (shapeDistance(b.points, m.points) < shapeDistance(a.points, m.points) ? b : a)));
  }
  const m = medoid(chosen);
  const dists = chosen.map((t) => shapeDistance(t.points, m.points));
  const sorted = [...dists].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const limit = Math.max(0.3, median * 2.5);
  const inliers = chosen.map((t, i) => ({ t, d: dists[i] })).filter((x) => x.d <= limit).sort((a, b) => a.d - b.d);
  const take = inliers.slice(0, KEEP).map((x) => x.t);
  take.forEach((t, i) =>
    kept.push({ id: `${letter}-${i + 1}`, letter, sides: t.sides as HandSide[], points: t.points.map((p: Pt) => ({ x: round(p.x), y: round(p.y), z: round(p.z) })) })
  );
  report.push(
    `${letter}: ${all.length} photos, ${all.length - fresh.length} padded/no-hand, ${handCount}-handed (${counts[0]} one / ${counts[1]} two), ${inliers.length} consistent, kept ${take.length}, median spread ${median.toFixed(2)}`
  );
}

// Leave-one-out: classify each kept sample against all other samples.
const confusions: Record<string, Record<string, number>> = {};
let right = 0;
let wrong = 0;
for (const t of kept) {
  const others = kept.filter((o) => o !== t);
  const m = classify({ sides: t.sides, points: t.points }, others, DEFAULT_MATCH_SETTINGS);
  if (m.accepted === t.letter) right++;
  else if (m.accepted) {
    wrong++;
    (confusions[t.letter] ??= {})[m.accepted] = ((confusions[t.letter] ??= {})[m.accepted] ?? 0) + 1;
  }
}

console.log(report.join("\n"));
console.log(`\nLeave-one-out over ${kept.length} samples: right ${((100 * right) / kept.length).toFixed(1)}%, wrong ${((100 * wrong) / kept.length).toFixed(1)}%, unknown ${((100 * (kept.length - right - wrong)) / kept.length).toFixed(1)}%`);
console.log("Confusions:", JSON.stringify(confusions));

const set = {
  version: 1,
  dominant: "Right",
  signer: "Hambir et al. (2026), VIT Pune",
  credit: {
    text: "Reference shapes extracted from “A Multimodal Indian Sign Language Dataset for English and Marathi Alphabets” by S. Hambir, A. Khandagale, J. Santosh, V. Gaikwad, R. Kadam, V. Mishra, G. Kaur, G. Y. Bobhate, G. Tejani and D. Bassir (Mendeley Data, 2026), CC BY 4.0. Landmarks re-extracted with MediaPipe Hand Landmarker; not yet reviewed by a Deaf ISL signer.",
    url: "https://doi.org/10.17632/2tj6c7pzfk.1",
    license: "CC BY 4.0",
  },
  templates: kept,
};
writeFileSync(outPath, JSON.stringify(set));
console.log(`\nWrote ${kept.length} templates for ${letters.length} letters to ${outPath} (${(JSON.stringify(set).length / 1024).toFixed(0)} KB)`);
