const { getHabitData } = require("../../services/appService");
const perf = require("../../utils/perf");

const PAGE_PATH = "/pages/habit/habit";

function buildEmptyHabit() {
  return {
    overview: {
      totalHabits: 0,
      growthLevel: 0,
      topStreakName: "",
      topStreakDays: 0,
      topLongestStreakDays: 0,
      topRecentName: "",
      topRecentCount: 0,
      topFrequentName: "",
      topFrequentCount: 0
    },
    streakRanking: [],
    recentRanking: [],
    frequentRanking: []
  };
}

function getGrowthText(ui, level) {
  if (level >= 3) {
    return ui.treeGrowth;
  }
  if (level === 2) {
    return ui.growingGrowth;
  }
  if (level === 1) {
    return ui.sproutGrowth;
  }
  return ui.emptyGrowth;
}

Page({
  data: {
    currentTab: PAGE_PATH,
    ui: {
      title: "习惯",
      subtitle: "从你已经留下的记录里，自动长出正在坚持的事情。",
      growthLabel: "成长状态",
      emptyGrowth: "还没有习惯",
      sproutGrowth: "开始发芽",
      growingGrowth: "正在生长",
      treeGrowth: "稳定小树",
      currentStreak: "当前连续",
      recentActive: "近 7 天活跃",
      totalHabits: "已发现习惯",
      totalTimes: "累计次数",
      streakRanking: "连续坚持榜",
      recentRanking: "近 7 天活跃榜",
      frequentRanking: "高频习惯榜",
      noHabit: "先在首页留下几条做过的事情，习惯会在这里自动生长。",
      noStreak: "今天还没有形成连续坚持的习惯。",
      noRecent: "近 7 天还没有足够的习惯记录。",
      noFrequent: "还没有可以归纳的高频习惯。",
      days: "天",
      times: "次"
    },
    habit: buildEmptyHabit(),
    growthText: "还没有习惯",
    loading: false
  },

  async onShow() {
    perf.markPageShow(PAGE_PATH);
    const cached = getApp().globalData.lastHabitData;
    if (cached) {
      this.setData({
        habit: cached,
        growthText: getGrowthText(this.data.ui, cached.overview && cached.overview.growthLevel)
      });
    }
    await this.loadHabit();
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

  async loadHabit() {
    if (this.data.loading) {
      return;
    }
    this.setData({ loading: true });
    try {
      const habit = await getHabitData();
      const nextHabit = {
        ...buildEmptyHabit(),
        ...(habit || {}),
        overview: {
          ...buildEmptyHabit().overview,
          ...((habit && habit.overview) || {})
        }
      };
      this.setData({
        habit: nextHabit,
        growthText: getGrowthText(this.data.ui, nextHabit.overview.growthLevel)
      });
      getApp().globalData.lastHabitData = nextHabit;
    } catch (error) {
      console.warn("[habit.loadHabit] failed", error);
      wx.showToast({
        title: "习惯加载失败",
        icon: "none"
      });
    } finally {
      this.setData({ loading: false });
    }
  }
});
