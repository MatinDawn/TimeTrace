const { getDefaultCategories, getCategoryMetaMap } = require("./categories");
const { parseDateTime, parseDateId, formatDateTime } = require("./date");
const { buildScopedStorageKey, getCurrentUserId, getCurrentScope } = require("./session");

const RECORD_KEY = "liuhen-records-v2";
const CATEGORY_KEY = "liuhen-categories-v1";
const GOAL_KEY = "liuhen-annual-goals-v1";
const TEMP_RECORD_KEY = "liuhen-temp-record-v1";
const LEGACY_RECORD_KEY = "ledger-records-v1";

function safeRead(key, fallback) {
  try {
    const value = wx.getStorageSync(key);
    return value === "" || value === undefined || value === null ? fallback : value;
  } catch (error) {
    return fallback;
  }
}

function safeWrite(key, value) {
  wx.setStorageSync(key, value);
}

function readScoped(baseKey, fallback, migrateBaseValue) {
  const scopedKey = buildScopedStorageKey(baseKey);
  const scopedValue = safeRead(scopedKey, undefined);
  if (scopedValue !== "" && scopedValue !== undefined && scopedValue !== null) {
    return scopedValue;
  }

  const scope = getCurrentScope();
  if (scope.mode === "personal") {
    const legacyUserKey = `${baseKey}:${getCurrentUserId()}`;
    const legacyUserValue = safeRead(legacyUserKey, undefined);
    if (legacyUserValue !== "" && legacyUserValue !== undefined && legacyUserValue !== null) {
      safeWrite(scopedKey, legacyUserValue);
      return legacyUserValue;
    }
  }

  if (migrateBaseValue) {
    const sharedValue = safeRead(baseKey, undefined);
    if (sharedValue !== "" && sharedValue !== undefined && sharedValue !== null) {
      safeWrite(scopedKey, sharedValue);
      return sharedValue;
    }
  }

  return fallback;
}

function writeScoped(baseKey, value) {
  safeWrite(buildScopedStorageKey(baseKey), value);
}

function buildCreatedAt(value) {
  return value || new Date().toISOString();
}

function buildCreatedAtDisplay(value) {
  return formatDateTime(value);
}

function getSortTimestamp(record) {
  const actionDate = parseDateId(record.recordTime || "");
  const createdAt = parseDateTime(record.createdAt || new Date().toISOString());
  return new Date(
    actionDate.getFullYear(),
    actionDate.getMonth(),
    actionDate.getDate(),
    createdAt.getHours(),
    createdAt.getMinutes(),
    createdAt.getSeconds()
  ).getTime();
}

function sortByActionTime(a, b) {
  const diff = getSortTimestamp(b) - getSortTimestamp(a);
  if (diff !== 0) {
    return diff;
  }
  return parseDateTime(b.updatedAt || b.createdAt).getTime() - parseDateTime(a.updatedAt || a.createdAt).getTime();
}

function normalizeRecord(record, categoryMap) {
  const categories = categoryMap || getCategoryMetaMap(getCategories());
  const categoryId = record.categoryId || record.category || "other";
  const categoryName = record.categoryName || (categories[categoryId] ? categories[categoryId].name : "\u5176\u4ed6");
  const recordType = record.recordType || (record.status && record.status !== "done" ? "plan" : "done");
  const amount = Number(record.amount || 0);
  const budgetAmount = Number(record.budgetAmount || 0);
  const createdAt = buildCreatedAt(record.createdAt);

  return {
    id: record.id,
    originalContent: record.originalContent || record.rawText || "",
    recordType,
    categoryId,
    categoryName,
    actionName: record.actionName || record.note || "\u672a\u547d\u540d\u7559\u75d5",
    description: record.description || "",
    durationQuantity: record.durationQuantity || "",
    amount,
    direction: record.direction || (categoryId === "income" ? "income" : "expense"),
    currency: record.currency || "CNY",
    attachmentURLs: Array.isArray(record.attachmentURLs) ? record.attachmentURLs : [],
    locationInfo: record.locationInfo || "",
    recordTime: record.recordTime || record.date || "",
    createdAt,
    createdAtDisplay: buildCreatedAtDisplay(createdAt),
    updatedAt: record.updatedAt || createdAt,
    isDraft: Boolean(record.isDraft),
    draftSource: record.draftSource || record.source || "text",
    dueDate: record.dueDate || "",
    dueTime: record.dueTime || "",
    priority: record.priority || "low",
    status: recordType === "plan" ? (record.status || "todo") : "done",
    subTasks: Array.isArray(record.subTasks) ? record.subTasks : [],
    budgetAmount,
    reminderEnabled: Boolean(record.reminderEnabled),
    reminderTime: record.reminderTime || "",
    source: record.source || "local"
  };
}

function migrateLegacyRecords() {
  const legacyRecords = safeRead(LEGACY_RECORD_KEY, []);
  if (!Array.isArray(legacyRecords) || !legacyRecords.length) {
    return [];
  }

  const categoryMap = getCategoryMetaMap(getCategories());
  const migrated = legacyRecords.map((item) =>
    normalizeRecord(
      {
        id: item.id || `legacy_${Date.now()}`,
        originalContent: item.rawText || "",
        recordType: "done",
        categoryId: item.category || "other",
        categoryName: item.categoryLabel || "",
        actionName: item.note || item.categoryLabel || "\u5386\u53f2\u8bb0\u5f55",
        description: "",
        amount: Number(item.amount || 0),
        direction: item.direction || "expense",
        currency: "CNY",
        recordTime: item.date || "",
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.createdAt || new Date().toISOString(),
        isDraft: false,
        draftSource: "legacy",
        status: "done",
        source: item.source || "legacy-ledger"
      },
      categoryMap
    )
  );

  writeScoped(RECORD_KEY, migrated);
  return migrated;
}

function getRecords() {
  const categoryMap = getCategoryMetaMap(getCategories());
  const current = readScoped(RECORD_KEY, [], true);
  if (Array.isArray(current) && current.length) {
    return current.map((item) => normalizeRecord(item, categoryMap)).sort(sortByActionTime);
  }
  return migrateLegacyRecords().sort(sortByActionTime);
}

function saveRecords(records) {
  const normalized = (records || []).map((item) => normalizeRecord(item)).sort(sortByActionTime);
  writeScoped(RECORD_KEY, normalized);
  return normalized;
}

function getRecordById(recordId) {
  return getRecords().find((item) => item.id === recordId) || null;
}

function upsertRecord(record) {
  const records = getRecords();
  const existingIndex = records.findIndex((item) => item.id === record.id);
  const normalized = normalizeRecord(record);

  if (existingIndex >= 0) {
    records.splice(existingIndex, 1, normalized);
  } else {
    records.unshift(normalized);
  }

  return saveRecords(records);
}

function deleteRecords(recordIds) {
  const idSet = new Set(recordIds || []);
  const next = getRecords().filter((item) => !idSet.has(item.id));
  return saveRecords(next);
}

function getCategories() {
  const saved = readScoped(CATEGORY_KEY, [], true);
  if (!Array.isArray(saved) || !saved.length) {
    const defaults = getDefaultCategories();
    writeScoped(CATEGORY_KEY, defaults);
    return defaults;
  }

  return saved
    .map((item, index) => ({
      id: item.id,
      name: item.name,
      sortOrder: Number(item.sortOrder || index + 1),
      defaultAmount: Number(item.defaultAmount || 0),
      defaultReminderRule: item.defaultReminderRule || "",
      builtin: Boolean(item.builtin)
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function saveCategories(categories) {
  const next = (categories || [])
    .map((item, index) => ({
      id: item.id,
      name: item.name,
      sortOrder: Number(item.sortOrder || index + 1),
      defaultAmount: Number(item.defaultAmount || 0),
      defaultReminderRule: item.defaultReminderRule || "",
      builtin: Boolean(item.builtin)
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  writeScoped(CATEGORY_KEY, next);
  return next;
}

function saveCategory(category) {
  const categories = getCategories();
  const nextItem = {
    id: category.id || `category_${Date.now()}`,
    name: category.name,
    sortOrder: Number(category.sortOrder || categories.length + 1),
    defaultAmount: Number(category.defaultAmount || 0),
    defaultReminderRule: category.defaultReminderRule || "",
    builtin: Boolean(category.builtin)
  };
  const index = categories.findIndex((item) => item.id === nextItem.id);

  if (index >= 0) {
    categories.splice(index, 1, nextItem);
  } else {
    categories.push(nextItem);
  }

  return saveCategories(categories);
}

function deleteCategory(categoryId) {
  const next = getCategories().filter((item) => item.id !== categoryId || item.builtin);
  return saveCategories(next);
}

function getAnnualGoals() {
  return readScoped(GOAL_KEY, {}, true);
}

function getAnnualGoal(year) {
  const goals = getAnnualGoals();
  return Number(goals[String(year)] || 0);
}

function setAnnualGoal(year, amount) {
  const goals = getAnnualGoals();
  goals[String(year)] = Number(amount || 0);
  writeScoped(GOAL_KEY, goals);
  return goals;
}

function setTempRecord(record) {
  writeScoped(TEMP_RECORD_KEY, record || null);
  return record;
}

function getTempRecord() {
  return readScoped(TEMP_RECORD_KEY, null, true);
}

function clearTempRecord() {
  writeScoped(TEMP_RECORD_KEY, null);
}

module.exports = {
  getRecords,
  saveRecords,
  getRecordById,
  upsertRecord,
  deleteRecords,
  getCategories,
  saveCategories,
  saveCategory,
  deleteCategory,
  getAnnualGoal,
  setAnnualGoal,
  setTempRecord,
  getTempRecord,
  clearTempRecord
};
