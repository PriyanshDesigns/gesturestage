import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// Dev-only tool: runs MediaPipe Hand Landmarker over a folder of photos in the
// browser (the same model and normalisation the app uses) and saves raw
// landmarks. Usage: see README in this folder.
const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(process.env.ISL_DATA_DIR ?? resolve(here, "data"));

export default defineConfig({
  root: here,
  define: { __DATA_DIR__: JSON.stringify(dataDir) },
  server: { port: 5180, fs: { allow: [resolve(here, "../.."), dataDir] } },
  plugins: [
    {
      name: "save-landmarks",
      configureServer(server) {
        server.middlewares.use("/save", (req, res) => {
          let body = "";
          req.on("data", (c) => (body += c));
          req.on("end", () => {
            const out = resolve(dataDir, "landmarks.json");
            mkdirSync(dirname(out), { recursive: true });
            writeFileSync(out, body);
            res.end(`saved ${body.length} bytes`);
          });
        });
      },
    },
  ],
});
