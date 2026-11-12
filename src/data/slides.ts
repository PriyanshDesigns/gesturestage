export interface Slide {
  id: string;
  title: string;
  body: string[];
  accent: string;
  chart?: boolean;
}

export const slides: Slide[] = [
  {
    id: "intro",
    title: "GestureStage",
    body: ["Control your presentation with your hands.", "No clicker. No laptop trackpad. Just gestures."],
    accent: "#7c6cf0",
  },
  {
    id: "problem",
    title: "The problem",
    body: [
      "Reaching for a clicker breaks eye contact with the room.",
      "A clicker can't point at a detail or zoom into a diagram.",
    ],
    accent: "#2bb3a3",
  },
  {
    id: "gestures",
    title: "Five gestures, one vocabulary",
    body: [
      "Swipe → next / previous slide",
      "Point → laser pointer",
      "Pinch + drag → zoom",
      "Fist, held → blank the screen",
    ],
    accent: "#e0a23c",
  },
  {
    id: "point-target",
    title: "Try pointing here",
    body: ["Point your index finger at the dot below to test the laser pointer."],
    accent: "#e05c5c",
  },
  {
    id: "chart",
    title: "Try zooming into this chart",
    body: ["Pinch your thumb and index finger together, then drag up to zoom in."],
    accent: "#4c8bf5",
    chart: true,
  },
  {
    id: "closing",
    title: "Thank you",
    body: ["Hold a fist to blank the screen for questions.", "GestureStage — present with your hands free."],
    accent: "#7c6cf0",
  },
];
