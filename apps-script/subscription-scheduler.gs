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
 * 4. In Script Properties, set SPREADSHEET_ID to your spreadsheet's ID
 * 5. Set up a daily time-driven trigger on the `runSubscriptionScheduler` function
 */

/**
 * Entry point — triggered daily by Apps Script time-based trigger.
 * Wire this function to a daily trigger in Apps Script project settings.
 */
function runSubscriptionScheduler() {
  var ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'));
  var subsSheet = ss.getSheetByName('Subscriptions');
  var expSheet = ss.getSheetByName('Expenses');
  var today = new Date();
  var todayDay = today.getDate();
  var todayMonth = today.getMonth() + 1;
  var lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  var data = subsSheet.getDataRange().getValues();
  var headers = data[0];
  function col(name) { return headers.indexOf(name); }
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (row[col('is_active')] !== true) continue;
    var freq = row[col('frequency')];
    var dueDay = Math.min(Number(row[col('due_day')]), lastDay);
    var fires = false;
    if (freq === 'monthly') fires = todayDay === dueDay;
    else if (freq === 'annual') fires = todayMonth === Number(row[col('due_month')]) && todayDay === dueDay;
    if (!fires) continue;
    var expHeaders = expSheet.getDataRange().getValues()[0];
    var newRow = new Array(expHeaders.length).fill('');
    function set(name, val) { var idx = expHeaders.indexOf(name); if (idx >= 0) newRow[idx] = val; }
    set('id', Utilities.getUuid());
    set('created_at', new Date().toISOString());
    set('created_by', row[col('paid_by')]);
    set('paid_by', row[col('paid_by')]);
    set('amount', row[col('amount')]);
    set('category_id', row[col('category_id')]);
    set('notes', row[col('name')]);
    set('subscription_id', row[col('id')]);
    set('status', 'confirmed');
    set('date', Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd'));
    expSheet.appendRow(newRow);
  }
}
