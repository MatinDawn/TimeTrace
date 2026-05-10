const { getTempRecord, setTempRecord } = require("../../utils/store");
const {
  RECORD_TYPE,
  AI_PARSE_STATUS
} = require("../../utils/constants");
const {
  callBridge,
  isRemoteEnabled,
  buildScopePayload,
  sleep
} = require("./service-runtime");
const {
  normalizeRemoteRecord,
  filterByKeyword
} = require("./record-normalizer");
const {
  fetchRecords,
  mergeRemoteCacheRecord
} = require("./record-cache");

async function getRecords(forceRefresh) {
  return fetchRecords(Boolean(forceRefresh));
}

async function getRecordById(recordId, forceRefresh) {
  if (isRemoteEnabled()) {
    if (!forceRefresh) {
      const tempRecord = getTempRecord();
      if (tempRecord && tempRecord.id === recordId) {
        return normalizeRemoteRecord(tempRecord);
      }
    }

    const records = await fetchRecords(false);
    const cachedRecord = records.find((item) => item.id === recordId);
    if (cachedRecord && !forceRefresh) {
      return cachedRecord;
    }

    const data = await callBridge("getRecordById", buildScopePayload({ recordId }));
    if (data.record) {
      const normalized = normalizeRemoteRecord(data.record);
      mergeRemoteCacheRecord(normalized);
      const tempRecord = getTempRecord();
      if (tempRecord && tempRecord.id === recordId) {
        setTempRecord({
          ...normalized,
          source: tempRecord.source || normalized.source
        });
      }
      return normalized;
    }
  }

  const records = await fetchRecords(Boolean(forceRefresh));
  return records.find((item) => item.id === recordId) || null;
}

async function waitForRemoteDraftParsed(recordId, options) {
  const settings = {
    timeoutMs: options && options.timeoutMs ? options.timeoutMs : 8000,
    interval: options && options.interval ? options.interval : 1000
  };

  let latest = await getRecordById(recordId, true);
  if (!latest) {
    return null;
  }

  if (!isRemoteEnabled()) {
    return latest;
  }

  const deadline = Date.now() + settings.timeoutMs;
  while (Date.now() < deadline) {
    if ((latest.aiParseStatus || AI_PARSE_STATUS.PARSED) !== AI_PARSE_STATUS.PENDING) {
      return latest;
    }
    await sleep(settings.interval);
    latest = await getRecordById(recordId, true);
    if (!latest) {
      return null;
    }
  }

  return latest;
}

async function getReminderItems() {
  return (await getRecords()).filter((item) => item.recordType === RECORD_TYPE.PLAN && !item.isDraft && item.reminderEnabled);
}

async function searchRecords(keyword) {
  return filterByKeyword((await getRecords()).filter((item) => !item.isDraft), keyword || "");
}

module.exports = {
  getRecords,
  getRecordById,
  waitForRemoteDraftParsed,
  getReminderItems,
  searchRecords
};
