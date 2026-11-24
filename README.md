# GestureStage

**Live demo:** https://gesturestage.vercel.app
**Repo:** https://github.com/PriyanshDesigns/gesturestage

Control a presentation with hand gestures, read live through your laptop's
webcam in the browser — next/previous slide, a laser pointer, pinch-to-zoom,
and blanking the screen. No clicker, no install, no video ever leaves the
device.

Built as the working-MVP deliverable for a UX case study on gesture-based
interaction. The full case study (research, personas, journey map, gesture
rationale, usability test plan) is a separate Claude-authored doc; the Figma
file covers the design system and the screens this MVP doesn't build out
(onboarding, calibration, settings, session summary all exist in both code
and Figma).

## Running it

```bash
npm install
npm run dev
```

Open the printed `localhost` URL in a recent Chrome with a webcam. Grant
camera access when prompted.

```bash
npm run build    # type-checks and produces a production build in dist/
```

## Gesture vocabulary

Every gesture starts and ends from an open, relaxed hand — that's the only
way the system can tell where one gesture stops and the next begins.

| Gesture | Action |
| --- | --- |
| Swipe hand left → right | Next slide |
| Swipe hand right → left | Previous slide |
| Point with index finger | Laser pointer follows your fingertip |
| Pinch thumb + index, drag up/down | Zoom in / out |
| Closed fist, held ~1s | Blank / unblank the screen |

The keyboard (arrow keys, `B` to blank, `Esc` for settings) always works —
gestures are an addition, never the only way in.

## How it works

```
Webcam → Hand Tracker (MediaPipe) → Classifier → Dispatcher → Slides / Pointer / Zoom overlays
```

- **`src/mediapipe/handLandmarker.ts`** — loads Google's MediaPipe Tasks
  Vision Hand Landmarker (runs on-device, WASM/WebGL).
- **`src/gesture/classifier.ts`** — turns 21 raw hand landmarks into a pose
  per frame (`ready`, `point`, `pinch`, `fist`, `unknown`) using landmark
  geometry (which fingers are extended, fingertip distances).
- **`src/gesture/engine.ts`** — turns a stream of poses into discrete,
  debounced `GestureEvent`s (swipes, pointer moves, zoom deltas, blank
  toggles).
- **`src/hooks/useHandTracking.ts`** — wires a webcam stream + the
  landmarker + the engine into a React hook, and samples frame brightness
  for the calibration screen's lighting check.
- **`src/components/`** — the five screens: Landing, Onboarding,
  Calibration, Live Control (the main demo deck + overlays), Settings, and
  Session Summary.

## Known limits (lean MVP)

- Gesture recognition accuracy drops in low light — the calibration screen
  warns about this but doesn't compensate for it.
- Single-hand only; no multi-user or two-hand gestures.
- The demo slide deck is hardcoded (`src/data/slides.ts`), not a real
  PDF/PPTX import.

## Design

Figma file (design system + all 6 screens):
https://www.figma.com/design/GPcLrYXQdwyzxsI13RsrlB

## Ishaara — ISL fingerspelling tutor

**Live:** https://gesturestage.vercel.app/ishaara/ · code in `src/ishaara/`

Learn the Indian Sign Language alphabet with live feedback from the webcam.
Gestures are the content being learned, not commands, so there's no Midas
Touch problem.

- **Onboarding** — your name (the first word you'll sign) and dominant hand.
  Left-handed learners get mirrored references automatically.
- **Learn** — five lessons. Each letter shows the reference shape, draws it as
  a dotted guide pinned to your own wrist on the camera, names the finger to
  fix, and confirms once the shape is held for half a second.
- **Spell** — sign your name (or any word) start to finish, from memory, timed.
- **Practice** — spaced repetition (Leitner boxes): letters signed from memory
  move up, skipped or guided ones come back sooner.
- **Progress** — every letter's memory level, accuracy and time to the right shape.
- **Reference signs** — record each letter (5 samples) as a fluent signer forms
  it, credit the signer, and export/import the set.

**Reference signs aren't included.** Recognition compares learners to
recordings by a fluent ISL signer, and none ship yet — the case study requires
Deaf signers to record and review them. Until then, record them on the
Reference signs screen (stored in your browser), or import a file. To ship a
set to everyone, export it and save it as `public/ishaara/templates.json`.

## Ishaara — two-hand recognition test

A feasibility test for the next concept, an Indian Sign Language fingerspelling
tutor. ISL fingerspelling uses both hands, often touching or overlapping, which
is where webcam hand tracking is weakest. This page measures whether a laptop
webcam can track and tell apart two-handed letters before any lessons are built.

Run `npm run dev` and open `/isl-test.html` in Chrome with a webcam.

**Protocol**

1. From an ISL alphabet chart (or with a fluent ISL signer, which is better),
   pick about six letters: two with the hands apart, two touching, two overlapping.
2. In *Record letters*, record 5 samples of each.
3. In *Measure*, run the 10-second test for each letter and tag how the hands
   relate (apart / touching / overlapping). Repeat in a dim room.
4. Download the CSV.

**Reading the result.** A group passes when both hands are tracked in ≥95% of
frames, the right letter is recognised in ≥90%, and a wrong letter in <5%.

- *Touching* and *overlapping* pass → the concept is technically viable.
- They fail on **Tracked** → the tracker loses hands when they meet; that's a
  tracking limit (try camera angle and lighting before anything else).
- Tracked is fine but **Right** is low → the matcher needs tuning; adjust the
  sliders in *Live check* or record more samples.

The matching logic lives in `src/isl/pose.ts`. On synthetic two-hand data it
told apart letters differing by a single finger 100% of the time with
realistic camera noise, and gave no wrong answers; under heavy noise it falls
back to "unknown" rather than guessing. Synthetic data can't model hands
hiding each other, which is what the webcam test is for.
