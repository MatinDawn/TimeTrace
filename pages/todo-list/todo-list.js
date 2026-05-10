const { getTodoCalendarData, completePlanWithTrace } = require("../../services/appService");
const { getToday, toDateId } = require("../../utils/date");
const perf = require("../../utils/perf");

const PAGE_PATH = "/pages/todo-list/todo-list";
const MONTH_CACHE_TTL = 30000;

function monthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function parseMonthValue(value) {
  const matched = String(value || "").match(/^(\d{4})-(\d{2})$/);
  if (!matched) {
    const today = getToday();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  }
  return new Date(Number(matched[1]), Number(matched[2]) - 1, 1);
}

function toMonthValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getDefaultSelectedDateForMonth(anchorMonth) {
  const today = getToday();
  if (anchorMonth.getFullYear() === today.getFullYear() && anchorMonth.getMonth() === today.getMonth()) {
    return toDateId(today);
  }
  return toDateId(new Date(anchorMonth.getFullYear(), anchorMonth.getMonth(), 1));
}

function buildCalendarDays(anchorMonth, selectedDateId, dayCounts) {
  const today = getToday();
  const todayId = toDateId(today);
  const year = anchorMonth.getFullYear();
  const month = anchorMonth.getMonth();
  const firstDay = monthStart(anchorMonth);
  const leading = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let index = 0; index < leading; index += 1) {
    cells.push({ key: `empty_${index}`, empty: true });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const dateId = toDateId(date);
    const disabled = dateId < todayId;
    const count = Number(dayCounts[dateId] || 0);
    cells.push({
      key: dateId,
      empty: false,
      label: String(day),
      dateId,
      disabled,
      isToday: dateId === todayId,
      isSelected: dateId === selectedDateId,
      hasTasks: count > 0,
      count
    });
  }

  return cells;
}

Page({
  data: {
    ui: {
      title: "\u4efb\u52a1\u65e5\u5386",
      subtitle: "\u6309\u6708\u5feb\u901f\u5b9a\u4f4d\uff0c\u70b9\u51fb\u67d0\u4e00\u5929\u67e5\u770b\u90a3\u5929\u7684\u4efb\u52a1\u3002",
      weekHeaders: ["\u4e00", "\u4e8c", "\u4e09", "\u56db", "\u4e94", "\u516d", "\u65e5"],
      noPlans: "\u8fd9\u4e00\u5929\u8fd8\u6ca1\u6709\u4efb\u52a1\u3002",
      overdueTitle: "\u903e\u671f\u5f85\u5904\u7406",
      overdueSubtitle: "\u8fd9\u4e9b\u4efb\u52a1\u5df2\u7ecf\u9519\u8fc7\u539f\u5b9a\u65f6\u95f4\uff0c\u53ef\u4ee5\u5feb\u901f\u7559\u75d5\u6216\u91cd\u65b0\u68b3\u7406\u3002",
      selectedDateTitle: "\u5f53\u65e5\u4efb\u52a1",
      selectedDateSubtitle: "\u6311\u4e00\u4ef6\u5148\u5b8c\u6210\uff0c\u518d\u628a\u75d5\u8ff9\u8f7b\u8f7b\u7559\u4e0b\u3002",
      quickTrace: "\u5feb\u901f\u7559\u75d5",
      quickTraceDone: "\u5df2\u7559\u4e0b\u4eca\u5929\u7684\u75d5\u8ff9",
      today: "\u4eca\u5929"
    },
    currentTab: "/pages/todo-list/todo-list",
    anchorMonthId: "",
    selectedDateId: "",
    monthValue: "",
    calendarDays: [],
    monthLabel: "",
    weekHeaders: [],
    plans: [],
    overduePlans: []
  },

  onLoad() {
    perf.markPageLoad(PAGE_PATH);
    this.monthCache = {};
    this.overdueCache = null;
    const today = getToday();
    const month = monthStart(today);
    this.setData({
      anchorMonthId: toDateId(month),
      selectedDateId: toDateId(today),
      monthValue: toMonthValue(month),
      weekHeaders: this.data.ui.weekHeaders
    });
  },

  onHide() {
    perf.markPageHide(PAGE_PATH);
  },

  onUnload() {
    perf.markPageUnload(PAGE_PATH);
  },

  async onShow() {
    perf.markPageShow(PAGE_PATH);
    const cached = getApp().globalData.lastTodoCalendar;
    if (cached) {
      this.setData(cached);
    }
    await this.refreshTodoCalendar();
    perf.log("onShow.done", PAGE_PATH);
  },

  async onPullDownRefresh() {
    try {
      await this.refreshTodoCalendar({ force: true });
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  applyMonthCache(monthValue) {
    const monthEntry = this.monthCache && this.monthCache[monthValue];
    if (!monthEntry) {
      return false;
    }
    const anchorMonth = new Date(this.data.anchorMonthId);
    const selectedDateId = this.data.selectedDateId;
    const monthPlans = monthEntry.monthPlans || [];
    const dayCounts = monthEntry.dayCounts || {};
    const overduePlans = (this.overdueCache && this.overdueCache.plans) || [];

    const patch = {
      monthLabel: `${anchorMonth.getFullYear()}\u5e74${anchorMonth.getMonth() + 1}\u6708`,
      monthValue,
      calendarDays: buildCalendarDays(anchorMonth, selectedDateId, dayCounts),
      plans: monthPlans.filter((item) => item.dueDate === selectedDateId),
      overduePlans
    };
    this.setData(patch);
    getApp().globalData.lastTodoCalendar = patch;
    return true;
  },

  async refreshTodoCalendar(options) {
    const force = !!(options && options.force);
    const monthValue = this.data.monthValue;
    const monthEntry = this.monthCache && this.monthCache[monthValue];
    const monthFresh = monthEntry && Date.now() - monthEntry.fetchedAt < MONTH_CACHE_TTL;
    const overdueFresh = this.overdueCache && Date.now() - this.overdueCache.fetchedAt < MONTH_CACHE_TTL;

    if (!force && monthEntry) {
      this.applyMonthCache(monthValue);
      if (monthFresh && overdueFresh) {
        return;
      }
    }

    const summary = await getTodoCalendarData(monthValue, this.data.selectedDateId);
    const monthPlans = summary.monthPlans || summary.plans || [];
    this.monthCache = this.monthCache || {};
    this.monthCache[monthValue] = {
      monthPlans,
      dayCounts: summary.dayCounts || {},
      fetchedAt: Date.now()
    };
    this.overdueCache = {
      plans: summary.overduePlans || [],
      fetchedAt: Date.now()
    };
    this.applyMonthCache(monthValue);
  },

  onMonthPickerChange(event) {
    const month = parseMonthValue(event.detail.value);
    const monthValue = event.detail.value;
    this.setData({
      anchorMonthId: toDateId(month),
      monthValue,
      selectedDateId: getDefaultSelectedDateForMonth(month)
    });
    const hit = this.applyMonthCache(monthValue);
    const entry = this.monthCache && this.monthCache[monthValue];
    const stale = !entry || Date.now() - entry.fetchedAt >= MONTH_CACHE_TTL;
    if (!hit || stale) {
      this.refreshTodoCalendar();
    }
  },

  jumpToToday() {
    const today = getToday();
    const month = monthStart(today);
    const monthValue = toMonthValue(month);
    this.setData({
      anchorMonthId: toDateId(month),
      selectedDateId: toDateId(today),
      monthValue
    });
    const hit = this.applyMonthCache(monthValue);
    const entry = this.monthCache && this.monthCache[monthValue];
    const stale = !entry || Date.now() - entry.fetchedAt >= MONTH_CACHE_TTL;
    if (!hit || stale) {
      this.refreshTodoCalendar();
    }
  },

  selectDate(event) {
    const { dateid, disabled } = event.currentTarget.dataset;
    if (!dateid || disabled) {
      return;
    }
    this.setData({
      selectedDateId: dateid
    });
    if (!this.applyMonthCache(this.data.monthValue)) {
      this.refreshTodoCalendar();
    }
  },

  openRecord(event) {
    wx.navigateTo({
      url: `/pages/detail-edit/detail-edit?id=${event.currentTarget.dataset.id}`
    });
  },

  async quickTrace(event) {
    await completePlanWithTrace(event.currentTarget.dataset.id);
    wx.showToast({
      title: this.data.ui.quickTraceDone,
      icon: "success"
    });
    this.monthCache = {};
    this.overdueCache = null;
    await this.refreshTodoCalendar({ force: true });
  }
});
