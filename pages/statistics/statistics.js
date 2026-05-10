const { getStatisticsData } = require("../../services/appService");
const { parseDateId, toDateId, addDays, addMonths, addYears } = require("../../utils/date");

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

Page({
  data: {
    currentTab: "/pages/statistics/statistics",
    granularity: "month",
    selectedDate: toDateId(new Date()),
    selectedYear: new Date().getFullYear(),
    activeTab: "activity",
    scopeLabel: "",
    scope: {
      label: "",
      pickerText: ""
    },
    ui: {
      title: "\u7edf\u8ba1\u9875\u9762",
      subtitle: "\u6309\u540c\u4e00\u5957\u65f6\u95f4\u8303\u56f4\uff0c\u67e5\u770b\u6d3b\u52a8\u3001\u4efb\u52a1\u3001\u82b1\u9500\u4e0e\u4e60\u60ef\u53d8\u5316\u3002",
      day: "\u65e5",
      week: "\u5468",
      month: "\u6708",
      year: "\u5e74",
      stepPrev: "\u2039",
      stepNext: "\u203a",
      activityTab: "\u6d3b\u52a8\u7edf\u8ba1",
      taskTab: "\u4efb\u52a1\u7edf\u8ba1",
      financeTab: "\u82b1\u9500\u7edf\u8ba1",
      habitTab: "\u4e60\u60ef\u517b\u6210",
      activityCompleted: "\u5b8c\u6210\u6b21\u6570",
      activityDuration: "\u7d2f\u8ba1\u65f6\u957f / \u6570\u91cf",
      categoryRanking: "\u9ad8\u9891\u5206\u7c7b",
      noActivity: "\u5f53\u524d\u65f6\u95f4\u8303\u56f4\u8fd8\u6ca1\u6709\u53ef\u7edf\u8ba1\u7684\u6d3b\u52a8\u6570\u636e\u3002",
      taskTotal: "\u89c4\u5212\u603b\u6570",
      taskCompletion: "\u5b8c\u6210\u7387",
      taskDone: "\u5df2\u5b8c\u6210",
      taskOverdue: "\u903e\u671f",
      financeSpent: "\u82b1\u9500\u603b\u989d",
      financeCount: "\u7559\u75d5\u7b14\u6570",
      financeTrend: "\u82b1\u9500\u8d8b\u52bf",
      longestStreak: "\u5f53\u524d\u6700\u957f\u575a\u6301",
      recentTop: "\u8fd1 7 \u5929\u6700\u5e38\u51fa\u73b0",
      streakRanking: "\u8fde\u7eed\u5929\u6570",
      recentRanking: "\u8fd1 7 \u5929\u9891\u6b21",
      frequentRanking: "\u9ad8\u9891\u884c\u4e3a\u699c",
      noStreak: "\u8fd8\u6ca1\u6709\u5f62\u6210\u8fde\u7eed\u7559\u75d5\u7684\u884c\u4e3a\u3002",
      noRecent: "\u8fd1 7 \u5929\u8fd8\u6ca1\u6709\u8db3\u591f\u7684\u7559\u75d5\u6570\u636e\u3002",
      noFrequent: "\u8fd8\u6ca1\u6709\u53ef\u4ee5\u7edf\u8ba1\u7684\u9ad8\u9891\u884c\u4e3a\u3002",
      defaultStreak: "\u8fd8\u6ca1\u6709\u5f62\u6210\u7a33\u5b9a\u4e60\u60ef",
      defaultRecent: "\u8fd1 7 \u5929\u8fd8\u6ca1\u6709\u9ad8\u9891\u884c\u4e3a",
      days: "\u5929",
      times: "\u6b21",
      currency: "\u00a5",
      home: "\u9996\u9875",
      accounting: "\u8bb0\u8d26",
      statistics: "\u7edf\u8ba1",
      mine: "\u6211\u7684"
    },
    stats: {
      activity: {},
      task: {},
      finance: {},
      habit: {}
    }
  },

  async onShow() {
    await this.loadStats();
  },

  async loadStats() {
    const stats = await getStatisticsData(this.data.granularity, this.data.selectedDate, this.data.selectedYear);
    this.setData({
      stats,
      scopeLabel: stats.scope.label,
      scope: stats.scope
    });
  },

  async changeGranularity(event) {
    this.setData({
      granularity: event.currentTarget.dataset.value
    });
    await this.loadStats();
  },

  async shiftScope(event) {
    const step = Number(event.currentTarget.dataset.step || 0);
    const currentDate = parseDateId(this.data.selectedDate || toDateId(new Date()));
    let nextDate = currentDate;

    if (this.data.granularity === "day") {
      nextDate = addDays(currentDate, step);
    } else if (this.data.granularity === "week") {
      nextDate = addDays(currentDate, step * 7);
    } else if (this.data.granularity === "month") {
      nextDate = addMonths(currentDate, step);
    } else {
      nextDate = addYears(currentDate, step);
    }

    const clamped = clampDateToYear(nextDate, this.data.granularity === "year" ? nextDate.getFullYear() : this.data.selectedYear);
    this.setData({
      selectedDate: toDateId(clamped),
      selectedYear: this.data.granularity === "year" ? clamped.getFullYear() : this.data.selectedYear
    });
    await this.loadStats();
  },

  async onPickDate(event) {
    const nextDate = clampDateToYear(parseDateId(event.detail.value), this.data.selectedYear);
    this.setData({
      selectedDate: toDateId(nextDate)
    });
    await this.loadStats();
  },

  async onPickMonth(event) {
    const nextDate = clampDateToYear(parseDateId(`${event.detail.value}-01`), this.data.selectedYear);
    this.setData({
      selectedDate: toDateId(nextDate)
    });
    await this.loadStats();
  },

  async onPickYear(event) {
    const nextDate = parseDateId(`${event.detail.value}-01-01`);
    this.setData({
      selectedYear: nextDate.getFullYear(),
      selectedDate: toDateId(nextDate)
    });
    await this.loadStats();
  },

  changeTab(event) {
    this.setData({
      activeTab: event.currentTarget.dataset.value
    });
  },
});
