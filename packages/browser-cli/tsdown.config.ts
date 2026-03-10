import { defineConfig } from "tsdown";

export default defineConfig({
  clean: true,
  dts: true,
  entry: {
    index: "./src/index.ts",
    "browser-clid": "./src/browser-clid.ts",
  },
  format: ["esm"],
  outDir: "dist",
  platform: "node",
  sourcemap: true,
  target: "node20",
});
