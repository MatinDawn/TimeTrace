const {
  getCurrentUserProfile,
  setCurrentUserProfile,
  getCurrentSpace,
  setCurrentSpace,
  clearCurrentSpace
} = require("./utils/session");
const { getAppBootstrap, isProfileComplete } = require("./services/appService");

App({
  onLaunch() {
    if (wx.cloud) {
      wx.cloud.init({
        env: "cloud1-d2gyj2no14029f274",
        traceUser: true
      });
    }

    this.globalData.currentUser = getCurrentUserProfile();
    this.globalData.activeSpace = getCurrentSpace();
    this.globalData.spaces = this.globalData.activeSpace ? [this.globalData.activeSpace] : [];
    this.syncBootstrap();
  },

  syncBootstrap() {
    if (this.globalData.skipNextBootstrapOnce || this.globalData.pendingSpaceSwitchUntil > Date.now()) {
      this.globalData.skipNextBootstrapOnce = false;
      return Promise.resolve({
        profile: this.globalData.currentUser,
        activeSpace: this.globalData.activeSpace,
        spaces: this.globalData.spaces
      });
    }

    if (!wx.cloud) {
      return Promise.resolve({
        profile: this.globalData.currentUser,
        activeSpace: this.globalData.activeSpace,
        spaces: this.globalData.spaces
      });
    }

    return getAppBootstrap()
      .then((data) => {
        const profile = data.profile
          ? setCurrentUserProfile(data.profile)
          : this.globalData.currentUser;
        const activeSpace = data.activeSpace ? setCurrentSpace(data.activeSpace) : null;
        if (!activeSpace) {
          clearCurrentSpace();
        }

        this.globalData.currentUser = profile;
        this.globalData.activeSpace = activeSpace;
        this.globalData.spaces = data.spaces || [];
        this.globalData.needsProfile = !isProfileComplete(profile);
        return {
          profile,
          activeSpace,
          spaces: this.globalData.spaces
        };
      })
      .catch(() => {
        this.globalData.needsProfile = !isProfileComplete(this.globalData.currentUser);
        return {
          profile: this.globalData.currentUser,
          activeSpace: this.globalData.activeSpace,
          spaces: this.globalData.spaces
        };
      });
  },

  globalData: {
    appName: "\u7559\u75d5",
    currentUser: getCurrentUserProfile(),
    activeSpace: getCurrentSpace(),
    spaces: getCurrentSpace() ? [getCurrentSpace()] : [],
    needsProfile: !isProfileComplete(getCurrentUserProfile()),
    skipNextBootstrapOnce: false,
    pendingSpaceSwitchUntil: 0
  }
});
