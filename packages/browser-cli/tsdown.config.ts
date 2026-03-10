import { defineConfig } from "tsdown";

export default defineConfig({
  clean: true,
  dts: true,
  entry: {
    index: "./src/index.ts",
    aibrowserd: "./src/aibrowserd.ts",
  },
  format: ["esm"],
  outDir: "dist",
  platform: "node",
  sourcemap: true,
  target: "node20",
});
