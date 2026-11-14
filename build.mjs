import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
await build({
  absWorkingDir: root,
  entryPoints: ["src/entry.tsx"],
  outfile: path.join(root, "app.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  jsx: "automatic",
  minify: true,
  legalComments: "eof",
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  logLevel: "info",
});
console.log(
  "Built app.js. Run node scripts/demo.mjs and open http://localhost:3000.",
);
