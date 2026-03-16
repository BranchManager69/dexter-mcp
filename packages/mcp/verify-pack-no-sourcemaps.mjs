import { execFileSync } from "node:child_process";

const raw = execFileSync("npm", ["pack", "--dry-run", "--json"], {
  cwd: new URL(".", import.meta.url),
  encoding: "utf8",
});

const [packInfo] = JSON.parse(raw);
const files = Array.isArray(packInfo?.files) ? packInfo.files : [];
const sourcemaps = files
  .map((file) => file?.path)
  .filter((path) => typeof path === "string" && path.endsWith(".map"));

if (sourcemaps.length > 0) {
  console.error("Refusing to publish source maps in @dexterai/opendexter:");
  for (const file of sourcemaps) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

console.log("Pack verification passed: no source maps would be published.");
