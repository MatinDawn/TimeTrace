const {
  getRecords: getLocalRecords,
  getRecordById: getLocalRecordById,
  upsertRecord: upsertLocalRecord,
  deleteRecords: deleteLocalRecords,
  clearTempRecord
} = require("../../utils/store");
const { getToday, toDateId } = require("../../utils/date");
const {
  RECORD_TYPE,
  RECORD_STATUS,
  DIRECTION
} = require("../../utils/constants");
const {
  callBridge,
  isRemoteEnabled,
  buildScopePayload
} = require("./service-runtime");
const {
  getCategoryName,
  normalizeDirection,
  normalizeRemoteRecord
} = require("./record-normalizer");
const {
  mergeRemoteCacheRecord,
  invalidateRemoteCache
} = require("./record-cache");
const {
  getRecords,
  getRecordById
} = require("./record-read-service");
const { getDrafts } = require("./record-draft-service");

function buildPlanTraceCompletion(record, now, todayId) {
  const direction = normalizeDirection(record.direction);
  return {
    nextPlan: {
      ...record,
      status: RECORD_STATUS.DONE,
      updatedAt: now
    },
    traceRecord: {
      id: `trace_${Date.now()}`,
      originalContent: record.originalContent || record.actionName,
      recordType: RECORD_TYPE.DONE,
      categoryId: record.categoryId,
      categoryName: record.categoryName || getCategoryName(record.categoryId),
      actionName: record.actionName,
      description: record.description || "",
      durationQuantity: record.durationQuantity || "",
      amount: Number(record.amount || 0),
      direction,
      currency: record.currency || "CNY",
      attachmentURLs: record.attachmentURLs || [],
      locationInfo: record.locationInfo || "",
      recordTime: todayId,
      createdAt: now,
      updatedAt: now,
      isDraft: false,
      draftSource: "text",
      dueDate: "",
      dueTime: "",
      priority: "low",
      status: RECORD_STATUS.DONE,
      subTasks: [],
      budgetAmount: 0,
      reminderEnabled: false,
      reminderTime: "",
      source: "todo-quick-trace"
    }
  };
}

async function saveRecordDetail(payload) {
  const previous = await getRecordById(payload.id);
  const recordType = payload.recordType || (previous ? previous.recordType : RECORD_TYPE.DONE);
  const updatedAt = new Date().toISOString();
  const nextCategoryId = payload.categoryId || (previous ? previous.categoryId : "");
  const nextCategoryName =
    payload.categoryName ||
    (nextCategoryId ? getCategoryName(nextCategoryId) : "") ||
    (previous ? previous.categoryName : "");
  const nextRecordTime = payload.recordTime || (previous ? previous.recordTime : "");
  const nextRecord = {
    ...(previous || {}),
    ...payload,
    recordType,
    categoryId: nextCategoryId,
    categoryName: nextCategoryName,
    amount: Number(payload.amount || 0),
    budgetAmount: Number(payload.budgetAmount || 0),
    recordTime: nextRecordTime,
    updatedAt,
    createdAt: payload.createdAt || (previous ? previous.createdAt : updatedAt),
    isDraft: false,
    status: recordType === RECORD_TYPE.PLAN ? (payload.status || (previous ? previous.status : RECORD_STATUS.TODO)) : RECORD_STATUS.DONE,
    direction: normalizeDirection(payload.direction || (previous ? previous.direction : DIRECTION.EXPENSE))
  };

  if (!isRemoteEnabled()) {
    upsertLocalRecord(nextRecord);
    clearTempRecord();
    return nextRecord;
  }

  const data = await callBridge("upsertRecord", buildScopePayload({ record: nextRecord }));
  const normalized = normalizeRemoteRecord((data && data.record) || nextRecord);
  mergeRemoteCacheRecord(normalized);
  clearTempRecord();
  return normalized;
}

async function updatePlanStatus(recordId, status) {
  const record = await getRecordById(recordId);
  if (!record) {
    return null;
  }
  return saveRecordDetail({
    ...record,
    status
  });
}

async function completePlanWithTrace(recordId) {
  if (!isRemoteEnabled()) {
    const record = getLocalRecordById(recordId);
    if (!record) {
      return null;
    }
    const now = new Date().toISOString();
    const todayId = toDateId(getToday());
    const { nextPlan, traceRecord } = buildPlanTraceCompletion(record, now, todayId);
    upsertLocalRecord(nextPlan);
    upsertLocalRecord(traceRecord);
    return {
      plan: nextPlan,
      trace: traceRecord
    };
  }

  try {
    const data = await callBridge("completePlanWithTrace", buildScopePayload({
      recordId,
      today: toDateId(getToday())
    }));
    invalidateRemoteCache();
    return data;
  } catch (error) {
    const record = getLocalRecordById(recordId);
    if (!record) {
      return null;
    }
    const now = new Date().toISOString();
    const todayId = toDateId(getToday());
    const { nextPlan, traceRecord } = buildPlanTraceCompletion(record, now, todayId);
    upsertLocalRecord(nextPlan);
    upsertLocalRecord(traceRecord);
    return {
      plan: nextPlan,
      trace: traceRecord
    };
  }
}

async function batchDeleteRecords(ids) {
  if (!isRemoteEnabled()) {
    return deleteLocalRecords(ids);
  }
  await callBridge("deleteRecords", buildScopePayload({
    recordIds: ids
  }));
  invalidateRemoteCache();
  return getDrafts();
}

async function batchUpdateCategory(ids, categoryId) {
  if (!isRemoteEnabled()) {
    const records = getLocalRecords();
    const next = records.map((item) => {
      if (ids.indexOf(item.id) === -1) {
        return item;
      }
      return {
        ...item,
        categoryId,
        categoryName: getCategoryName(categoryId),
        updatedAt: new Date().toISOString()
      };
    });
    next.forEach((item) => upsertLocalRecord(item));
    return next;
  }

  const drafts = (await getRecords(true)).filter((item) => item.isDraft && ids.indexOf(item.id) >= 0);
  const now = new Date().toISOString();
  for (const item of drafts) {
    await callBridge("upsertRecord", buildScopePayload({
      record: {
        ...item,
        categoryId,
        categoryName: getCategoryName(categoryId),
        updatedAt: now
      }
    }));
  }
  invalidateRemoteCache();
  return getDrafts();
}

module.exports = {
  saveRecordDetail,
  updatePlanStatus,
  completePlanWithTrace,
  batchDeleteRecords,
  batchUpdateCategory
};
