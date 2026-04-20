/**
 * Seed the 22 default categories into the Categories tab.
 *
 * HOW TO USE:
 * 1. Open the Google Spreadsheet
 * 2. Extensions → Apps Script
 * 3. Paste this entire file
 * 4. Click Run → seedCategories
 * 5. Approve permissions when prompted
 *
 * Safe to run multiple times — checks if data already exists before inserting.
 */

function seedCategories() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Categories");

  if (!sheet) {
    sheet = ss.insertSheet("Categories");
  }

  // Check if headers already exist
  const firstCell = sheet.getRange(1, 1).getValue();
  if (!firstCell) {
    // Write headers
    const headers = ["id", "name_en", "name_zh", "icon", "sort_order", "is_active"];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }

  // Check if data already exists
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    Logger.log("Categories tab already has data (" + (lastRow - 1) + " rows). Skipping seed.");
    SpreadsheetApp.getUi().alert("Categories tab already has " + (lastRow - 1) + " categories. No changes made.");
    return;
  }

  // 22 default categories
  const categories = [
    ["cat_001", "Eating Out",        "外食",   "🍜", 1,  true],
    ["cat_002", "Daily Necessities", "日用品", "🧴", 2,  true],
    ["cat_003", "Groceries",         "食材",   "🥬", 3,  true],
    ["cat_004", "Medical",           "醫療",   "🏥", 4,  true],
    ["cat_005", "Travel",            "旅遊",   "✈️", 5,  true],
    ["cat_006", "Transportation",    "交通",   "🚌", 6,  true],
    ["cat_007", "Digital",           "數位",   "💻", 7,  true],
    ["cat_008", "Babies",            "寶貝",   "👶", 8,  true],
    ["cat_009", "Clothing",          "衣服",   "👕", 9,  true],
    ["cat_010", "Sports",            "運動",   "🏃", 10, true],
    ["cat_011", "Gifts",             "禮物",   "🎁", 11, true],
    ["cat_012", "Tuition",           "學費",   "📚", 12, true],
    ["cat_013", "Tolls",             "過路",   "🛣️", 13, true],
    ["cat_014", "Equipment",         "設備",   "🔧", 14, true],
    ["cat_015", "Fuel",              "加油",   "⛽", 15, true],
    ["cat_016", "Entertainment",     "娛樂",   "🎬", 16, true],
    ["cat_017", "Rent",              "房租",   "🏠", 17, true],
    ["cat_018", "Shopping",          "購物",   "🛒", 18, true],
    ["cat_019", "Car Repair",        "修車",   "🚗", 19, true],
    ["cat_020", "Donate",            "捐款",   "💝", 20, true],
    ["cat_021", "Mortgage",          "房貸",   "🏡", 21, true],
    ["cat_022", "Other",             "其他",   "📦", 22, true],
  ];

  sheet.getRange(2, 1, categories.length, 6).setValues(categories);

  // Auto-resize columns for readability
  sheet.autoResizeColumns(1, 6);

  Logger.log("Seeded " + categories.length + " categories.");
  SpreadsheetApp.getUi().alert("✅ Seeded " + categories.length + " categories into the Categories tab.");
}
