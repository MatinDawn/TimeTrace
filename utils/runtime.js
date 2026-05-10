function isRemoteEnabled() {
  try {
    return Boolean(wx && wx.cloud && typeof wx.cloud.callFunction === "function");
  } catch (error) {
    return false;
  }
}

function isCloudDatabaseWatchAvailable() {
  try {
    return Boolean(
      wx &&
      wx.cloud &&
      typeof wx.cloud.database === "function"
    );
  } catch (error) {
    return false;
  }
}

module.exports = {
  isRemoteEnabled,
  isCloudDatabaseWatchAvailable
};
