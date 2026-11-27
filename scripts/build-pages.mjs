import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync
} from "node:fs";
import path from "node:path";

const root = process.cwd();
const output = path.join(root, "dist");

if (!existsSync(path.join(root, "index.html"))) {
  throw new Error("Run this build from the MiraculousHub repository root.");
}

const skipDirectories = new Set([
  ".git",
  ".github",
  ".wrangler",
  "node_modules",
  "dist",
  "tests",
  "scripts",
  "android-phone",
  "windows-app"
]);

const skipNames = new Set([
  ".gitignore",
  ".gitattributes",
  ".DS_Store",
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "CLOUDFLARE-PAGES-SETUP.txt",
  "README.txt"
]);

const maxPagesAssetBytes = 25 * 1024 * 1024;
const oversizedAssets = [];

function shouldSkipFile(name) {
  const lower = name.toLowerCase();

  if (skipNames.has(name)) return true;
  if (/^wrangler.*\.toml$/.test(lower)) return true;
  if (/^cloudflare-.*worker.*\.js$/.test(lower)) return true;
  if (/service[-_]?account|private[-_]?key|credentials/i.test(name)) return true;
  if (/\.(?:md|txt|toml|log|map|pem|key|crt|p12|pfx)$/i.test(name)) return true;
  if (/^\.env(?:\.|$)/i.test(name) || lower === ".dev.vars") return true;

  return false;
}

function copyTree(sourceDir, targetDir, relativeDir = "") {
  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const relativePath = path.posix.join(relativeDir, entry.name);
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isSymbolicLink()) continue;

    if (entry.isDirectory()) {
      if (skipDirectories.has(entry.name)) continue;
      mkdirSync(targetPath, { recursive: true });
      copyTree(sourcePath, targetPath, relativePath);
      continue;
    }

    if (!entry.isFile() || shouldSkipFile(entry.name)) continue;

    const size = statSync(sourcePath).size;
    if (size > maxPagesAssetBytes) {
      oversizedAssets.push({ path: relativePath, size });
    }

    copyFileSync(sourcePath, targetPath);
  }
}

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
copyTree(root, output);

console.log("MiraculousHub static site prepared in ./dist");
if (oversizedAssets.length) {
  console.warn("These files exceed the Cloudflare Pages 25 MiB single-asset limit:");
  for (const file of oversizedAssets) {
    console.warn("- " + file.path + " (" + (file.size / 1024 / 1024).toFixed(1) + " MiB)");
  }
  console.warn("Move oversized downloads to R2 and update their page links before deploying.");
}
