import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

if (process.argv.includes("--clean-dist")) {
  for (const rel of [
    join("dist", "downloads"),
    join("android", "app", "src", "main", "assets", "public", "downloads"),
  ]) {
    const dir = join(root, rel);
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
      console.log("Cleaned", dir);
    }
  }
  process.exit(0);
}

const source = join(
  root,
  "android",
  "app",
  "build",
  "outputs",
  "apk",
  "debug",
  "app-debug.apk"
);
const destDir = join(root, "public", "downloads");
const distDestDir = join(root, "dist", "downloads");
const dest = join(destDir, "laundrymate.apk");

if (!existsSync(source)) {
  console.error("APK not found at:", source);
  process.exit(1);
}

mkdirSync(destDir, { recursive: true });
mkdirSync(distDestDir, { recursive: true });
copyFileSync(source, dest);
copyFileSync(source, join(distDestDir, "laundrymate.apk"));
console.log("Copied APK to", dest);

// Also split into 1.5 MB binary chunks (.bin) + manifest so Firebase Hosting
// Spark plan (which blocks .apk uploads) can serve the real APK directly from
// the same origin without external 404s.
const CHUNK_SIZE = 1536 * 1024; // 1.5 MB
const buf = readFileSync(source);
const totalChunks = Math.ceil(buf.length / CHUNK_SIZE);
const chunkNames = [];

for (let i = 0; i < totalChunks; i += 1) {
  const name = `apk-part-${i}.bin`;
  const slice = buf.subarray(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
  writeFileSync(join(destDir, name), slice);
  writeFileSync(join(distDestDir, name), slice);
  chunkNames.push(name);
}

// Clean up any leftover older chunks
for (let i = totalChunks; i < 20; i += 1) {
  for (const dir of [destDir, distDestDir]) {
    const extra = join(dir, `apk-part-${i}.bin`);
    if (existsSync(extra)) rmSync(extra);
  }
}

const manifestJson = JSON.stringify(
  {
    fileName: "LaundryMate.apk",
    size: buf.length,
    chunks: chunkNames,
    updatedAt: new Date().toISOString(),
  },
  null,
  2
);
writeFileSync(join(destDir, "apk-manifest.json"), manifestJson);
writeFileSync(join(distDestDir, "apk-manifest.json"), manifestJson);
console.log(
  `Generated ${totalChunks} APK chunks (${buf.length} bytes) in ${destDir} and ${distDestDir}`
);
