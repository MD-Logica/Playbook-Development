const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");

execSync("npx next build", { stdio: "inherit", cwd: ROOT });

if (fs.existsSync(DIST)) {
  fs.rmSync(DIST, { recursive: true });
}
fs.mkdirSync(DIST, { recursive: true });

const standaloneDir = path.join(ROOT, ".next", "standalone");
if (!fs.existsSync(path.join(standaloneDir, "server.js"))) {
  console.error("Standalone server.js not found. Check next.config output: 'standalone'");
  process.exit(1);
}

execSync(`cp -r "${standaloneDir}/." "${DIST}/"`, { stdio: "inherit" });

const staticSrc = path.join(ROOT, ".next", "static");
const staticDest = path.join(DIST, ".next", "static");
if (fs.existsSync(staticSrc)) {
  fs.mkdirSync(path.dirname(staticDest), { recursive: true });
  execSync(`cp -r "${staticSrc}" "${staticDest}"`, { stdio: "inherit" });
}

const publicSrc = path.join(ROOT, "public");
const publicDest = path.join(DIST, "public");
if (fs.existsSync(publicSrc)) {
  execSync(`cp -r "${publicSrc}" "${publicDest}"`, { stdio: "inherit" });
}

const serverContent = `const path = require("path");
process.env.PORT = process.env.PORT || "5000";
process.env.HOSTNAME = "0.0.0.0";
process.chdir(__dirname);
require("./server.js");
`;

fs.writeFileSync(path.join(DIST, "index.cjs"), serverContent);

console.log("Build complete. dist/index.cjs created with standalone server.");
