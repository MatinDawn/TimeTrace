const CURRENT_USER_KEY = "liuhen-current-user-profile-v2";
const CURRENT_SPACE_KEY = "liuhen-current-space-v1";
const LOCAL_FALLBACK_KEY = "liuhen-local-user-id-v1";

function safeRead(key, fallback) {
  try {
    const value = wx.getStorageSync(key);
    return value === "" || value === undefined || value === null ? fallback : value;
  } catch (error) {
    return fallback;
  }
}

function safeWrite(key, value) {
  try {
    wx.setStorageSync(key, value);
  } catch (error) {
    // ignore local storage failures
  }
}

function buildLocalFallbackUserId() {
  const existing = safeRead(LOCAL_FALLBACK_KEY, "");
  if (existing) {
    return existing;
  }
  const next = `local_${Date.now()}`;
  safeWrite(LOCAL_FALLBACK_KEY, next);
  return next;
}

function getCurrentUserProfile() {
  const cached = safeRead(CURRENT_USER_KEY, null);
  if (cached && cached.userId) {
    return cached;
  }
  return {
    userId: buildLocalFallbackUserId(),
    displayName: "",
    avatarUrl: "",
    source: "local"
  };
}

function setCurrentUserProfile(profile) {
  const nextProfile = {
    ...getCurrentUserProfile(),
    ...profile
  };
  safeWrite(CURRENT_USER_KEY, nextProfile);
  return nextProfile;
}

function getCurrentUserId() {
  return getCurrentUserProfile().userId;
}

function getCurrentSpace() {
  return safeRead(CURRENT_SPACE_KEY, null);
}

function setCurrentSpace(space) {
  if (!space || !space.spaceId) {
    safeWrite(CURRENT_SPACE_KEY, null);
    return null;
  }
  const nextSpace = {
    spaceId: space.spaceId,
    name: space.name || "",
    inviteCode: space.inviteCode || "",
    role: space.role || "member",
    memberCount: Number(space.memberCount || 0)
  };
  safeWrite(CURRENT_SPACE_KEY, nextSpace);
  return nextSpace;
}

function clearCurrentSpace() {
  safeWrite(CURRENT_SPACE_KEY, null);
}

function getCurrentScope() {
  const space = getCurrentSpace();
  if (space && space.spaceId) {
    return {
      mode: "space",
      spaceId: space.spaceId
    };
  }
  return {
    mode: "personal",
    spaceId: ""
  };
}

function buildScopedStorageKey(baseKey, userId) {
  const scope = getCurrentScope();
  if (scope.mode === "space" && scope.spaceId) {
    return `${baseKey}:space:${scope.spaceId}`;
  }
  return `${baseKey}:user:${userId || getCurrentUserId()}`;
}

module.exports = {
  CURRENT_USER_KEY,
  CURRENT_SPACE_KEY,
  getCurrentUserProfile,
  setCurrentUserProfile,
  getCurrentUserId,
  getCurrentSpace,
  setCurrentSpace,
  clearCurrentSpace,
  getCurrentScope,
  buildScopedStorageKey
};
