const { createDraftFromInput } = require("../../utils/parser");
const {
  upsertRecord: upsertLocalRecord,
  setTempRecord,
  getTempRecord,
  clearTempRecord
} = require("../../utils/store");
const {
  RECORD_STATUS,
  AI_PARSE_STATUS
} = require("../../utils/constants");
const {
  callBridge,
  isRemoteEnabled,
  buildScopePayload
} = require("./service-runtime");
const {
  getCategoryName,
  normalizeRemoteRecord,
  filterByKeyword
} = require("./record-normalizer");
const { mergeRemoteCacheRecord } = require("./record-cache");
const {
  getRecords,
  getRecordById
} = require("./record-read-service");

function createPrefilledRecord(text, source) {
  const parsed = createDraftFromInput(text, source);
  const prefilled = {
    ...parsed,
    categoryName: getCategoryName(parsed.categoryId),
    isDraft: false,
    source: "quick-record-prefill"
  };
  setTempRecord(prefilled);
  return prefilled;
}

function getAudioFormat(filePath) {
  const matched = String(filePath || "").toLowerCase().match(/\.([a-z0-9]+)(?:\?|$)/);
  const format = matched && matched[1] ? matched[1] : "mp3";
  return ["mp3", "m4a", "wav", "pcm"].includes(format) ? format : "mp3";
}

function uploadVoiceFile(filePath) {
  return new Promise((resolve, reject) => {
    const format = getAudioFormat(filePath);
    wx.cloud.uploadFile({
      cloudPath: `voice-input/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${format}`,
      filePath,
      success: resolve,
      fail: reject
    });
  });
}

function deleteCloudFile(fileID) {
  if (!fileID || !wx.cloud || !wx.cloud.deleteFile) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    wx.cloud.deleteFile({
      fileList: [fileID],
      complete: resolve
    });
  });
}

async function recognizeVoiceInput(filePath) {
  if (!isRemoteEnabled()) {
    throw new Error("cloud-unavailable");
  }

  const format = getAudioFormat(filePath);
  const uploadRes = await uploadVoiceFile(filePath);
  const fileID = uploadRes.fileID;
  try {
    const data = await callBridge("recognizeVoice", buildScopePayload({
      fileID,
      format
    }), { maxRetries: 0 });
    return {
      text: String(data.text || "").trim()
    };
  } finally {
    deleteCloudFile(fileID);
  }
}

async function createRemoteDraftFromInput(text, source) {
  const content = String(text || "").trim();
  const draftId = `record_${Date.now()}`;

  if (!isRemoteEnabled()) {
    const parsed = createDraftFromInput(content, source);
    const localDraft = {
      ...parsed,
      id: draftId,
      categoryName: getCategoryName(parsed.categoryId),
      isDraft: true,
      status: RECORD_STATUS.DRAFT,
      aiParseStatus: AI_PARSE_STATUS.PARSED,
      source: "local-draft"
    };
    upsertLocalRecord(localDraft);
    return localDraft;
  }

  const data = await callBridge("createDraftRecord", buildScopePayload({
    id: draftId,
    originalContent: content,
    source: source || "text"
  }));
  const draft = normalizeRemoteRecord(data.record || {});
  setTempRecord({
    ...draft,
    source: "remote-draft-prefill"
  });
  mergeRemoteCacheRecord(draft);
  return draft;
}

function getPrefilledRecord() {
  return getTempRecord();
}

function clearPrefilledRecord() {
  clearTempRecord();
}

function savePrefilledAsDraft(payload) {
  const draft = {
    ...payload,
    categoryName: getCategoryName(payload.categoryId || "other"),
    isDraft: true,
    updatedAt: new Date().toISOString(),
    source: "detail-edit-autosave"
  };
  upsertLocalRecord(draft);
  clearTempRecord();
  return draft;
}

async function updateRemoteDraftParse(recordId, patch) {
  if (!isRemoteEnabled()) {
    return null;
  }
  const current = await getRecordById(recordId);
  if (!current) {
    throw new Error("record-not-found");
  }
  const nextRecord = {
    ...current,
    ...patch,
    id: current.id,
    status: RECORD_STATUS.DRAFT,
    isDraft: true,
    aiParseStatus: patch.aiParseStatus || AI_PARSE_STATUS.PARSED,
    updatedAt: new Date().toISOString()
  };
  const data = await callBridge("upsertRecord", buildScopePayload({ record: nextRecord }));
  const normalized = normalizeRemoteRecord((data && data.record) || nextRecord);
  mergeRemoteCacheRecord(normalized);
  setTempRecord({
    ...normalized,
    source: current.source || normalized.source
  });
  return normalized;
}

async function getDrafts(keyword) {
  const drafts = (await getRecords()).filter((item) => item.isDraft);
  if (!keyword) {
    return drafts;
  }
  return filterByKeyword(drafts, keyword);
}

module.exports = {
  createPrefilledRecord,
  recognizeVoiceInput,
  createRemoteDraftFromInput,
  getPrefilledRecord,
  clearPrefilledRecord,
  savePrefilledAsDraft,
  updateRemoteDraftParse,
  getDrafts
};
