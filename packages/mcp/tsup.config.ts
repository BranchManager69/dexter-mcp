import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    target: "node18",
    outDir: "dist",
    clean: true,
    dts: false,
    splitting: false,
    sourcemap: true,
    banner: { js: "#!/usr/bin/env node" },
  },
  {
    entry: ["src/wallet/vanity-worker.ts"],
    format: ["esm"],
    target: "node18",
    outDir: "dist/wallet",
    clean: false,
    dts: false,
    splitting: false,
    sourcemap: false,
    banner: {},
  },
]);
