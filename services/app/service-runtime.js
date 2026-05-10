const { callBridge } = require("../remoteBridge");
const { isRemoteEnabled } = require("../../utils/runtime");
const { getCurrentScope, getCurrentUserProfile } = require("../../utils/session");

function buildScopePayload(extraPayload) {
  const scope = getCurrentScope();
  return {
    ...(extraPayload || {}),
    activeSpaceId: scope.mode === "space" ? scope.spaceId : ""
  };
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function withRemoteFallback(remoteTask, localTask) {
  if (!isRemoteEnabled()) {
    return localTask();
  }
  try {
    return await remoteTask();
  } catch (error) {
    return localTask(error);
  }
}

function isProfileComplete(profile) {
  const current = profile || getCurrentUserProfile();
  return Boolean(String(current.displayName || "").trim() && String(current.avatarUrl || "").trim());
}

module.exports = {
  callBridge,
  isRemoteEnabled,
  buildScopePayload,
  sleep,
  withRemoteFallback,
  isProfileComplete
};
