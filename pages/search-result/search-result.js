const { searchRecords } = require("../../services/appService");

Page({
  data: {
    keyword: "",
    results: []
  },

  async onLoad(options) {
    const keyword = decodeURIComponent(options.keyword || "");
    this.setData({
      keyword
    });
    await this.loadResults();
  },

  onInput(event) {
    this.setData({
      keyword: event.detail.value
    });
  },

  async loadResults() {
    this.setData({
      results: await searchRecords(this.data.keyword)
    });
  },

  async submitSearch() {
    await this.loadResults();
  },

  openRecord(event) {
    wx.navigateTo({
      url: `/pages/detail-edit/detail-edit?id=${event.currentTarget.dataset.id}`
    });
  }
});
