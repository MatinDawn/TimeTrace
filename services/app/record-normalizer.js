const { getCategories } = require("../../utils/store");
const { parseDateId, parseDateTime, formatDateTime } = require("../../utils/date");
const {
  RECORD_TYPE,
  RECORD_STATUS,
  AI_PARSE_STATUS,
  DIRECTION,
  PRIORITY
} = require("../../utils/constants");

function normalizeDirection(direction) {
  return String(direction || "").trim().toLowerCase() === DIRECTION.INCOME ? DIRECTION.INCOME : DIRECTION.EXPENSE;
}

function isExpenseRecord(record) {
  return !record.isDraft && record.recordType === RECORD_TYPE.DONE && Number(record.amount || 0) > 0 && normalizeDirection(record.direction) !== DIRECTION.INCOME;
}

function getCategoryName(categoryId) {
  const matched = getCategories().find((item) => item.id === categoryId);
  return matched ? matched.name : "其他";
}

function getCategoryIdByName(categoryName) {
  const normalizedName = String(categoryName || "").trim().toLowerCase();
  const matched = getCategories().find((item) => {
    if (item.name === categoryName) {
      return true;
    }
    return String(item.name || "").trim().toLowerCase() === normalizedName;
  });
  return matched ? matched.id : "other";
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

function normalizeRemoteRecord(record) {
  const categoryName = record.categoryName || "";
  const createdAt = record.createdAt || new Date().toISOString();
  const recordType = record.recordType === RECORD_TYPE.PLAN ? RECORD_TYPE.PLAN : RECORD_TYPE.DONE;
  const categoryId = record.categoryId || (categoryName ? getCategoryIdByName(categoryName) : "");
  return {
    id: record.id,
    remoteRecordId: record.remoteRecordId || "",
    originalContent: record.originalContent || "",
    recordType,
    categoryId,
    categoryName,
    actionName: record.actionName || record.originalContent || "未命名留痕",
    description: record.description || "",
    durationQuantity: record.durationQuantity || "",
    amount: Number(record.amount || 0),
    direction: normalizeDirection(record.direction),
    currency: record.currency || "CNY",
    attachmentURLs: Array.isArray(record.attachmentURLs) ? record.attachmentURLs : [],
    locationInfo: record.locationInfo || "",
    recordTime: record.recordTime || "",
    createdAt,
    createdAtDisplay: record.createdAtDisplay || formatDateTime(createdAt),
    updatedAt: record.updatedAt || createdAt,
    isDraft: Boolean(record.isDraft),
    draftSource: record.draftSource || "text",
    createdLocalDate: record.createdLocalDate || "",
    lastTouchedLocalDate: record.lastTouchedLocalDate || "",
    dueDate: record.dueDate || "",
    dueTime: record.dueTime || "",
    priority: record.priority || PRIORITY.LOW,
    status: recordType === RECORD_TYPE.PLAN ? (record.status || RECORD_STATUS.TODO) : RECORD_STATUS.DONE,
    aiParseStatus: record.aiParseStatus || AI_PARSE_STATUS.PARSED,
    subTasks: Array.isArray(record.subTasks) ? record.subTasks : [],
    budgetAmount: Number(record.budgetAmount || 0),
    reminderEnabled: Boolean(record.reminderEnabled),
    reminderTime: record.reminderTime || "",
    source: record.source || "cloudbase"
  };
}

function filterByKeyword(records, keyword) {
  const normalized = String(keyword || "").trim().toLowerCase();
  if (!normalized) {
    return records;
  }
  return (records || []).filter((item) => {
    return [item.originalContent, item.actionName, item.description, item.categoryName]
      .join(" ")
      .toLowerCase()
      .includes(normalized);
  });
}

module.exports = {
  getCategoryName,
  getCategoryIdByName,
  normalizeDirection,
  isExpenseRecord,
  sortByActionTime,
  normalizeRemoteRecord,
  filterByKeyword
};
