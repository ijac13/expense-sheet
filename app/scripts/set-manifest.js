#!/usr/bin/env node
// Prebuild script: swaps in manifest.staging.json when NEXT_PUBLIC_APP_ENV=staging.
// Runs as "prebuild" in package.json so it executes before every `next build`.

const fs = require("fs");
const path = require("path");

// Load .env.local manually (Next.js reads it; Node prebuild scripts don't)
const envLocalPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envLocalPath)) {
  fs.readFileSync(envLocalPath, 'utf8')
    .split('\n')
    .forEach(line => {
      const [key, ...rest] = line.split('=');
      if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
    });
}

const env = process.env.NEXT_PUBLIC_APP_ENV;
const publicDir = path.join(__dirname, "..", "public");
const manifestDest = path.join(publicDir, "manifest.json");

if (env === "staging") {
  const stagingManifest = path.join(publicDir, "manifest.staging.json");
  fs.copyFileSync(stagingManifest, manifestDest);
  console.log("[set-manifest] Staging build — copied manifest.staging.json → manifest.json");
} else {
  console.log("[set-manifest] Production build — manifest.json unchanged");
}
