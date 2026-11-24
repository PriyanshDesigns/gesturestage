/** An open right hand, palm facing the viewer; `flip` makes it a left hand. */
export function HandIcon({ flip = false, size = 44 }: { flip?: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden
      style={{ transform: flip ? "scaleX(-1)" : undefined }}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 26V10.5a2.5 2.5 0 0 1 5 0V23" />
      <path d="M22 22V7.5a2.5 2.5 0 0 1 5 0V22" />
      <path d="M27 22V9.5a2.5 2.5 0 0 1 5 0V24" />
      <path d="M32 24v-9.5a2.5 2.5 0 0 1 5 0V30c0 7.7-5.6 13-12.5 13-4.4 0-7.6-2-10.2-5.6L9.2 29.6a2.6 2.6 0 0 1 4-3.3L17 30" />
    </svg>
  );
}
