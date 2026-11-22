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
const dest = join(destDir, "laundrymate.apk");

if (!existsSync(source)) {
  console.error("APK not found at:", source);
  process.exit(1);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(source, dest);
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
  chunkNames.push(name);
}

// Clean up any leftover older chunks
for (let i = totalChunks; i < 20; i += 1) {
  const extra = join(destDir, `apk-part-${i}.bin`);
  if (existsSync(extra)) rmSync(extra);
}

writeFileSync(
  join(destDir, "apk-manifest.json"),
  JSON.stringify(
    {
      fileName: "LaundryMate.apk",
      size: buf.length,
      chunks: chunkNames,
      updatedAt: new Date().toISOString(),
    },
    null,
    2
  )
);
console.log(
  `Generated ${totalChunks} APK chunks (${buf.length} bytes) in ${destDir}`
);
