/**
 * Expense Tracker — Subscription Scheduler
 *
 * This Google Apps Script runs on a daily time-based trigger.
 * It checks the Subscriptions tab for any subscriptions due today
 * and automatically creates confirmed expense rows in the Expenses tab.
 *
 * Setup:
 * 1. Open your Google Spreadsheet
 * 2. Go to Extensions > Apps Script
 * 3. Paste this file contents
 * 4. Set up a daily time-driven trigger on the `runSubscriptionScheduler` function
 *
 * TODO (feature entity: subscription-scheduler):
 * - Read Subscriptions tab and filter active subscriptions
 * - Check if today matches due_day (and due_month for annual)
 * - For each due subscription, write a row to Expenses tab
 * - Generate a unique id for each created expense row
 * - Set created_by to the paid_by email, status to "confirmed"
 */

/**
 * Entry point — triggered daily by Apps Script time-based trigger.
 * Wire this function to a daily trigger in Apps Script project settings.
 */
function runSubscriptionScheduler() {
  // Scaffold only — logic added in subscription-scheduler entity
  Logger.log("Subscription scheduler triggered: " + new Date().toISOString());
}
