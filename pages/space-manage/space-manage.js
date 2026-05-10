const { getAppBootstrap, createSpace, joinSpace, switchSpace } = require("../../services/appService");

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
      joinTitle: "\u52a0\u5165\u7a7a\u95f4",
      joinPlaceholder: "\u8bf7\u8f93\u5165 6 \u4f4d\u9080\u8bf7\u7801",
      joinButton: "\u52a0\u5165\u7a7a\u95f4",
      joinedTitle: "\u6211\u7684\u7a7a\u95f4",
      currentTag: "\u5f53\u524d",
      inviteCode: "\u9080\u8bf7\u7801",
      memberCount: "\u6210\u5458",
      switchButton: "\u5207\u6362\u5230\u8be5\u7a7a\u95f4",
      emptyText: "\u8fd8\u6ca1\u6709\u7a7a\u95f4\uff0c\u53ef\u4ee5\u5148\u521b\u5efa\u4e00\u4e2a\uff0c\u6216\u901a\u8fc7\u9080\u8bf7\u7801\u52a0\u5165\u3002"
    },
    profile: null,
    activeSpace: null,
    spaces: [],
    createName: "",
    inviteCodeInput: "",
    creating: false,
    joining: false,
    switching: false
  },

  async onShow() {
    await this.loadBootstrap();
  },

  async loadBootstrap() {
    const bootstrap = await getAppBootstrap();
    this.setData({
      profile: bootstrap.profile || null,
      activeSpace: bootstrap.activeSpace || null,
      spaces: bootstrap.spaces || []
    });
  },

  onCreateNameInput(event) {
    this.setData({
      createName: event.detail.value || ""
    });
  },

  onInviteCodeInput(event) {
    this.setData({
      inviteCodeInput: String(event.detail.value || "").toUpperCase()
    });
  },

  async handleCreateSpace() {
    const name = String(this.data.createName || "").trim();
    if (!name || this.data.creating) {
      return;
    }
    this.setData({ creating: true });
    try {
      await createSpace(name);
      this.setData({ createName: "" });
      await this.loadBootstrap();
      wx.showToast({
        title: "\u7a7a\u95f4\u5df2\u521b\u5efa",
        icon: "success"
      });
    } catch (error) {
      wx.showToast({
        title: error.message === "space-name-required" ? "\u8bf7\u5148\u586b\u5199\u7a7a\u95f4\u540d\u79f0" : "\u521b\u5efa\u5931\u8d25",
        icon: "none"
      });
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
      await joinSpace(inviteCode);
      this.setData({ inviteCodeInput: "" });
      await this.loadBootstrap();
      wx.showToast({
        title: "\u52a0\u5165\u6210\u529f",
        icon: "success"
      });
    } catch (error) {
      const messageMap = {
        "invite-code-required": "\u8bf7\u8f93\u5165\u9080\u8bf7\u7801",
        "space-not-found": "\u9080\u8bf7\u7801\u65e0\u6548",
        "space-member-limit": "\u8be5\u7a7a\u95f4\u5df2\u6ee1 5 \u4eba"
      };
      wx.showToast({
        title: messageMap[error.message] || "\u52a0\u5165\u5931\u8d25",
        icon: "none"
      });
    } finally {
      this.setData({ joining: false });
    }
  },

  async handleSwitchPersonal() {
    if (this.data.switching) {
      return;
    }
    this.setData({ switching: true });
    try {
      await switchSpace("");
      await this.loadBootstrap();
      wx.showToast({
        title: "\u5df2\u5207\u6362\u4e3a\u4e2a\u4eba\u6a21\u5f0f",
        icon: "success"
      });
    } catch (error) {
      wx.showToast({
        title: "\u5207\u6362\u5931\u8d25",
        icon: "none"
      });
    } finally {
      this.setData({ switching: false });
    }
  },

  async handleSwitchSpace(event) {
    const spaceId = event.currentTarget.dataset.spaceId;
    if (!spaceId || this.data.switching) {
      return;
    }
    this.setData({ switching: true });
    try {
      await switchSpace(spaceId);
      await this.loadBootstrap();
      wx.showToast({
        title: "\u5df2\u5207\u6362\u7a7a\u95f4",
        icon: "success"
      });
    } catch (error) {
      wx.showToast({
        title: "\u5207\u6362\u5931\u8d25",
        icon: "none"
      });
    } finally {
      this.setData({ switching: false });
    }
  }
});
