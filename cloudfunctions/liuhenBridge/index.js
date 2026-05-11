const cloud = require("wx-server-sdk");
const crypto = require("crypto");
const https = require("https");
const config = require("./config");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

const COLLECTIONS = {
  users: "liuhen_users",
  spaces: "liuhen_spaces",
  members: "liuhen_space_members",
  records: "liuhen_records"
};
const RECORD_PAGE_SIZE = 100;
const ASR_HOST = "asr.tencentcloudapi.com";
const ASR_SERVICE = "asr";
const ASR_ACTION = "SentenceRecognition";
const ASR_VERSION = "2019-06-14";
const ASR_MAX_AUDIO_SIZE = 5 * 1024 * 1024;

function nowIso() {
  return new Date().toISOString();
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function toDateId(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromDateLike(value) {
  if (!value) {
    return null;
  }
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : new Date(time);
}

function normalizeDirection(direction) {
  return String(direction || "").trim().toLowerCase() === "income" ? "income" : "expense";
}

function sha256(message) {
  return crypto.createHash("sha256").update(message, "utf8").digest("hex");
}

function hmacSha256(key, message, encoding) {
  return crypto.createHmac("sha256", key).update(message, "utf8").digest(encoding);
}

function getConfigValue(envName, configName, fallback) {
  return String(process.env[envName] || config[configName] || fallback || "").trim();
}

function getAsrConfig() {
  return {
    secretId: getConfigValue("TENCENTCLOUD_SECRET_ID", "asrSecretId", ""),
    secretKey: getConfigValue("TENCENTCLOUD_SECRET_KEY", "asrSecretKey", ""),
    region: getConfigValue("TENCENTCLOUD_ASR_REGION", "asrRegion", "ap-guangzhou"),
    engineModelType: getConfigValue("TENCENTCLOUD_ASR_ENGINE", "asrEngineModelType", "16k_zh")
  };
}

function postTencentCloudApi(action, payload, asrConfig) {
  return new Promise((resolve, reject) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
    const requestBody = JSON.stringify(payload);
    const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${ASR_HOST}\nx-tc-action:${action.toLowerCase()}\n`;
    const signedHeaders = "content-type;host;x-tc-action";
    const canonicalRequest = [
      "POST",
      "/",
      "",
      canonicalHeaders,
      signedHeaders,
      sha256(requestBody)
    ].join("\n");
    const credentialScope = `${date}/${ASR_SERVICE}/tc3_request`;
    const stringToSign = [
      "TC3-HMAC-SHA256",
      timestamp,
      credentialScope,
      sha256(canonicalRequest)
    ].join("\n");
    const secretDate = hmacSha256(`TC3${asrConfig.secretKey}`, date);
    const secretService = hmacSha256(secretDate, ASR_SERVICE);
    const secretSigning = hmacSha256(secretService, "tc3_request");
    const signature = hmacSha256(secretSigning, stringToSign, "hex");
    const authorization = `TC3-HMAC-SHA256 Credential=${asrConfig.secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const req = https.request({
      method: "POST",
      hostname: ASR_HOST,
      path: "/",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json; charset=utf-8",
        Host: ASR_HOST,
        "X-TC-Action": action,
        "X-TC-Version": ASR_VERSION,
        "X-TC-Timestamp": timestamp,
        "X-TC-Region": asrConfig.region
      }
    }, (res) => {
      let raw = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        raw += chunk;
      });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(raw || "{}");
          if (parsed.Response && parsed.Response.Error) {
            const error = new Error(parsed.Response.Error.Code || "asr-request-failed");
            error.detail = JSON.stringify({
              error: parsed.Response.Error,
              requestId: parsed.Response.RequestId || "",
              action
            });
            reject(error);
            return;
          }
          resolve(parsed.Response || parsed);
        } catch (error) {
          error.detail = raw;
          reject(error);
        }
      });
    });

    req.on("error", reject);
    req.setTimeout(10000, () => {
      req.destroy(new Error("request-timeout"));
    });
    req.write(requestBody);
    req.end();
  });
}

function isExpenseRecord(record) {
  return !record.isDraft && record.recordType === "done" && Number(record.amount || 0) > 0 && normalizeDirection(record.direction) !== "income";
}

function getSessionIdentity() {
  const context = cloud.getWXContext ? cloud.getWXContext() : {};
  const openId = context.OPENID || "";
  const unionId = context.UNIONID || "";
  return {
    userId: openId || unionId || `anonymous_${Date.now()}`,
    openId,
    unionId
  };
}

async function ensureCollections() {
  if (typeof db.createCollection !== "function") {
    return;
  }
  for (const name of Object.values(COLLECTIONS)) {
    try {
      await db.createCollection(name);
    } catch (error) {
      const message = String(error.errMsg || error.message || "");
      if (!message.includes("already exists")) {
        // ignore bootstrap noise
      }
    }
  }
}

async function getUserDoc(userId) {
  const res = await db.collection(COLLECTIONS.users).where({ userId }).limit(1).get();
  return res.data[0] || null;
}

async function ensureUser(session) {
  const existing = await getUserDoc(session.userId);
  if (existing) {
    return existing;
  }
  const createdAt = nowIso();
  const data = {
    userId: session.userId,
    openId: session.openId,
    unionId: session.unionId,
    displayName: "",
    avatarUrl: "",
    activeSpaceId: "",
    createdAt,
    updatedAt: createdAt
  };
  const addRes = await db.collection(COLLECTIONS.users).add({ data });
  return {
    _id: addRes._id,
    ...data
  };
}

async function updateUser(userId, patch) {
  const user = await ensureUser({ userId, openId: "", unionId: "" });
  await db.collection(COLLECTIONS.users).doc(user._id).update({
    data: {
      ...patch,
      updatedAt: nowIso()
    }
  });
  return getUserDoc(userId);
}

async function getMemberships(userId) {
  const res = await db.collection(COLLECTIONS.members).where({
    userId,
    status: "active"
  }).get();
  return res.data || [];
}

async function getSpacesByIds(spaceIds) {
  if (!spaceIds.length) {
    return [];
  }
  const list = [];
  for (const spaceId of spaceIds) {
    const res = await db.collection(COLLECTIONS.spaces).where({
      spaceId,
      status: "active"
    }).limit(1).get();
    if (res.data[0]) {
      list.push(res.data[0]);
    }
  }
  return list;
}

function createInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function createSpaceId() {
  return `space_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

async function buildBootstrap(session) {
  await ensureCollections();
  const user = await ensureUser(session);
  const memberships = await getMemberships(session.userId);
  const spaces = await getSpacesByIds(memberships.map((item) => item.spaceId));
  const spaceMap = {};
  spaces.forEach((item) => {
    spaceMap[item.spaceId] = item;
  });

  const joinedSpaces = memberships
    .map((item) => {
      const space = spaceMap[item.spaceId];
      if (!space) {
        return null;
      }
      return {
        spaceId: space.spaceId,
        name: space.name,
        inviteCode: space.inviteCode,
        memberCount: Number(space.memberCount || 0),
        role: item.role || "member",
        isActive: user.activeSpaceId === space.spaceId
      };
    })
    .filter(Boolean);

  const activeSpace = joinedSpaces.find((item) => item.spaceId === user.activeSpaceId) || null;

  return {
    profile: {
      userId: user.userId,
      openId: user.openId || session.openId,
      unionId: user.unionId || session.unionId,
      displayName: user.displayName || "",
      avatarUrl: user.avatarUrl || "",
      activeSpaceId: activeSpace ? activeSpace.spaceId : "",
      source: "wechat"
    },
    activeSpace,
    spaces: joinedSpaces
  };
}

async function upsertUserProfile(session, payload) {
  await ensureCollections();
  const next = await updateUser(session.userId, {
    displayName: String(payload.displayName || "").trim(),
    avatarUrl: String(payload.avatarUrl || "").trim(),
    openId: session.openId,
    unionId: session.unionId
  });
  return {
    profile: {
      userId: next.userId,
      openId: next.openId || session.openId,
      unionId: next.unionId || session.unionId,
      displayName: next.displayName || "",
      avatarUrl: next.avatarUrl || "",
      activeSpaceId: next.activeSpaceId || "",
      source: "wechat"
    }
  };
}

async function findSpaceByInviteCode(inviteCode) {
  const res = await db.collection(COLLECTIONS.spaces).where({
    inviteCode,
    status: "active"
  }).limit(1).get();
  return res.data[0] || null;
}

async function findMembership(spaceId, userId) {
  const res = await db.collection(COLLECTIONS.members).where({
    spaceId,
    userId
  }).limit(1).get();
  return res.data[0] || null;
}

async function countActiveMembers(spaceId) {
  const res = await db.collection(COLLECTIONS.members).where({
    spaceId,
    status: "active"
  }).count();
  return res.total || 0;
}

async function assertSpaceAccess(spaceId, userId) {
  const member = await findMembership(spaceId, userId);
  if (!member || member.status !== "active") {
    throw new Error("space-access-denied");
  }
  return member;
}

async function createSpace(session, payload) {
  await ensureCollections();
  await ensureUser(session);

  const name = String(payload.name || "").trim();
  if (!name) {
    throw new Error("space-name-required");
  }

  let inviteCode = "";
  while (!inviteCode) {
    const candidate = createInviteCode();
    const exists = await findSpaceByInviteCode(candidate);
    if (!exists) {
      inviteCode = candidate;
    }
  }

  const createdAt = nowIso();
  const spaceId = createSpaceId();
  await db.collection(COLLECTIONS.spaces).add({
    data: {
      spaceId,
      name,
      inviteCode,
      ownerId: session.userId,
      maxMembers: 5,
      memberCount: 1,
      status: "active",
      createdAt,
      updatedAt: createdAt
    }
  });

  await db.collection(COLLECTIONS.members).add({
    data: {
      spaceId,
      userId: session.userId,
      role: "owner",
      status: "active",
      createdAt,
      updatedAt: createdAt
    }
  });

  await updateUser(session.userId, {
    activeSpaceId: spaceId
  });

  return buildBootstrap(session);
}

async function joinSpaceByCode(session, payload) {
  await ensureCollections();
  await ensureUser(session);

  const inviteCode = String(payload.inviteCode || "").trim().toUpperCase();
  if (!inviteCode) {
    throw new Error("invite-code-required");
  }

  const space = await findSpaceByInviteCode(inviteCode);
  if (!space) {
    throw new Error("space-not-found");
  }

  const existing = await findMembership(space.spaceId, session.userId);
  if (existing && existing.status === "active") {
    await updateUser(session.userId, {
      activeSpaceId: space.spaceId
    });
    return buildBootstrap(session);
  }

  const memberCount = await countActiveMembers(space.spaceId);
  if (memberCount >= 5) {
    throw new Error("space-member-limit");
  }

  const createdAt = nowIso();
  if (existing) {
    await db.collection(COLLECTIONS.members).doc(existing._id).update({
      data: {
        status: "active",
        updatedAt: createdAt
      }
    });
  } else {
    await db.collection(COLLECTIONS.members).add({
      data: {
        spaceId: space.spaceId,
        userId: session.userId,
        role: "member",
        status: "active",
        createdAt,
        updatedAt: createdAt
      }
    });
  }

  await db.collection(COLLECTIONS.spaces).where({
    spaceId: space.spaceId
  }).update({
    data: {
      memberCount: memberCount + 1,
      updatedAt: createdAt
    }
  });

  await updateUser(session.userId, {
    activeSpaceId: space.spaceId
  });

  return buildBootstrap(session);
}

async function switchActiveSpace(session, payload) {
  await ensureCollections();
  await ensureUser(session);

  const spaceId = String(payload.spaceId || "").trim();
  if (!spaceId) {
    await updateUser(session.userId, {
      activeSpaceId: ""
    });
    return buildBootstrap(session);
  }

  await assertSpaceAccess(spaceId, session.userId);
  await updateUser(session.userId, {
    activeSpaceId: spaceId
  });
  return buildBootstrap(session);
}

function getScopeFromPayload(payload) {
  return {
    activeSpaceId: String(payload.activeSpaceId || "").trim()
  };
}

function sanitizeRecordInput(record, existing) {
  const base = existing || {};
  const createdAt = record.createdAt || base.createdAt || nowIso();
  const updatedAt = nowIso();
  const nextType = record.recordType || base.recordType || "done";
  const nextStatusRaw = record.status || base.status || (nextType === "plan" ? "todo" : "done");
  const nextIsDraft = nextStatusRaw === "draft" || Boolean(record.isDraft);

  return {
    recordId: record.id || base.recordId || `record_${Date.now()}`,
    originalContent: String(record.originalContent || base.originalContent || "").trim(),
    recordType: nextType === "plan" ? "plan" : "done",
    categoryId: String(record.categoryId || base.categoryId || "").trim(),
    categoryName: String(record.categoryName || base.categoryName || "").trim(),
    actionName: String(record.actionName || base.actionName || "").trim(),
    description: String(record.description || base.description || "").trim(),
    durationQuantity: String(record.durationQuantity || base.durationQuantity || "").trim(),
    amount: Number(record.amount || base.amount || 0),
    direction: normalizeDirection(record.direction || base.direction || "expense"),
    currency: String(record.currency || base.currency || "CNY").trim() || "CNY",
    attachmentURLs: Array.isArray(record.attachmentURLs || base.attachmentURLs) ? (record.attachmentURLs || base.attachmentURLs) : [],
    locationInfo: String(record.locationInfo || base.locationInfo || "").trim(),
    recordTime: String(record.recordTime || base.recordTime || "").trim(),
    createdAt,
    updatedAt,
    isDraft: nextIsDraft,
    draftSource: String(record.draftSource || base.draftSource || "text").trim() || "text",
    dueDate: String(record.dueDate || base.dueDate || "").trim(),
    dueTime: String(record.dueTime || base.dueTime || "").trim(),
    priority: String(record.priority || base.priority || "low").trim() || "low",
    status: nextIsDraft ? "draft" : nextType === "plan" ? (nextStatusRaw || "todo") : "done",
    aiParseStatus: String(record.aiParseStatus || base.aiParseStatus || "parsed").trim() || "parsed",
    subTasks: Array.isArray(record.subTasks || base.subTasks) ? (record.subTasks || base.subTasks) : [],
    budgetAmount: Number(record.budgetAmount || base.budgetAmount || 0),
    reminderEnabled: Boolean(record.reminderEnabled !== undefined ? record.reminderEnabled : base.reminderEnabled),
    reminderTime: String(record.reminderTime || base.reminderTime || "").trim(),
    source: String(record.source || base.source || "cloudbase").trim() || "cloudbase"
  };
}

function normalizeRecord(doc) {
  if (!doc) {
    return null;
  }
  const createdAtDate = fromDateLike(doc.createdAt) || new Date();
  return {
    id: doc.recordId,
    remoteRecordId: doc._id || "",
    originalContent: doc.originalContent || "",
    recordType: doc.recordType || "done",
    categoryId: doc.categoryId || "",
    categoryName: doc.categoryName || "",
    actionName: doc.actionName || "",
    description: doc.description || "",
    durationQuantity: doc.durationQuantity || "",
    amount: Number(doc.amount || 0),
    direction: normalizeDirection(doc.direction),
    currency: doc.currency || "CNY",
    attachmentURLs: Array.isArray(doc.attachmentURLs) ? doc.attachmentURLs : [],
    locationInfo: doc.locationInfo || "",
    recordTime: doc.recordTime || "",
    createdAt: doc.createdAt || nowIso(),
    createdAtDisplay: doc.createdAt ? `${toDateId(createdAtDate)} ${pad(createdAtDate.getHours())}:${pad(createdAtDate.getMinutes())}:${pad(createdAtDate.getSeconds())}` : "",
    updatedAt: doc.updatedAt || doc.createdAt || nowIso(),
    isDraft: Boolean(doc.isDraft),
    draftSource: doc.draftSource || "text",
    dueDate: doc.dueDate || "",
    dueTime: doc.dueTime || "",
    priority: doc.priority || "low",
    status: doc.status || (doc.recordType === "plan" ? "todo" : "done"),
    aiParseStatus: doc.aiParseStatus || "parsed",
    subTasks: Array.isArray(doc.subTasks) ? doc.subTasks : [],
    budgetAmount: Number(doc.budgetAmount || 0),
    reminderEnabled: Boolean(doc.reminderEnabled),
    reminderTime: doc.reminderTime || "",
    source: doc.source || "cloudbase"
  };
}

function parseDateId(value) {
  const matched = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!matched) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  return new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]));
}

function parseDateIdStrict(value) {
  const matched = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!matched) {
    return null;
  }
  return new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]));
}

function addDays(date, amount) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function addYears(date, amount) {
  return new Date(date.getFullYear() + amount, 0, 1);
}

function startOfWeek(date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(date, diff);
}

function endOfWeek(date) {
  return addDays(startOfWeek(date), 6);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function groupAmountByCategory(records) {
  const totals = {};
  (records || []).forEach((item) => {
    const amount = Number(item.amount || 0);
    if (!amount) {
      return;
    }
    const key = item.categoryName || "\u5176\u4ed6";
    totals[key] = (totals[key] || 0) + amount;
  });
  return Object.keys(totals)
    .map((key) => ({ name: key, amount: Number(totals[key].toFixed(2)) }))
    .sort((a, b) => b.amount - a.amount);
}

function buildScopeInfo(granularity, anchorDateId, selectedYear) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const anchorDate = parseDateId(anchorDateId || toDateId(today));
  const year = Number(selectedYear || now.getFullYear());

  if (granularity === "day") {
    return {
      granularity,
      start: anchorDate,
      end: anchorDate,
      label: `${anchorDate.getMonth() + 1}\u6708${anchorDate.getDate()}\u65e5`,
      pickerText: toDateId(anchorDate)
    };
  }

  if (granularity === "week") {
    const start = startOfWeek(anchorDate);
    const end = endOfWeek(anchorDate);
    return {
      granularity,
      start,
      end,
      label: `${start.getMonth() + 1}/${start.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`,
      pickerText: `${start.getMonth() + 1}/${start.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`
    };
  }

  if (granularity === "month") {
    const start = startOfMonth(anchorDate);
    const end = endOfMonth(anchorDate);
    return {
      granularity,
      start,
      end,
      label: `${start.getFullYear()}\u5e74${start.getMonth() + 1}\u6708`,
      pickerText: `${start.getFullYear()}-${pad(start.getMonth() + 1)}`
    };
  }

  return {
    granularity: "year",
    start: new Date(year, 0, 1),
    end: new Date(year, 11, 31),
    label: `${year}\u5e74`,
    pickerText: `${year}\u5e74`
  };
}

function filterRecordsByDate(records, start, end, fieldName) {
  const startTime = start.getTime();
  const endTime = end.getTime();
  return (records || []).filter((item) => {
    const dateValue = item[fieldName] || item.recordTime || "";
    const date = parseDateIdStrict(dateValue);
    if (!date) {
      return false;
    }
    const time = date.getTime();
    return time >= startTime && time <= endTime;
  });
}

function buildTrend(records, granularity, anchorDateId, selectedYear) {
  const scope = buildScopeInfo(granularity, anchorDateId, selectedYear);
  const buckets = [];

  if (granularity === "day") {
    for (let index = 0; index < 7; index += 1) {
      const date = addDays(scope.end, index - 6);
      buckets.push({
        label: `${date.getMonth() + 1}/${date.getDate()}`,
        start: date,
        end: date
      });
    }
  } else if (granularity === "week") {
    for (let index = 0; index < 7; index += 1) {
      const end = addDays(scope.end, (index - 6) * 7);
      const start = addDays(end, -6);
      buckets.push({
        label: `${start.getMonth() + 1}/${start.getDate()}`,
        start,
        end
      });
    }
  } else if (granularity === "month") {
    for (let index = 0; index < 7; index += 1) {
      const current = new Date(scope.start.getFullYear(), scope.start.getMonth() + index - 6, 1);
      buckets.push({
        label: `${current.getMonth() + 1}\u6708`,
        start: new Date(current.getFullYear(), current.getMonth(), 1),
        end: new Date(current.getFullYear(), current.getMonth() + 1, 0)
      });
    }
  } else {
    for (let index = 0; index < 5; index += 1) {
      const year = scope.start.getFullYear() + index - 4;
      buckets.push({
        label: `${year}`,
        start: new Date(year, 0, 1),
        end: new Date(year, 11, 31)
      });
    }
  }

  const points = buckets.map((bucket) => {
    const amount = filterRecordsByDate(records, bucket.start, bucket.end, "recordTime").reduce((sum, item) => {
      if (item.direction === "income") {
        return sum;
      }
      return sum + Number(item.amount || 0);
    }, 0);
    return {
      label: bucket.label,
      amount: Number(amount.toFixed(2))
    };
  });

  const maxAmount = points.reduce((max, item) => Math.max(max, item.amount), 0) || 1;
  return points.map((item) => ({
    ...item,
    height: `${Math.max(8, Math.round((item.amount / maxAmount) * 100))}%`
  }));
}

async function listRecords(session, scope) {
  await ensureCollections();
  if (scope.activeSpaceId) {
    await assertSpaceAccess(scope.activeSpaceId, session.userId);
  }

  let query;
  if (scope.activeSpaceId) {
    query = {
      scopeType: "space",
      spaceId: scope.activeSpaceId
    };
  } else {
    query = {
      scopeType: "personal",
      ownerUserId: session.userId
    };
  }

  const all = await fetchAllByQuery(query);
  return all
    .map(normalizeRecord)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
}

async function fetchAllByQuery(query) {
  const all = [];
  let offset = 0;
  while (true) {
    const res = await db.collection(COLLECTIONS.records).where(query).skip(offset).limit(RECORD_PAGE_SIZE).get();
    const batch = res.data || [];
    all.push(...batch);
    if (batch.length < RECORD_PAGE_SIZE) {
      break;
    }
    offset += batch.length;
  }
  return all;
}

async function getHomeSummary(session, scope) {
  const records = await listRecords(session, scope);
  const todayId = toDateId(new Date());
  const todayCompleted = records.filter((item) => !item.isDraft && item.recordType === "done" && item.recordTime === todayId).slice(0, 10);
  const todayPlans = records.filter((item) => !item.isDraft && item.recordType === "plan" && item.status !== "done").slice(0, 10);
  return {
    draftCount: records.filter((item) => item.isDraft).length,
    todayRecordCount: records.filter((item) => !item.isDraft && item.recordTime === todayId).length,
    todayCompleted,
    todayPlans
  };
}

async function getTodoCalendarSummary(session, scope, payload) {
  const perfStart = Date.now();
  const traceId = `cal_${perfStart}_${Math.random().toString(36).slice(2, 6)}`;
  const stageMarks = [];
  const markStage = (label) => {
    const now = Date.now();
    const last = stageMarks.length ? stageMarks[stageMarks.length - 1].at : perfStart;
    stageMarks.push({ label, at: now, deltaMs: now - last });
  };

  console.log(`[perf][${traceId}] getTodoCalendarSummary.start`, {
    monthValue: payload && payload.monthValue,
    selectedDateId: payload && payload.selectedDateId,
    activeSpaceId: scope && scope.activeSpaceId,
    userId: session && session.userId
  });

  await ensureCollections();
  markStage("ensureCollections");
  if (scope.activeSpaceId) {
    await assertSpaceAccess(scope.activeSpaceId, session.userId);
    markStage("assertSpaceAccess");
  }

  const monthValue = String(payload.monthValue || toDateId(new Date())).slice(0, 7);
  const anchorMonth = parseDateId(`${monthValue}-01`);
  const monthStartId = `${monthValue}-01`;
  const monthEndId = toDateId(endOfMonth(anchorMonth));
  const todayId = toDateId(new Date());
  const selectedDateId = String(payload.selectedDateId || todayId).trim();

  const baseQuery = scope.activeSpaceId
    ? { scopeType: "space", spaceId: scope.activeSpaceId }
    : { scopeType: "personal", ownerUserId: session.userId };

  // 注意：建议在云开发后台为 liuhen_records 集合建立复合索引：
  //   {scopeType, spaceId, recordType, dueDate}
  //   {scopeType, ownerUserId, recordType, dueDate}
  // 否则下面的范围查询仍会触发集合扫描。
  const monthQuery = {
    ...baseQuery,
    recordType: "plan",
    isDraft: _.neq(true),
    status: _.in(["todo", "overdue"]),
    dueDate: _.gte(monthStartId).and(_.lte(monthEndId))
  };

  const overdueQuery = {
    ...baseQuery,
    recordType: "plan",
    isDraft: _.neq(true),
    status: _.in(["todo", "overdue"]),
    dueDate: _.gt("").and(_.lt(todayId))
  };

  const monthQueryStart = Date.now();
  const overdueQueryStart = Date.now();
  const [monthDocs, overdueDocs] = await Promise.all([
    fetchAllByQuery(monthQuery).then((docs) => {
      console.log(`[perf][${traceId}] monthQuery.done`, {
        count: docs.length,
        costMs: Date.now() - monthQueryStart,
        range: `${monthStartId} ~ ${monthEndId}`
      });
      return docs;
    }),
    fetchAllByQuery(overdueQuery).then((docs) => {
      console.log(`[perf][${traceId}] overdueQuery.done`, {
        count: docs.length,
        costMs: Date.now() - overdueQueryStart,
        cutoff: todayId
      });
      return docs;
    })
  ]);
  markStage("queries.parallelDone");

  const monthPlans = monthDocs.map(normalizeRecord);
  const overduePlans = overdueDocs.map(normalizeRecord);
  const dayPlans = monthPlans.filter((item) => item.dueDate === selectedDateId);
  const dayCounts = monthPlans.reduce((acc, item) => {
    const key = item.dueDate || "";
    if (!key) {
      return acc;
    }
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  markStage("normalizeAndAggregate");

  const totalMs = Date.now() - perfStart;
  console.log(`[perf][${traceId}] getTodoCalendarSummary.done`, {
    totalMs,
    monthDocCount: monthDocs.length,
    overdueDocCount: overdueDocs.length,
    dayPlanCount: dayPlans.length,
    dayCountKeys: Object.keys(dayCounts).length,
    stages: stageMarks
  });

  return {
    monthLabel: `${anchorMonth.getFullYear()}\u5e74${anchorMonth.getMonth() + 1}\u6708`,
    monthValue: `${anchorMonth.getFullYear()}-${pad(anchorMonth.getMonth() + 1)}`,
    selectedDateId,
    plans: dayPlans,
    monthPlans,
    overduePlans,
    dayCounts,
    perfTrace: {
      traceId,
      totalMs,
      stages: stageMarks,
      monthDocCount: monthDocs.length,
      overdueDocCount: overdueDocs.length
    }
  };
}

async function getAccountingSummary(session, scope, payload) {
  const records = await listRecords(session, scope);
  const year = Number(payload.selectedYear || new Date().getFullYear());
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const expenseRecords = records.filter(isExpenseRecord);
  const yearRecords = filterRecordsByDate(expenseRecords, yearStart, yearEnd, "recordTime");
  const granularity = payload.granularity || "day";
  const scopeInfo = buildScopeInfo(granularity, payload.selectedDate, year);
  const scopedRecords = filterRecordsByDate(yearRecords, scopeInfo.start, scopeInfo.end, "recordTime");
  const annualLimit = Number(payload.annualLimit || 0);
  const spent = Number(yearRecords.reduce((sum, item) => sum + Number(item.amount || 0), 0).toFixed(2));
  const remaining = annualLimit > 0 ? Number(Math.max(annualLimit - spent, 0).toFixed(2)) : 0;
  const overspent = annualLimit > 0 && spent > annualLimit ? Number((spent - annualLimit).toFixed(2)) : 0;
  const progress = annualLimit > 0 ? Math.max(0, Math.min(100, Math.round((spent / annualLimit) * 100))) : 0;
  return {
    year,
    scopeLabel: `${year}\u5e74`,
    scope: {
      ...scopeInfo,
      anchorDateId: payload.selectedDate || toDateId(scopeInfo.start)
    },
    summary: {
      spent: Number(scopedRecords.reduce((sum, item) => sum + Number(item.amount || 0), 0).toFixed(2)),
      remaining,
      count: scopedRecords.length
    },
    limitPool: {
      year,
      limit: annualLimit,
      spent,
      remaining,
      overspent,
      progress,
      hasLimit: annualLimit > 0
    },
    categoryStats: groupAmountByCategory(scopedRecords).slice(0, 6),
    recentFinance: scopedRecords.slice(0, 10),
    trendTitle: granularity === "day" ? "\u8fd17\u5929\u82b1\u9500" : granularity === "week" ? "\u8fd17\u5468\u82b1\u9500" : "\u8fd17\u4e2a\u6708\u82b1\u9500",
    trend: buildTrend(yearRecords, granularity, payload.selectedDate || toDateId(scopeInfo.start), year)
  };
}

function buildActivityStats(records) {
  const doneRecords = (records || []).filter((item) => item.recordType === "done" && !item.isDraft);
  const durationCount = doneRecords.reduce((sum, item) => sum + (parseFloat(item.durationQuantity) || 0), 0);
  return {
    completedCount: doneRecords.length,
    durationCount: Number(durationCount.toFixed(1)),
    categoryRanking: groupAmountByCategory(doneRecords).slice(0, 3)
  };
}

function buildTaskStats(records) {
  const plans = (records || []).filter((item) => item.recordType === "plan" && !item.isDraft);
  const completed = plans.filter((item) => item.status === "done");
  const overdue = plans.filter((item) => item.status === "overdue");
  return {
    total: plans.length,
    completed: completed.length,
    overdue: overdue.length,
    completionRate: plans.length ? Math.round((completed.length / plans.length) * 100) : 0
  };
}

function buildHabitStats(records) {
  const doneRecords = (records || []).filter((item) => item.recordType === "done" && !item.isDraft);
  const behaviorMap = {};
  doneRecords.forEach((item) => {
    const rawName = String(item.actionName || item.categoryName || "").trim();
    if (!rawName) {
      return;
    }
    const name = rawName.length > 12 ? `${rawName.slice(0, 12)}...` : rawName;
    if (!behaviorMap[name]) {
      behaviorMap[name] = {
        name,
        dates: [],
        count: 0
      };
    }
    behaviorMap[name].dates.push(item.recordTime);
    behaviorMap[name].count += 1;
  });

  const latestSevenDays = [];
  const today = toDateId(new Date());
  const todayDate = parseDateId(today);
  for (let offset = 6; offset >= 0; offset -= 1) {
    latestSevenDays.push(toDateId(addDays(todayDate, -offset)));
  }
  const latestSevenDaySet = new Set(latestSevenDays);

  const behaviorList = Object.keys(behaviorMap).map((key) => {
    const item = behaviorMap[key];
    const uniqueDays = Array.from(new Set(item.dates)).sort();
    let currentStreak = 0;
    let previous = null;
    uniqueDays.forEach((day) => {
      if (!previous) {
        currentStreak = 1;
      } else {
        const diff = (parseDateId(day).getTime() - parseDateId(previous).getTime()) / (1000 * 60 * 60 * 24);
        currentStreak = diff === 1 ? currentStreak + 1 : 1;
      }
      previous = day;
    });

    let latestStreak = 0;
    let cursor = today;
    const daySet = new Set(uniqueDays);
    while (daySet.has(cursor)) {
      latestStreak += 1;
      cursor = toDateId(addDays(parseDateId(cursor), -1));
    }

    const recentCount = item.dates.filter((dateId) => latestSevenDaySet.has(dateId)).length;
    return {
      name: item.name,
      totalCount: item.count,
      recentCount,
      latestStreak
    };
  });

  const streakRanking = behaviorList
    .filter((item) => item.latestStreak > 0)
    .sort((a, b) => b.latestStreak - a.latestStreak || b.totalCount - a.totalCount)
    .slice(0, 3);
  const recentRanking = behaviorList
    .filter((item) => item.recentCount > 0)
    .sort((a, b) => b.recentCount - a.recentCount || b.totalCount - a.totalCount)
    .slice(0, 5);
  const frequentRanking = behaviorList
    .sort((a, b) => b.totalCount - a.totalCount)
    .slice(0, 5);

  return {
    topStreakName: streakRanking.length ? streakRanking[0].name : "",
    topStreakDays: streakRanking.length ? streakRanking[0].latestStreak : 0,
    topRecentName: recentRanking.length ? recentRanking[0].name : "",
    topRecentCount: recentRanking.length ? recentRanking[0].recentCount : 0,
    streakRanking,
    recentRanking,
    frequentRanking
  };
}

async function getStatisticsSummary(session, scope, payload) {
  const records = await listRecords(session, scope);
  const granularity = payload.granularity || "month";
  const selectedYear = Number(payload.selectedYear || new Date().getFullYear());
  const scopeInfo = buildScopeInfo(granularity, payload.selectedDate, selectedYear);
  const activeRecords = records.filter((item) => !item.isDraft);
  const activityRecords = filterRecordsByDate(activeRecords.filter((item) => item.recordType === "done"), scopeInfo.start, scopeInfo.end, "recordTime");
  const taskRecords = filterRecordsByDate(activeRecords.filter((item) => item.recordType === "plan"), scopeInfo.start, scopeInfo.end, "dueDate");
  const financeRecords = activityRecords.filter(isExpenseRecord);
  const financeExpense = financeRecords.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return {
    scope: scopeInfo,
    activity: buildActivityStats(activityRecords),
    task: buildTaskStats(taskRecords),
    finance: {
      expense: Number(financeExpense.toFixed(2)),
      count: financeRecords.length,
      trend: buildTrend(records.filter(isExpenseRecord), granularity, payload.selectedDate, selectedYear)
    },
    habit: buildHabitStats(activityRecords)
  };
}

async function findRecordDoc(recordId) {
  const res = await db.collection(COLLECTIONS.records).where({
    recordId
  }).limit(1).get();
  return res.data[0] || null;
}

async function assertRecordAccess(recordDoc, session) {
  if (!recordDoc) {
    throw new Error("record-not-found");
  }
  if (recordDoc.scopeType === "space") {
    await assertSpaceAccess(recordDoc.spaceId, session.userId);
    return;
  }
  if (recordDoc.ownerUserId !== session.userId) {
    throw new Error("record-access-denied");
  }
}

async function getRecordById(recordId, session) {
  await ensureCollections();
  const recordDoc = await findRecordDoc(recordId);
  if (!recordDoc) {
    return null;
  }
  await assertRecordAccess(recordDoc, session);
  return normalizeRecord(recordDoc);
}

async function upsertRecord(record, session, scope) {
  await ensureCollections();
  if (scope.activeSpaceId) {
    await assertSpaceAccess(scope.activeSpaceId, session.userId);
  }

  const existing = record.id ? await findRecordDoc(record.id) : null;
  if (existing) {
    await assertRecordAccess(existing, session);
  }

  const scopedMeta = existing
    ? {
        scopeType: existing.scopeType,
        spaceId: existing.spaceId || "",
        ownerUserId: existing.ownerUserId
      }
    : scope.activeSpaceId
      ? {
          scopeType: "space",
          spaceId: scope.activeSpaceId,
          ownerUserId: session.userId
        }
      : {
          scopeType: "personal",
          spaceId: "",
          ownerUserId: session.userId
        };

  const next = {
    ...sanitizeRecordInput(record, existing),
    ...scopedMeta
  };

  if (existing) {
    await db.collection(COLLECTIONS.records).doc(existing._id).update({
      data: next
    });
    return {
      record: normalizeRecord({
        _id: existing._id,
        ...existing,
        ...next
      })
    };
  }

  const addRes = await db.collection(COLLECTIONS.records).add({
    data: next
  });
  return {
    record: normalizeRecord({
      _id: addRes._id,
      ...next
    })
  };
}

async function createDraftRecord(payload, session, scope) {
  const now = nowIso();
  return upsertRecord(
    {
      id: payload.id || `record_${Date.now()}`,
      originalContent: payload.originalContent || "",
      createdAt: now,
      status: "draft",
      isDraft: true,
      aiParseStatus: "pending",
      draftSource: payload.source || "text",
      source: "cloudbase"
    },
    session,
    scope
  );
}

function normalizeVoiceFormat(value) {
  const format = String(value || "mp3").trim().toLowerCase();
  return ["mp3", "m4a", "wav", "pcm"].includes(format) ? format : "mp3";
}

async function recognizeVoice(payload) {
  const asrConfig = getAsrConfig();
  if (!asrConfig.secretId || !asrConfig.secretKey) {
    throw new Error("asr-not-configured");
  }

  const fileID = String(payload.fileID || "").trim();
  if (!fileID) {
    throw new Error("voice-file-required");
  }

  const downloadRes = await cloud.downloadFile({ fileID });
  const fileContent = downloadRes.fileContent;
  if (!fileContent || !fileContent.length) {
    throw new Error("asr-empty-result");
  }
  if (fileContent.length > ASR_MAX_AUDIO_SIZE) {
    throw new Error("asr-file-too-large");
  }

  const response = await postTencentCloudApi(ASR_ACTION, {
    ProjectId: 0,
    SubServiceType: 2,
    EngSerViceType: asrConfig.engineModelType,
    SourceType: 1,
    VoiceFormat: normalizeVoiceFormat(payload.format),
    Data: fileContent.toString("base64"),
    DataLen: fileContent.length,
    ConvertNumMode: 1,
    FilterDirty: 0,
    FilterModal: 0,
    FilterPunc: 0,
    WordInfo: 0
  }, asrConfig);

  const text = String(response.Result || "").trim();
  if (!text) {
    throw new Error("asr-empty-result");
  }
  return {
    text,
    requestId: response.RequestId || ""
  };
}

async function completePlanWithTrace(recordId, today, session) {
  const targetDoc = await findRecordDoc(recordId);
  await assertRecordAccess(targetDoc, session);
  const target = normalizeRecord(targetDoc);
  await upsertRecord(
    {
      ...target,
      remoteRecordId: target.remoteRecordId,
      status: "done",
      isDraft: false
    },
    session,
    {
      activeSpaceId: targetDoc.scopeType === "space" ? targetDoc.spaceId : ""
    }
  );

  const now = nowIso();
  await upsertRecord(
    {
      id: `trace_${Date.now()}`,
      originalContent: target.originalContent || target.actionName,
      recordType: "done",
      categoryId: target.categoryId,
      categoryName: target.categoryName,
      actionName: target.actionName,
      description: target.description || "",
      amount: Number(target.amount || 0),
      direction: normalizeDirection(target.direction),
      currency: target.currency || "CNY",
      recordTime: today || toDateId(new Date()),
      createdAt: now,
      status: "done",
      isDraft: false,
      aiParseStatus: "parsed",
      source: "todo-quick-trace"
    },
    session,
    {
      activeSpaceId: targetDoc.scopeType === "space" ? targetDoc.spaceId : ""
    }
  );
  return { ok: true };
}

async function deleteRecords(recordIds, session) {
  await ensureCollections();
  const ids = Array.isArray(recordIds) ? recordIds : [];
  if (!ids.length) {
    return { deletedCount: 0 };
  }

  let deletedCount = 0;
  for (const recordId of ids) {
    const recordDoc = await findRecordDoc(recordId);
    if (!recordDoc) {
      continue;
    }
    await assertRecordAccess(recordDoc, session);
    await db.collection(COLLECTIONS.records).doc(recordDoc._id).remove();
    deletedCount += 1;
  }
  return { deletedCount };
}

function buildHandlers(session, scope, payload) {
  return {
    getSessionIdentity: async () => session,
    getAppBootstrap: async () => buildBootstrap(session),
    upsertUserProfile: async () => upsertUserProfile(session, payload),
    createSpace: async () => createSpace(session, payload),
    joinSpaceByCode: async () => joinSpaceByCode(session, payload),
    switchActiveSpace: async () => switchActiveSpace(session, payload),
    listRecords: async () => ({
      records: await listRecords(session, scope)
    }),
    getHomeSummary: async () => getHomeSummary(session, scope),
    getTodoCalendarSummary: async () => getTodoCalendarSummary(session, scope, payload),
    getAccountingSummary: async () => getAccountingSummary(session, scope, payload),
    getStatisticsSummary: async () => getStatisticsSummary(session, scope, payload),
    createDraftRecord: async () => createDraftRecord(payload, session, scope),
    recognizeVoice: async () => recognizeVoice(payload),
    getRecordById: async () => ({
      record: await getRecordById(payload.recordId, session)
    }),
    upsertRecord: async () => upsertRecord(payload.record || {}, session, scope),
    completePlanWithTrace: async () => completePlanWithTrace(payload.recordId, payload.today, session),
    deleteRecords: async () => deleteRecords(payload.recordIds, session)
  };
}

exports.main = async (event) => {
  try {
    const action = event.action;
    const payload = event.payload || {};
    const session = getSessionIdentity();
    const scope = getScopeFromPayload(payload);
    const handlers = buildHandlers(session, scope, payload);
    const handler = handlers[action];
    if (handler) {
      return {
        code: 0,
        data: await handler()
      };
    }

    return {
      code: 1,
      message: "unsupported-action"
    };
  } catch (error) {
    return {
      code: 1,
      message: error.message || "bridge-error",
      detail: error.detail || error.stack || ""
    };
  }
};
