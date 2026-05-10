const { getAccountingData, saveAnnualGoal } = require("../../services/appService");
const { parseDateId, toDateId, addDays, addMonths } = require("../../utils/date");
const perf = require("../../utils/perf");

const PAGE_PATH = "/pages/accounting/accounting";

const PIE_COLORS = ["#ca6a4a", "#2c6e49", "#d7b074", "#8e6d53", "#7da58b", "#d89e6a"];

function clampDateToYear(date, year) {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  if (date.getTime() < yearStart.getTime()) {
    return yearStart;
  }
  if (date.getTime() > yearEnd.getTime()) {
    return yearEnd;
  }
  return date;
}

function buildPieVisualization(categoryStats) {
  const total = (categoryStats || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  if (!total) {
    return {
      pieStyle: "",
      legend: []
    };
  }

  let cursor = 0;
  const segments = [];
  const legend = categoryStats.map((item, index) => {
    const color = PIE_COLORS[index % PIE_COLORS.length];
    const amount = Number(item.amount || 0);
    const percent = Number(((amount / total) * 100).toFixed(1));
    const start = cursor;
    const end = Number((cursor + percent).toFixed(1));
    cursor = end;
    segments.push(`${color} ${start}% ${end}%`);
    return {
      ...item,
      color,
      percentText: `${percent}%`
    };
  });

  return {
    pieStyle: `background: conic-gradient(${segments.join(", ")});`,
    legend
  };
}

Page({
  data: {
    ui: {
      title: "\u8d44\u91d1\u8bb0\u8d26",
      subtitle: "\u5728\u5f53\u524d\u5e74\u5ea6\u4e0b\uff0c\u5148\u770b\u6700\u65b0\u4e00\u5929\uff0c\u518d\u770b\u8fd17\u671f\u7684\u82b1\u9500\u53d8\u5316\u3002",
      poolTitle: "\u5e74\u5ea6\u8d44\u91d1\u6c60",
      poolSubtitle: "\u5168\u5e74\u8d44\u91d1\u6d88\u8017\u8fdb\u5ea6",
      setLimit: "\u8bbe\u7f6e\u9650\u989d",
      editLimit: "\u4fee\u6539\u9650\u989d",
      limit: "\u5e74\u5ea6\u9650\u989d",
      spent: "\u5df2\u82b1\u8d39",
      overspent: "\u5df2\u8d85\u51fa",
      remaining: "\u5269\u4f59\u53ef\u7528",
      progress: "\u6d88\u8017\u8fdb\u5ea6",
      noLimit: "\u8fd8\u6ca1\u6709\u8bbe\u7f6e\u5e74\u5ea6\u9650\u989d\uff0c\u5148\u7ed9\u81ea\u5df1\u4e00\u4e2a\u5168\u5e74\u9884\u7b97\u5427\u3002",
      day: "\u65e5",
      week: "\u5468",
      month: "\u6708",
      recordCount: "\u7559\u75d5\u7b14\u6570",
      trendTag: "\u8fd1\u671f\u8d8b\u52bf",
      categoryTitle: "\u82b1\u9500\u5206\u7c7b",
      categorySubtitle: "\u6309\u5f53\u524d\u7b5b\u9009\u8303\u56f4\u805a\u5408",
      detailTitle: "\u82b1\u9500\u660e\u7ec6",
      noFinance: "\u8fd9\u4e00\u65f6\u95f4\u8303\u56f4\u8fd8\u6ca1\u6709\u82b1\u9500\u8bb0\u5f55\u3002",
      noDetail: "\u8fd8\u6ca1\u6709\u53ef\u4ee5\u5c55\u793a\u7684\u82b1\u9500\u660e\u7ec6\u3002",
      countSuffix: "\u7b14",
      categorySuffix: "\u7c7b",
      currency: "\u00a5",
      separator: "\u00b7",
      prevArrow: "<",
      nextArrow: ">",
      stepPrev: "\u2039",
      stepNext: "\u203a",
      invalidAmount: "\u8bf7\u8f93\u5165\u6709\u6548\u91d1\u989d",
      saved: "\u5e74\u5ea6\u9650\u989d\u5df2\u66f4\u65b0",
      totalSpent: "\u603b\u82b1\u9500",
      home: "\u9996\u9875",
      todo: "TODO",
      accounting: "\u8bb0\u8d26",
      statistics: "\u7edf\u8ba1",
      mine: "\u6211\u7684"
    },
    currentTab: "/pages/accounting/accounting",
    selectedYear: new Date().getFullYear(),
    granularity: "day",
    selectedDate: "",
    scopeLabel: "",
    scope: {
      label: "",
      pickerValue: "",
      anchorDateId: ""
    },
    summary: {
      spent: 0,
      remaining: 0,
      count: 0
    },
    limitPool: {
      year: new Date().getFullYear(),
      limit: 0,
      spent: 0,
      remaining: 0,
      overspent: 0,
      progress: 0,
      hasLimit: false
    },
    categoryStats: [],
    pieLegend: [],
    pieStyle: "",
    recentFinance: [],
    trend: [],
    trendTitle: ""
  },

  async onShow() {
    perf.markPageShow(PAGE_PATH);
    const cached = getApp().globalData.lastAccounting;
    if (cached) {
      this.setData(cached);
    }
    await this.loadAccounting();
    perf.log("onShow.done", PAGE_PATH);
  },

  onLoad() {
    perf.markPageLoad(PAGE_PATH);
  },

  onHide() {
    perf.markPageHide(PAGE_PATH);
  },

  onUnload() {
    perf.markPageUnload(PAGE_PATH);
  },

  async loadAccounting() {
    const data = await getAccountingData(this.data.selectedYear, this.data.granularity, this.data.selectedDate);
    const pieData = buildPieVisualization(data.categoryStats);
    const patch = {
      selectedYear: data.year,
      scopeLabel: data.scopeLabel,
      scope: data.scope,
      selectedDate: data.scope.anchorDateId || data.latestDateId,
      summary: data.summary,
      limitPool: data.limitPool,
      categoryStats: data.categoryStats,
      pieLegend: pieData.legend,
      pieStyle: pieData.pieStyle,
      recentFinance: data.recentFinance,
      trend: data.trend,
      trendTitle: data.trendTitle
    };
    this.setData(patch);
    getApp().globalData.lastAccounting = patch;
  },

  async shiftYear(event) {
    const nextYear = Number(this.data.selectedYear) + Number(event.currentTarget.dataset.step || 0);
    this.setData({
      selectedYear: nextYear,
      selectedDate: ""
    });
    await this.loadAccounting();
  },

  async changeGranularity(event) {
    this.setData({
      granularity: event.currentTarget.dataset.value,
      selectedDate: this.data.scope.anchorDateId || this.data.selectedDate
    });
    await this.loadAccounting();
  },

  async shiftScope(event) {
    const step = Number(event.currentTarget.dataset.step || 0);
    const currentDate = parseDateId(this.data.selectedDate || this.data.scope.anchorDateId);
    let nextDate = currentDate;

    if (this.data.granularity === "day") {
      nextDate = addDays(currentDate, step);
    } else if (this.data.granularity === "week") {
      nextDate = addDays(currentDate, step * 7);
    } else {
      nextDate = addMonths(currentDate, step);
    }

    this.setData({
      selectedDate: toDateId(clampDateToYear(nextDate, this.data.selectedYear))
    });
    await this.loadAccounting();
  },

  async onPickDate(event) {
    const nextDate = clampDateToYear(parseDateId(event.detail.value), this.data.selectedYear);
    this.setData({
      selectedDate: toDateId(nextDate)
    });
    await this.loadAccounting();
  },

  async onPickMonth(event) {
    const value = `${event.detail.value}-01`;
    const nextDate = clampDateToYear(parseDateId(value), this.data.selectedYear);
    this.setData({
      selectedDate: toDateId(nextDate)
    });
    await this.loadAccounting();
  },

  editLimit() {
    const currentLimit = this.data.limitPool.limit ? String(this.data.limitPool.limit) : "";
    wx.showModal({
      title: `${this.data.selectedYear}\u5e74\u5ea6\u9650\u989d`,
      editable: true,
      placeholderText: "\u8f93\u5165\u5168\u5e74\u53ef\u7528\u7684\u8d44\u91d1\u9650\u989d",
      content: currentLimit,
      success: (res) => {
        if (!res.confirm) {
          return;
        }
        const amount = Number(String(res.content || "").trim());
        if (Number.isNaN(amount) || amount < 0) {
          wx.showToast({
            title: this.data.ui.invalidAmount,
            icon: "none"
          });
          return;
        }
        saveAnnualGoal(this.data.selectedYear, amount);
        this.loadAccounting();
        wx.showToast({
          title: this.data.ui.saved,
          icon: "success"
        });
      }
    });
  },

  openRecord(event) {
    wx.navigateTo({
      url: `/pages/detail-edit/detail-edit?id=${event.currentTarget.dataset.id}`
    });
  },
});
