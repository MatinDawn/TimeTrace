const {
  getCategories,
  getReminderItems,
  getDrafts,
  getPlans,
  getRecords,
  getAppBootstrap,
  saveUserProfile
} = require("../../services/appService");

Page({
  data: {
    currentTab: "/pages/my/my",
    ui: {
      title: "\u7559\u75d5",
      subtitle: "\u751f\u6d3b\u8bb0\u5f55\u4e0e\u6548\u7387\u7ba1\u7406\u5de5\u5177",
      emptyProfile: "\u70b9\u51fb\u8bbe\u7f6e\u5934\u50cf / \u6635\u79f0",
      personalMode: "\u4e2a\u4eba\u6a21\u5f0f",
      noActiveSpace: "\u672a\u52a0\u5165\u7a7a\u95f4",
      editProfile: "\u7f16\u8f91\u8d44\u6599",
      avatarField: "\u5934\u50cf",
      avatarAction: "\u9009\u62e9",
      nicknameField: "\u6635\u79f0",
      nicknamePlaceholder: "\u70b9\u51fb\u8f93\u5165\u6216\u4f7f\u7528\u5fae\u4fe1\u6635\u79f0",
      cancel: "\u53d6\u6d88",
      save: "\u4fdd\u5b58",
      saving: "\u4fdd\u5b58\u4e2d",
      profileSaved: "\u5df2\u4fdd\u5b58",
      manageSpace: "\u7a7a\u95f4\u7ba1\u7406",
      manageSpaceDesc: "\u521b\u5efa\u3001\u52a0\u5165\u6216\u5207\u6362\u5171\u4eab\u7a7a\u95f4\uff0c\u6bcf\u4e2a\u7a7a\u95f4\u6700\u591a 5 \u4eba",
      recordCount: "\u603b\u7559\u75d5",
      todoCount: "\u5f85\u5b8c\u6210",
      draftCount: "\u8349\u7a3f",
      reminderCount: "\u63d0\u9192",
      draftBox: "\u8349\u7a3f\u7bb1",
      draftDesc: "\u96c6\u4e2d\u5904\u7406\u5feb\u901f\u7559\u4e0b\u7684\u5f85\u786e\u8ba4\u5185\u5bb9",
      categoryManage: "\u5206\u7c7b\u7ba1\u7406",
      categoryDesc: "\u7ef4\u62a4\u5206\u7c7b\u3001\u9ed8\u8ba4\u8bbe\u7f6e\u548c\u540e\u7eed\u6269\u5c55\u89c4\u5219",
      reminderManage: "\u63d0\u9192\u7ba1\u7406",
      reminderDesc: "\u67e5\u770b\u5df2\u7ecf\u5f00\u542f\u7684\u4efb\u52a1\u63d0\u9192",
      search: "\u5168\u5c40\u641c\u7d22",
      searchDesc: "\u641c\u7d22\u7559\u75d5\u3001\u89c4\u5212\u548c\u5386\u53f2\u5185\u5bb9",
      home: "\u9996\u9875",
      accounting: "\u8bb0\u8d26",
      statistics: "\u7edf\u8ba1",
      mine: "\u6211\u7684"
    },
    overview: {
      recordCount: 0,
      categoryCount: 0,
      draftCount: 0,
      reminderCount: 0,
      todoCount: 0
    },
    currentUser: {
      displayName: "",
      avatarUrl: ""
    },
    activeSpace: null,
    nicknameDraft: "",
    avatarDraft: "",
    profileEditorVisible: false,
    savingProfile: false
  },

  async onShow() {
    await this.loadBootstrap();
    const records = await getRecords();
    const reminders = await getReminderItems();
    const plans = await getPlans("todo");
    const drafts = await getDrafts();
    this.setData({
      overview: {
        recordCount: records.filter((item) => !item.isDraft).length,
        categoryCount: getCategories().length,
        draftCount: drafts.length,
        reminderCount: reminders.length,
        todoCount: plans.length
      }
    });
  },

  async loadBootstrap() {
    const bootstrap = await getAppBootstrap();
    const profile = bootstrap.profile || {};
    this.setData({
      currentUser: profile,
      activeSpace: bootstrap.activeSpace || null,
      nicknameDraft: profile.displayName || "",
      avatarDraft: profile.avatarUrl || ""
    });
  },

  async persistProfile(partial) {
    if (this.data.savingProfile) {
      return;
    }
    this.setData({ savingProfile: true });
    try {
      const result = await saveUserProfile({
        displayName: partial.displayName !== undefined ? partial.displayName : this.data.nicknameDraft,
        avatarUrl: partial.avatarUrl !== undefined ? partial.avatarUrl : this.data.avatarDraft
      });
      const profile = result.profile || this.data.currentUser;
      this.setData({
        currentUser: profile,
        nicknameDraft: profile.displayName || "",
        avatarDraft: profile.avatarUrl || ""
      });
      wx.showToast({
        title: this.data.ui.profileSaved,
        icon: "success"
      });
      return true;
    } catch (error) {
      wx.showToast({
        title: "\u4fdd\u5b58\u5931\u8d25",
        icon: "none"
      });
      return false;
    } finally {
      this.setData({ savingProfile: false });
    }
  },

  openProfileEditor() {
    this.setData({
      profileEditorVisible: true,
      nicknameDraft: this.data.currentUser.displayName || "",
      avatarDraft: this.data.currentUser.avatarUrl || ""
    });
  },

  closeProfileEditor() {
    if (this.data.savingProfile) {
      return;
    }
    this.setData({
      profileEditorVisible: false,
      nicknameDraft: this.data.currentUser.displayName || "",
      avatarDraft: this.data.currentUser.avatarUrl || ""
    });
  },

  onChooseAvatar(event) {
    const avatarUrl = (event.detail && event.detail.avatarUrl) || "";
    if (!avatarUrl) {
      return;
    }
    this.setData({
      avatarDraft: avatarUrl
    });
  },

  onNicknameInput(event) {
    this.setData({
      nicknameDraft: event.detail.value || ""
    });
  },

  async saveProfileEditor() {
    const saved = await this.persistProfile({
      displayName: String(this.data.nicknameDraft || "").trim(),
      avatarUrl: this.data.avatarDraft || ""
    });
    if (saved) {
      this.setData({
        profileEditorVisible: false
      });
    }
  },

  noop() {},

  goPage(event) {
    wx.navigateTo({
      url: event.currentTarget.dataset.url
    });
  },

  goSpaceManage() {
    wx.navigateTo({
      url: "/pages/workspace/workspace"
    });
  },
});
