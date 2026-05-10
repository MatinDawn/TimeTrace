const {
  getCurrentSpace,
  setCurrentSpace,
  clearCurrentSpace,
  getCurrentUserProfile,
  setCurrentUserProfile
} = require("../../utils/session");
const {
  callBridge,
  isRemoteEnabled,
  withRemoteFallback,
  isProfileComplete
} = require("./service-runtime");
const { invalidateRemoteCache } = require("./record-cache");

async function getAppBootstrap(options) {
  const settings = options || {};
  const data = await withRemoteFallback(
    () => callBridge("getAppBootstrap", {}),
    () => {
      const profile = getCurrentUserProfile();
      const activeSpace = getCurrentSpace();
      return {
        profile,
        activeSpace,
        spaces: activeSpace ? [activeSpace] : []
      };
    }
  );
  if (settings.apply === false) {
    return data;
  }
  if (data.profile) {
    setCurrentUserProfile(data.profile);
  }
  if (data.activeSpace) {
    setCurrentSpace(data.activeSpace);
  } else {
    clearCurrentSpace();
  }
  invalidateRemoteCache();
  return data;
}

async function saveUserProfile(payload) {
  if (!isRemoteEnabled()) {
    const profile = setCurrentUserProfile(payload || {});
    return { profile };
  }

  const data = await callBridge("upsertUserProfile", payload || {});
  if (data.profile) {
    setCurrentUserProfile(data.profile);
  }
  return data;
}

async function createSpace(name) {
  const data = await callBridge("createSpace", {
    name: String(name || "").trim()
  });
  if (data.profile) {
    setCurrentUserProfile(data.profile);
  }
  if (data.activeSpace) {
    setCurrentSpace(data.activeSpace);
  }
  invalidateRemoteCache();
  return data;
}

async function joinSpace(inviteCode) {
  const data = await callBridge("joinSpaceByCode", {
    inviteCode: String(inviteCode || "").trim().toUpperCase()
  });
  if (data.profile) {
    setCurrentUserProfile(data.profile);
  }
  if (data.activeSpace) {
    setCurrentSpace(data.activeSpace);
  }
  invalidateRemoteCache();
  return data;
}

async function switchSpace(spaceId) {
  const data = await callBridge("switchActiveSpace", {
    spaceId: String(spaceId || "").trim()
  });
  if (data.profile) {
    setCurrentUserProfile(data.profile);
  }
  if (data.activeSpace) {
    setCurrentSpace(data.activeSpace);
  } else {
    clearCurrentSpace();
  }
  invalidateRemoteCache();
  return data;
}

module.exports = {
  getAppBootstrap,
  saveUserProfile,
  createSpace,
  joinSpace,
  switchSpace,
  isProfileComplete
};
