/**
 * Migration script: assign gov_category to all 22 DEFAULT_CATEGORIES in Firestore.
 *
 * Idempotent: categories that already have gov_category set are skipped.
 *
 * Usage:
 *   npx ts-node --project tsconfig.json scripts/migrate-gov-category.ts
 *
 * Requires env vars:
 *   FIREBASE_PROJECT_ID
 *   GOOGLE_APPLICATION_CREDENTIALS  (path to a service account JSON file)
 */

import { initializeApp, cert, getApps, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { GovCategory } from "../app/lib/categories";

const GOV_CATEGORY_DEFAULTS: Record<string, GovCategory> = {
  "eating-out": "restaurants_accommodation",
  "daily-necessities": "furnishings_household",
  "groceries": "food_beverage_tobacco",
  "medical": "health",
  "travel": "recreation_culture_education",
  "transportation": "transport_communication",
  "digital": "transport_communication",
  "babies": "miscellaneous",
  "clothing": "clothing_footwear",
  "sports": "recreation_culture_education",
  "gifts": "miscellaneous",
  "tuition": "recreation_culture_education",
  "tolls": "transport_communication",
  "equipment": "furnishings_household",
  "fuel": "transport_communication",
  "entertainment": "recreation_culture_education",
  "rent": "housing_utilities",
  "shopping": "miscellaneous",
  "car-repair": "transport_communication",
  "donate": "miscellaneous",
  "mortgage": "housing_utilities",
  "other": "miscellaneous",
};

async function run() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    console.error("FIREBASE_PROJECT_ID env var is required");
    process.exit(1);
  }

  if (!getApps().length) {
    const credential = process.env.GOOGLE_APPLICATION_CREDENTIALS
      ? cert(process.env.GOOGLE_APPLICATION_CREDENTIALS as string)
      : applicationDefault();
    initializeApp({
      credential,
      projectId,
    });
  }

  const db = getFirestore();
  const categoriesRef = db.collection("categories");
  const snapshot = await categoriesRef.get();

  let updated = 0;
  let skipped = 0;
  let unknown = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const id = doc.id;

    if (data.gov_category) {
      skipped++;
      console.log(`[skip]    ${id} — already has gov_category: ${data.gov_category}`);
      continue;
    }

    const govCategory = GOV_CATEGORY_DEFAULTS[id];
    if (!govCategory) {
      unknown++;
      console.warn(`[unknown] ${id} — not in default mapping, skipping`);
      continue;
    }

    await doc.ref.update({ gov_category: govCategory });
    updated++;
    console.log(`[updated] ${id} → ${govCategory}`);
  }

  console.log(`\nDone. updated=${updated}, skipped=${skipped}, unknown=${unknown}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
