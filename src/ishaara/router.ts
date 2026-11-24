import { useEffect, useState } from "react";

export interface Route {
  name: "home" | "learn" | "spell" | "practice" | "progress" | "teach";
  params: URLSearchParams;
}

const NAMES: Route["name"][] = ["home", "learn", "spell", "practice", "progress", "teach"];

function parse(hash: string): Route {
  const [path, query = ""] = hash.replace(/^#\/?/, "").split("?");
  const name = NAMES.find((n) => n === path) ?? "home";
  return { name, params: new URLSearchParams(query) };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parse(location.hash));
      window.scrollTo(0, 0);
    };
    addEventListener("hashchange", onChange);
    return () => removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export function go(path: string) {
  location.hash = `#/${path === "home" ? "" : path}`;
}

export function learnRoute(letters: string[], title: string) {
  return `learn?${new URLSearchParams({ l: letters.join(""), t: title })}`;
}
