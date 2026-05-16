const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const homeJs = read("pages/home/home.js");
const homeWxml = read("pages/home/home.wxml");
const statsJs = read("services/app/stats.js");
const cloudBridge = read("cloudfunctions/liuhenBridge/index.js");
const dailySummary = read("services/dailySummary.js");
const writeService = read("services/app/record-write-service.js");
const spacesService = read("services/app/spaces.js");
const recordNormalizer = read("services/app/record-normalizer.js");
const store = read("utils/store.js");
const todoWxml = read("pages/todo-list/todo-list.wxml");
const detailWxml = read("pages/detail-edit/detail-edit.wxml");
const homeWxss = read("pages/home/home.wxss");
const categoriesJs = read("utils/categories.js");
const draftService = read("services/app/record-draft-service.js");

assert(!homeWxml.includes("?/text>") && !homeWxml.includes("?/view>"), "home WXML must not contain malformed closing tags");
assert(!homeWxml.includes("鈥渰{"), "home WXML must not contain malformed overview quote binding");

assert(/getCreatedDateId/.test(homeJs), "home page fallback must use created date helper");
assert(/function getDefaultCategories/.test(categoriesJs), "categories utility must provide default categories");
assert(/function getCategoryMetaMap/.test(categoriesJs), "categories utility must provide category meta map");
assert(/function inferCategory/.test(categoriesJs), "categories utility must provide category inference");
assert(/remote-draft-fallback/.test(draftService), "remote draft creation must fall back to a local draft");
assert(/createdLocalDate/.test(homeJs) && /createdAt/.test(homeJs), "home page fallback must prefer createdLocalDate and fallback to createdAt");
assert(!/dueDate\s*===\s*todayId/.test(homeJs), "home page fallback must not filter today plans by dueDate === todayId");
assert(!/dueDate\s*>\s*todayId/.test(homeJs), "home page fallback must not show future plans by dueDate");
assert(/getHomeCreatedDateId/.test(statsJs), "local getHomeData must use created date helper");
assert(/createdLocalDate/.test(statsJs) && /createdAt/.test(statsJs), "local getHomeData must prefer createdLocalDate and fallback to createdAt");
assert(!/dueDate\s*===\s*todayId/.test(statsJs), "local getHomeData must not filter today plans by dueDate === todayId");
assert(!/dueDate\s*>\s*todayId/.test(statsJs), "local getHomeData must not show future plans by dueDate");
assert(/getHomeCreatedDateId/.test(cloudBridge), "cloud getHomeSummary must use created date helper");
assert(/createdLocalDate/.test(cloudBridge) && /createdAt/.test(cloudBridge), "cloud getHomeSummary must prefer createdLocalDate and fallback to createdAt");
assert(!/dueDate\s*===\s*todayId/.test(cloudBridge), "cloud getHomeSummary must not filter today plans by dueDate === todayId");

["updatedAt", "status", "description", "amount", "recordTime", "dueDate", "dueTime"].forEach((field) => {
  assert(dailySummary.includes(field), `daily summary fingerprint must include ${field}`);
});

assert(writeService.includes("dailySummaryCache"), "record writes must clear daily summary cache");
assert(writeService.includes("lastHomeData"), "record writes must clear home data cache");
assert(writeService.includes("creatorDisplayName"), "record writes must add or preserve creator display name");

assert(/async function deleteSpace/.test(cloudBridge), "cloud bridge must implement deleteSpace");
assert(/deleteSpace: async/.test(cloudBridge), "cloud bridge must expose deleteSpace handler");
assert(/status:\s*"deleted"/.test(cloudBridge), "deleteSpace must soft delete the space");
assert(/status:\s*"inactive"/.test(cloudBridge), "deleteSpace must deactivate memberships");
assert(/isDeleted:\s*true/.test(cloudBridge), "deleteSpace must soft delete space records");
assert(/deletedAt/.test(cloudBridge), "soft-deleted records must carry deletedAt");
assert(/isDeleted:\s*_\.(neq|neq\(true\))/.test(cloudBridge) || /isDeleted:\s*false/.test(cloudBridge), "record reads must filter deleted records");

assert(/function deleteSpace/.test(spacesService), "front-end space service must export deleteSpace");
assert(/deleteSpace/.test(spacesService.match(/module\.exports\s*=\s*\{[\s\S]*?\};/)?.[0] || ""), "deleteSpace must be exported");

["creatorUserId", "creatorDisplayName", "creatorAvatarUrl", "isDeleted", "deletedAt"].forEach((field) => {
  assert(recordNormalizer.includes(field), `remote normalizer must preserve ${field}`);
  assert(store.includes(field), `local store normalizer must preserve ${field}`);
  assert(cloudBridge.includes(field), `cloud record normalizer must preserve ${field}`);
});

assert(homeWxml.includes("quickTrace"), "home todo item must expose quickTrace");
assert(homeWxml.includes("creatorDisplayName"), "home feed must display creator information in space mode");
assert(todoWxml.includes("creatorDisplayName"), "todo list must display creator information in space mode");
assert(detailWxml.includes("creatorDisplayName"), "detail page must display creator information in space mode");
assert(homeWxml.includes("progress-tree"), "home progress tree must use staged CSS tree markup");
assert(!homeWxml.includes("progress-seedling-trace.svg"), "home progress tree must not depend on the static seedling svg");
assert(homeJs.includes("treeGrowAnimating"), "home page must track tree grow animation state");
assert(homeJs.includes("pendingTreeGrow"), "home page must consume pending tree grow flag");
assert(read("pages/detail-edit/detail-edit.js").includes("pendingTreeGrow"), "detail save must mark pending tree grow animation");

const treeZoneRule = homeWxss.match(/\.progress-tree-zone\s*\{[\s\S]*?\}/)?.[0] || "";
assert(/bottom:\s*18rpx;/.test(treeZoneRule), "home progress tree soil must align with the progress track baseline");
assert(/\.progress-track-line::before\s*\{[\s\S]*?top:\s*106rpx;/.test(homeWxss), "home progress track baseline must stay at 106rpx");
assert(/\.progress-segment\s*\{[\s\S]*?top:\s*106rpx;/.test(homeWxss), "home progress segments must stay aligned to the 106rpx baseline");
assert(/\.progress-tree\.stage-3\s+\.ink-tree-image/.test(homeWxss), "home progress tree stage styles must remain available");
assert(/@keyframes inkTreeReveal/.test(homeWxss), "home progress tree grow animation must remain available");

console.log("home-space behavior checks passed");
