import * as functions from "firebase-functions";

// Firebase Functions entry point for Expense Tracker
// Features will be added in subsequent entities:
// - Google Sheets read/write
// - AI category suggestion
// - Auth token validation
// - Subscription scheduler trigger

export const helloWorld = functions.https.onRequest((request, response) => {
  response.json({ status: "ok", app: "expense-tracker" });
});
