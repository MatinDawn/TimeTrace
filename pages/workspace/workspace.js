const { getAppBootstrap, createSpace, joinSpace, switchSpace } = require("../../services/appService");
const { logError, showErrorToast } = require("../../utils/error-handler");
const { setCurrentSpace, clearCurrentSpace } = require("../../utils/session");
const { invalidateRemoteCache } = require("../../services/app/record-cache");

function isDatasetTrue(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function getSpaceIdFromDataset(dataset) {
  const current = dataset || {};
  return current.spaceId || current.spaceid || "";
}

Page({
  data: {
    ui: {
      title: "\u7a7a\u95f4",
      subtitle: "\u4e2a\u4eba\u6a21\u5f0f\u4fdd\u6301\u6570\u636e\u9694\u79bb\uff0c\u7a7a\u95f4\u6a21\u5f0f\u652f\u6301\u9080\u8bf7\u5236\u5171\u4eab\uff0c\u6700\u591a 5 \u4eba\u3002",
      currentMode: "\u5f53\u524d\u6a21\u5f0f",
      personalMode: "\u4e2a\u4eba\u6a21\u5f0f",
      personalHint: "\u53ea\u67e5\u770b\u548c\u7edf\u8ba1\u81ea\u5df1\u7684\u7559\u75d5\u6570\u636e",
      switchPersonal: "\u5207\u56de\u4e2a\u4eba\u6a21\u5f0f",
      createTitle: "\u521b\u5efa\u7a7a\u95f4",
      createPlaceholder: "\u4f8b\u5982\uff1a\u6211\u4eec\u4e00\u5bb6\u4eba",
      createButton: "\u521b\u5efa\u5e76\u751f\u6210\u9080\u8bf7\u7801",
      createSheetHint: "\u7ed9\u5171\u4eab\u7a7a\u95f4\u8d77\u4e2a\u597d\u8bb0\u7684\u540d\u5b57\uff0c\u7a0d\u540e\u4f1a\u81ea\u52a8\u751f\u6210\u9080\u8bf7\u7801\u3002",
      joinTitle: "\u52a0\u5165\u7a7a\u95f4",
      joinPlaceholder: "\u8bf7\u8f93\u5165 6 \u4f4d\u9080\u8bf7\u7801",
      joinButton: "\u52a0\u5165\u7a7a\u95f4",
      joinSheetHint: "\u8f93\u5165\u5bf9\u65b9\u5206\u4eab\u7684 6 \u4f4d\u9080\u8bf7\u7801\uff0c\u52a0\u5165\u540e\u4f1a\u81ea\u52a8\u5207\u6362\u5230\u8be5\u7a7a\u95f4\u3002",
      joinedTitle: "\u6211\u7684\u7a7a\u95f4",
      currentTag: "\u5f53\u524d",
      inviteCode: "\u9080\u8bf7\u7801",
      copied: "\u5df2\u590d\u5236",
      memberCount: "\u6210\u5458",
      emptyText: "\u8fd8\u6ca1\u6709\u7a7a\u95f4\uff0c\u53ef\u4ee5\u5148\u521b\u5efa\u4e00\u4e2a\uff0c\u6216\u901a\u8fc7\u9080\u8bf7\u7801\u52a0\u5165\u3002"
    },
    profile: null,
    activeSpace: null,
    spaces: [],
    createName: "",
    inviteCodeInput: "",
    spaceSheetVisible: false,
    spaceSheetMode: "create",
    creating: false,
    joining: false,
    switching: false
  },

  refreshBootstrapSeq: 0,
  pageUnloaded: false,

  onLoad(options) {
    this.pageUnloaded = false;
    const action = String((options && options.action) || "");
    if (action === "create" || action === "join") {
      this.setData({
        spaceSheetVisible: true,
        spaceSheetMode: action
      });
    }
  },

  async onShow() {
    try {
      await this.loadBootstrap();
    } catch (error) {
      logError("workspace.onShow", error);
      showErrorToast(error, "空间数据加载失败");
    }
  },

  async loadBootstrap() {
    const app = getApp();
    if (app.globalData.pendingSpaceSwitchUntil > Date.now()) {
      this.applyCachedBootstrap(app);
      return;
    }
    if ((app.globalData.spaces || []).length || app.globalData.activeSpace) {
      this.applyCachedBootstrap(app);
      this.refreshBootstrapInBackground();
      return;
    }
    const bootstrap = await getAppBootstrap();
    this.applyBootstrap(bootstrap);
  },

  applyCachedBootstrap(app) {
    this.setData({
      profile: app.globalData.currentUser || null,
      activeSpace: app.globalData.activeSpace || null,
      spaces: app.globalData.spaces || []
    });
  },

  refreshBootstrapInBackground() {
    const seq = this.refreshBootstrapSeq + 1;
    this.refreshBootstrapSeq = seq;
    getAppBootstrap({ apply: false })
      .then((bootstrap) => {
        const app = getApp();
        if (this.pageUnloaded || seq !== this.refreshBootstrapSeq || app.globalData.pendingSpaceSwitchUntil > Date.now()) {
          return;
        }
        this.applyBootstrap(bootstrap);
      })
      .catch((error) => {
        logError("workspace.refreshBootstrap", error);
      });
  },

  applyBootstrap(bootstrap) {
    const next = bootstrap || {};
    const app = getApp();
    app.globalData.currentUser = next.profile || app.globalData.currentUser;
    app.globalData.activeSpace = next.activeSpace || null;
    app.globalData.spaces = next.spaces || [];
    this.setData({
      profile: next.profile || null,
      activeSpace: next.activeSpace || null,
      spaces: next.spaces || []
    });
  },

  applyLocalSpace(space) {
    const app = getApp();
    const activeSpace = space ? setCurrentSpace(space) : null;
    if (!activeSpace) {
      clearCurrentSpace();
    }
    const nextSpaces = (this.data.spaces || []).map((item) => ({
      ...item,
      isActive: Boolean(activeSpace && item.spaceId === activeSpace.spaceId)
    }));
    app.globalData.activeSpace = activeSpace;
    app.globalData.spaces = nextSpaces;
    app.globalData.skipNextBootstrapOnce = true;
    app.globalData.pendingSpaceSwitchUntil = Date.now() + 5000;
    invalidateRemoteCache();
    this.setData({
      activeSpace,
      spaces: nextSpaces
    });
  },

  goHomeAfterSwitch() {
    wx.reLaunch({
      url: "/pages/home/home"
    });
  },

  syncSpaceSwitchInBackground(spaceId, context, extra) {
    switchSpace(spaceId)
      .then(() => {
        getApp().globalData.pendingSpaceSwitchUntil = 0;
      })
      .catch((error) => {
        getApp().globalData.pendingSpaceSwitchUntil = 0;
        logError(context, error, extra || null);
        showErrorToast(error, "切换失败");
      });
  },

  openSpaceActions() {
    wx.showActionSheet({
      itemList: [this.data.ui.createTitle, this.data.ui.joinTitle],
      success: (res) => {
        this.setData({
          spaceSheetVisible: true,
          spaceSheetMode: res.tapIndex === 0 ? "create" : "join"
        });
      }
    });
  },

  closeSpaceSheet() {
    if (this.data.creating || this.data.joining) {
      return;
    }
    this.setData({
      spaceSheetVisible: false
    });
  },

  noop() {},

  onSpaceSheetInput(event) {
    const value = event.detail.value || "";
    if (this.data.spaceSheetMode === "create") {
      this.setData({ createName: value });
      return;
    }
    this.setData({
      inviteCodeInput: String(value).toUpperCase()
    });
  },

  handleSpaceSheetSubmit() {
    if (this.data.spaceSheetMode === "create") {
      this.handleCreateSpace();
      return;
    }
    this.handleJoinSpace();
  },

  async handleCreateSpace() {
    const name = String(this.data.createName || "").trim();
    if (!name || this.data.creating) {
      return;
    }
    this.setData({ creating: true });
    try {
      const result = await createSpace(name);
      this.applyBootstrap(result);
      this.setData({ createName: "", spaceSheetVisible: false });
      this.showCreatedSpaceModal(result.activeSpace);
    } catch (error) {
      logError("workspace.createSpace", error, { name });
      showErrorToast(error, "创建失败");
    } finally {
      this.setData({ creating: false });
    }
  },

  async handleJoinSpace() {
    const inviteCode = String(this.data.inviteCodeInput || "").trim().toUpperCase();
    if (!inviteCode || this.data.joining) {
      return;
    }
    this.setData({ joining: true });
    try {
      const result = await joinSpace(inviteCode);
      this.applyBootstrap(result);
      this.setData({ inviteCodeInput: "", spaceSheetVisible: false });
      wx.showToast({
        title: "\u52a0\u5165\u6210\u529f",
        icon: "success"
      });
    } catch (error) {
      logError("workspace.joinSpace", error, { inviteCode });
      showErrorToast(error, "加入失败");
    } finally {
      this.setData({ joining: false });
    }
  },

  async handleSwitchPersonal() {
    if (this.data.switching) {
      return;
    }
    this.setData({ switching: true });
    this.applyLocalSpace(null);
    wx.showToast({
      title: "\u5df2\u5207\u6362\u4e3a\u4e2a\u4eba\u6a21\u5f0f",
      icon: "success"
    });
    this.goHomeAfterSwitch();
    this.syncSpaceSwitchInBackground("", "workspace.switchPersonal");
  },

  handleSpaceCardTap(event) {
    const dataset = event.currentTarget.dataset || {};
    const spaceId = getSpaceIdFromDataset(dataset);
    if (isDatasetTrue(dataset.isActive) || isDatasetTrue(dataset.active)) {
      return;
    }
    this.switchToSpace(spaceId);
  },

  async switchToSpace(spaceId) {
    if (!spaceId || this.data.switching) {
      return;
    }
    const targetSpace = (this.data.spaces || []).find((item) => item.spaceId === spaceId);
    if (!targetSpace) {
      wx.showToast({
        title: "\u672a\u627e\u5230\u8be5\u7a7a\u95f4",
        icon: "none"
      });
      return;
    }
    this.setData({ switching: true });
    this.applyLocalSpace(targetSpace);
    wx.showToast({
      title: "\u5df2\u5207\u6362\u7a7a\u95f4",
      icon: "success"
    });
    this.goHomeAfterSwitch();
    this.syncSpaceSwitchInBackground(spaceId, "workspace.switchSpace", { spaceId });
  },

  showCreatedSpaceModal(space) {
    if (!space || !space.inviteCode) {
      wx.showToast({
        title: "\u7a7a\u95f4\u5df2\u521b\u5efa",
        icon: "success"
      });
      return;
    }

    wx.showModal({
      title: "\u7a7a\u95f4\u5df2\u521b\u5efa",
      content: `\u9080\u8bf7\u7801\uff1a${space.inviteCode}\n\u590d\u5236\u540e\u53d1\u7ed9\u5bf9\u65b9\uff0c\u5bf9\u65b9\u5728\u201c\u52a0\u5165\u7a7a\u95f4\u201d\u4e2d\u8f93\u5165\u5373\u53ef\u3002`,
      confirmText: "\u590d\u5236",
      cancelText: "\u77e5\u9053\u4e86",
      success: (res) => {
        if (res.confirm) {
          this.copyInviteCode(space.inviteCode);
        }
      }
    });
  },

  handleCopyInviteCode(event) {
    const code = event.currentTarget.dataset.code;
    this.copyInviteCode(code);
  },

  copyInviteCode(code) {
    const inviteCode = String(code || "").trim().toUpperCase();
    if (!inviteCode) {
      return;
    }
    wx.setClipboardData({
      data: inviteCode,
      success: () => {
        wx.showToast({
          title: this.data.ui.copied,
          icon: "success"
        });
      }
    });
  },

  onUnload() {
    this.pageUnloaded = true;
    this.refreshBootstrapSeq += 1;
  }
});
