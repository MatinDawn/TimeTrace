const {
  getDrafts,
  batchDeleteRecords,
  batchUpdateCategory,
  getCategories
} = require("../../services/appService");

Page({
  data: {
    keyword: "",
    drafts: [],
    manageMode: false,
    selectedIds: [],
    categories: [],
    ui: {
      title: "\u8349\u7a3f\u7bb1",
      subtitle: "\u8fd8\u6ca1\u6709\u786e\u8ba4\u63d0\u4ea4\u7684\u7559\u75d5\uff0c\u90fd\u4f1a\u5148\u6536\u5728\u8fd9\u91cc\u3002",
      manage: "\u6279\u91cf\u7ba1\u7406",
      done: "\u5b8c\u6210",
      searchPlaceholder: "\u641c\u7d22\u8349\u7a3f\u5173\u952e\u8bcd",
      batchCategory: "\u6279\u91cf\u6539\u5206\u7c7b",
      batchDelete: "\u6279\u91cf\u5220\u9664",
      delete: "\u5220\u9664",
      improve: "\u5f85\u786e\u8ba4",
      selected: "\u5df2\u9009",
      sourceText: "\u6765\u6e90",
      timeText: "\u65f6\u95f4",
      categoryText: "\u5206\u7c7b",
      empty: "\u8349\u7a3f\u7bb1\u8fd8\u662f\u7a7a\u7684\uff0c\u53bb\u9996\u9875\u5148\u7559\u4e0b\u7b2c\u4e00\u6761\u5427\u3002",
      selectFirst: "\u5148\u9009\u62e9\u8349\u7a3f",
      separator: "\u00b7"
    }
  },

  onShow() {
    this.loadDrafts();
  },

  async loadDrafts() {
    this.setData({
      drafts: await getDrafts(this.data.keyword),
      categories: getCategories()
    });
  },

  onSearchInput(event) {
    this.setData({
      keyword: event.detail.value
    });
    this.loadDrafts();
  },

  toggleManageMode() {
    this.setData({
      manageMode: !this.data.manageMode,
      selectedIds: []
    });
  },

  toggleSelect(event) {
    const recordId = event.currentTarget.dataset.id;
    const selectedIds = this.data.selectedIds.slice();
    const index = selectedIds.indexOf(recordId);

    if (index >= 0) {
      selectedIds.splice(index, 1);
    } else {
      selectedIds.push(recordId);
    }

    this.setData({
      selectedIds
    });
  },

  async removeDraft(event) {
    await batchDeleteRecords([event.currentTarget.dataset.id]);
    await this.loadDrafts();
  },

  async batchDelete() {
    if (!this.data.selectedIds.length) {
      wx.showToast({
        title: this.data.ui.selectFirst,
        icon: "none"
      });
      return;
    }

    await batchDeleteRecords(this.data.selectedIds);
    this.setData({
      selectedIds: []
    });
    await this.loadDrafts();
  },

  batchChangeCategory() {
    if (!this.data.selectedIds.length) {
      wx.showToast({
        title: this.data.ui.selectFirst,
        icon: "none"
      });
      return;
    }

    const names = this.data.categories.map((item) => item.name);
    wx.showActionSheet({
      itemList: names,
      success: async (res) => {
        const category = this.data.categories[res.tapIndex];
        await batchUpdateCategory(this.data.selectedIds, category.id);
        this.setData({
          selectedIds: []
        });
        await this.loadDrafts();
      }
    });
  },

  openDetail(event) {
    const mode = event.currentTarget.dataset.mode || "normal";
    wx.navigateTo({
      url: `/pages/detail-edit/detail-edit?id=${event.currentTarget.dataset.id}&mode=${mode}`
    });
  }
});
