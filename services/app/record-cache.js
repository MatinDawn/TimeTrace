const { getRecords: getLocalRecords } = require("../../utils/store");
const { REMOTE_CACHE_TTL } = require("../../utils/constants");
const { callBridge, buildScopePayload, isRemoteEnabled, withRemoteFallback } = require("./service-runtime");
const { normalizeRemoteRecord, sortByActionTime } = require("./record-normalizer");

const remoteCache = {
  records: null,
  expiresAt: 0
};

function invalidateRemoteCache() {
  remoteCache.records = null;
  remoteCache.expiresAt = 0;
}

function mergeRemoteCacheRecord(record) {
  if (!remoteCache.records || !record || !record.id) {
    return;
  }
  const normalized = normalizeRemoteRecord(record);
  const next = remoteCache.records.filter((item) => item.id !== normalized.id);
  next.unshift(normalized);
  remoteCache.records = next.sort(sortByActionTime);
}

async function fetchRemoteRecords(forceRefresh) {
  if (!isRemoteEnabled()) {
    throw new Error("remote-disabled");
  }
  if (!forceRefresh && remoteCache.records && remoteCache.expiresAt > Date.now()) {
    return remoteCache.records;
  }

  const data = await callBridge("listRecords", buildScopePayload());
  const records = (data.records || []).map(normalizeRemoteRecord).sort(sortByActionTime);
  remoteCache.records = records;
  remoteCache.expiresAt = Date.now() + REMOTE_CACHE_TTL;
  return records;
}

async function fetchRecords(forceRefresh) {
  return withRemoteFallback(
    () => fetchRemoteRecords(forceRefresh),
    () => getLocalRecords().sort(sortByActionTime)
  );
}

module.exports = {
  invalidateRemoteCache,
  mergeRemoteCacheRecord,
  fetchRecords
};
