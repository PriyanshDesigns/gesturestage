# Wonka's Zero-G Candy Lab — game design

A match-3 with no grid. Candies float in a zero-gravity chamber; your hands, tracked by the webcam, are the only thing that can move them. Herd 3+ same-colour candies into contact and they pop.

Play: `npm run dev` → `/zerog/`. A mouse works as a stand-in hand.

---

## 1. Fantasy & screen

Wonka's mixing chamber: a glass box with a striped frame, full of floating candy. Your hand reaches in through the camera.

Portrait stage, laid out like the Game UI mockup (402 × 874 design units, scaled to fit the window height):

| Region | Asset | Shows |
|---|---|---|
| Header | `ui/header.png`, `ui/mascot.png`, `ui/progress.png` style bar | Score, star-progress bar, **time left** (pink box; replaces "moves"), pause |
| Chamber | `ui/candy-bg.png` frame, `ui/choc-grid.png` floor | The physics arena |
| Basket | `ui/basket.png` | One column per goal colour. Popped candies fly here and stack up. The bin on top shows the count left. |
| Footer | `ui/footer.png`, `ui/icon-button.png`, `powerups/p1-3.png` | Settings + 3 power-ups with counts |
| Popup | `popup/*`, `ui/btn*.png` | Stars, score, retry / next |

On wide screens the camera preview and a gesture cheat-sheet sit beside the stage, over the blurred background.

## 2. Controls

### Hand (webcam, up to 2 hands at once)

| Pose | In the chamber | Why it feels right |
|---|---|---|
| **Open palm** | **Sweep.** The palm is a solid paddle (candies bounce off it) plus a soft wind field that carries nearby candies the way the hand moves. Slow hand = nudge, fast swipe = shove. | Pushing things around with your hand |
| **Pinch** | **Grab + colour magnet.** Picks up the single candy nearest your fingers on a taffy strand. Carry it through the crowd: same-colour candies (and Wonka Bars) it touches stick to the bunch, up to 3. A held bunch of 3 pops in your hand. Open the pinch to let go; candies keep the hand's momentum, so you can throw them. | Picking up a candy |
| **Fist** | **Freeze.** Strongly damps everything near the fist. Stops a cluster drifting apart before it pops. | Clenching to hold still |
| **Point** | **Cursor.** It does nothing in the chamber, which is the safe pose for reaching the buttons. Hover a button (power-ups, pause, menus) for 0.8 s to press it. | Pointing at something |

Two hands work independently. Typical moves: hold a pair with a pinch and sweep the third in with the other palm, or freeze one side while you sweep the other.

Input processing:
- Palm centre = mean of the wrist and the four finger bases. Pinch uses the thumb–index midpoint; point uses the index tip.
- The central 70 % × 76 % of the camera frame maps onto the chamber, so you never have to reach the frame edge.
- A One-Euro filter smooths position (less jitter when slow, less lag when fast). Velocity comes from the filtered position.
- Pose hysteresis: a new pose must hold for about 60 ms before it switches. Pinch starts below 0.33 and ends above 0.45 (in hand-size units), so a grab does not drop mid-carry.

### Mouse / keyboard fallback
Moving the mouse sweeps · left-drag grabs · right-drag freezes · `1` `2` `3` use power-ups · `P`/`Esc` pause · `R` retry.

## 3. Physics

- World = a 1000 × 1000 square inside the frame. Fixed 120 Hz step with an accumulator.
- Candies are circles (r ≈ 44). Mass 1; a gobstopper weighs 6.
- Circle–circle collisions with positional correction and restitution 0.55. Walls bounce at 0.7.
- **Zero-g air:** exponential damping (level setting, 0.9–1.6 /s) plus a tiny random drift, so the box slowly settles but never looks frozen.
- Speed cap of 2600 u/s keeps hard swipes readable.
- Popping applies an outward impulse to nearby candies. It scales with cluster size, which is what makes chain reactions happen.

## 4. Matching

- Each step, same-colour candies whose gap is under 10 % of their radii count as touching. Union-find groups them.
- A group of **3+** lights up and starts a **0.3 s fuse**. If it stays together that long, it pops; if it breaks apart, the fuse resets. The glow tells you to hold the group still, and it stops random bounce-contacts from scoring.
- The Wonka Bar is a wildcard. It joins any colour's group, but a group needs at least 2 real candies.

### Scoring
`points = 60 × n × (1 + 0.5 × (n − 3)) × combo`
- **Combo:** each pop within 2 s of the previous one raises the multiplier by 1 (×2, ×3 …).
- End of level: + 40 per second left.
- Stars: ★ for completing the goals, then ★★ / ★★★ at the level's score thresholds. The header bar fills toward ★★★.

## 5. Special candies (from the original Wonka game art)

| Candy | Behaviour |
|---|---|
| **Wonka Bar** (`candy_bar`) | Wildcard in any group. Popping it reveals a **Golden Ticket**: + 8 s and double points for 6 s. |
| **Fizzy Soda** (`candy_soda`) | **Shake it to blow it.** Moving it fast builds fizz (shown as a ring); a resting soda goes flat. At full fizz it bursts and pops every candy in a big radius (they count toward goals). |
| **Gobstopper** (`candy_gobstopper`) | Heavy obstacle that barely moves for a sweep; a grab or a two-hand push shifts it. Three pops next to it crack it: + 500. |

## 6. Power-ups (2 of each per level)

| Icon | Power-up | Effect |
|---|---|---|
| ↺ `p1` | **Swirl** | 3 s vortex around the centre. Stirs the whole box and pulls slightly inward, so new contacts form. |
| 🎁 `p2` | **Surprise Box** | Drops in 1 Wonka Bar and 2 Fizzy Sodas. |
| 💛 `p3` | **Sweet Tooth** | 5 s in which same-colour candies attract each other. Clusters form on their own. |

Activate one by pointing at it and holding for 0.8 s, or by clicking or pressing its number key.

## 7. Levels

The goal is to pop N of each listed colour before the timer runs out. Candies trickle in from the top of the chamber to keep the box at its population. New colours are weighted toward the goals you still need.

| # | Name | Colours | Goal | Time | Damping | New thing |
|---|---|---|---|---|---|---|
| 1 | First Float | 3 | 6 each | 90 s | high | Hint banners teach sweep → grab → freeze |
| 2 | Golden Hunt | 4 | 8 each | 90 s | high | Wonka Bars |
| 3 | Jawbreakers | 4 | 9 each | 100 s | medium | Gobstoppers |
| 4 | Fizz Factory | 5 | 8 each | 100 s | medium | Fizzy Soda |
| 5 | Chaos Chamber | 5 | 10 each | 110 s | low (slippery) | Everything |

Lose = time runs out: the popup offers retry. Win = stars, score, retry / next. Stars are saved per level, and each level unlocks the next.

## 8. Feedback / juice
- Group glow and a fuse ring before a pop. Pop = a scale-up flash, sprinkle particles, and floating `+points ×combo` text.
- Popped goal candies fly into their basket column and stack.
- On-screen hand: a soft ring sized to the field. Cyan = sweep, pink with taffy strands = grab, icy blue = freeze, small dot = poke.
- Synthesised WebAudio sound effects: the pop pitch rises with the combo, plus fizz hiss, ticket chime, win and lose jingles. Mute in settings.

## 9. Code map (`src/zerog/`)

| File | Role |
|---|---|
| `physics.ts` | Bodies, the 120 Hz step, collisions, walls |
| `match.ts` | Union-find touching groups |
| `game.ts` | Game state: spawning, hand forces, fuses/pops, scoring, specials, power-ups, win/lose |
| `hands.ts` | Landmarks → filtered hand inputs (pose hysteresis, One-Euro, mapping to the chamber) |
| `useCamera.ts` | Webcam + MediaPipe (2 hands) loop |
| `render.ts` | Canvas drawing of the chamber |
| `DwellCursor.tsx` | Point-and-hold UI clicking |
| `App.tsx` + `screens/` | Home, level select, game HUD, popups, settings |
| `levels.ts`, `assets.ts`, `sfx.ts`, `storage.ts` | Data and helpers |

Reused from the existing project: `src/mediapipe/handLandmarker.ts` and `src/gesture/classifier.ts`.

## 10. Later
- Endless mode with a rising spawn rate.
- Use the remaining Wonka art (fudge, lolly, gum) as more specials, e.g. sticky gum that glues candies together.
- Depth (`z`) as a "press" gesture: push your palm toward the camera to make a shockwave.
- Phone build: touch-only controls with the same physics.

## Asset note
`fonts/chunky-playful.otf` is licensed **for personal use only**. Buy a licence, or swap in a free display font, before using it commercially. Cherry Bomb One is OFL (free).
