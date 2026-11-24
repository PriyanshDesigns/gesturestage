import { useState } from "react";

const KEY = "ishaara-diagnostics";

/** Whether the "what it sees" panel is on. Remembered in this browser. */
export function useDiagnostics(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(KEY) === "1" || new URLSearchParams(location.hash.split("?")[1]).has("debug");
    } catch {
      return false;
    }
  });
  const set = (v: boolean) => {
    setOn(v);
    try {
      localStorage.setItem(KEY, v ? "1" : "0");
    } catch {
      // Storage blocked: the setting lasts for this visit.
    }
  };
  return [on, set];
}
