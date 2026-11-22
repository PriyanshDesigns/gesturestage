import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import "./isl.css";
import IslTestApp from "./IslTestApp";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <IslTestApp />
  </StrictMode>
);
