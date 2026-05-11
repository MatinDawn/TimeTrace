const { getAnnualGoal, setAnnualGoal } = require("../../utils/store");
const {
  getToday,
  toDateId,
  getScopeInfo,
  parseDateId,
  addDays,
  addMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth
} = require("../../utils/date");
const {
  filterRecordsByScope,
  buildFinanceSummary,
  decorateFinanceSummary,
  groupAmountByCategory,
  buildTrend,
  buildActivityStats,
  buildTaskStats,
  buildHabitStats,
  getTodayRecords
} = require("../../utils/stats");
const {
  RECORD_TYPE,
  RECORD_STATUS,
  DIRECTION
} = require("../../utils/constants");
const {
  callBridge,
  buildScopePayload,
  withRemoteFallback
} = require("./service-runtime");
const { isExpenseRecord } = require("./record-normalizer");
const {
  getRecords,
  getDrafts
} = require("./records");

async function getHomeData() {
  const todayId = toDateId(getToday());
  return withRemoteFallback(
    () => callBridge("getHomeSummary", buildScopePayload({ todayId })),
    async () => {
      const records = await getRecords();
      const todayCompleted = records.filter((item) => !item.isDraft && item.recordType === RECORD_TYPE.DONE && item.recordTime === todayId);
      const todayPlans = records.filter((item) => !item.isDraft && item.recordType === RECORD_TYPE.PLAN && item.status !== RECORD_STATUS.DONE && item.dueDate && item.dueDate > todayId);

      return {
        todayCompleted,
        todayPlans,
        draftCount: (await getDrafts()).length,
        todayRecordCount: getTodayRecords(records).length
      };
    }
  );
}

async function getPlans(statusFilter) {
  const records = (await getRecords()).filter((item) => item.recordType === RECORD_TYPE.PLAN && !item.isDraft);
  if (!statusFilter || statusFilter === "all") {
    return records;
  }
  if (statusFilter === RECORD_STATUS.TODO) {
    return records.filter((item) => item.status === RECORD_STATUS.TODO || item.status === RECORD_STATUS.OVERDUE);
  }
  return records.filter((item) => item.status === statusFilter);
}

async function getTodoCalendarData(monthValue, selectedDateId) {
  const todayId = toDateId(getToday());
  return withRemoteFallback(
    () => callBridge("getTodoCalendarSummary", buildScopePayload({
      monthValue,
      selectedDateId,
      todayId
    })),
    async () => {
      const allPlans = await getPlans("all");
      const monthPlans = allPlans.filter((item) => item.dueDate && String(item.dueDate || "").slice(0, 7) === monthValue);
      const plans = monthPlans.filter((item) => item.dueDate === selectedDateId && item.status !== RECORD_STATUS.OVERDUE);
      const overduePlans = allPlans.filter((item) => {
        if (!item.dueDate) {
          return false;
        }
        return item.status === RECORD_STATUS.OVERDUE || (item.status === RECORD_STATUS.TODO && item.dueDate < todayId);
      });
      return {
        monthValue,
        selectedDateId,
        plans,
        monthPlans,
        overduePlans,
        dayCounts: monthPlans.reduce((acc, item) => {
          acc[item.dueDate] = (acc[item.dueDate] || 0) + 1;
          return acc;
        }, {})
      };
    }
  );
}

function buildYearlyExpenseTrend(records, year) {
  const buckets = Array.from({ length: 12 }, (_, index) => ({
    label: `${index + 1}月`,
    amount: 0
  }));

  (records || []).forEach((item) => {
    const date = parseDateId(item.recordTime || "");
    if (date.getFullYear() !== year) {
      return;
    }
    buckets[date.getMonth()].amount += Number(item.amount || 0);
  });

  const maxAmount = buckets.reduce((max, item) => Math.max(max, item.amount), 0) || 1;
  return buckets.map((item) => ({
    label: item.label,
    amount: Number(item.amount.toFixed(2)),
    height: `${Math.max(item.amount > 0 ? 16 : 8, Math.round((item.amount / maxAmount) * 100))}%`
  }));
}

function getYearBoundary(year) {
  return {
    start: new Date(year, 0, 1),
    end: new Date(year, 11, 31)
  };
}

function getLatestRecordDateId(records, year) {
  const yearStart = new Date(year, 0, 1).getTime();
  const yearEnd = new Date(year, 11, 31).getTime();
  let latest = null;

  (records || []).forEach((item) => {
    const date = parseDateId(item.recordTime || "");
    const time = date.getTime();
    if (time < yearStart || time > yearEnd) {
      return;
    }
    if (!latest || time > latest.getTime()) {
      latest = date;
    }
  });

  if (latest) {
    return toDateId(latest);
  }

  const today = getToday();
  return toDateId(year === today.getFullYear() ? today : new Date(year, 0, 1));
}

function clampDateToYear(date, year) {
  const boundary = getYearBoundary(year);
  if (date.getTime() < boundary.start.getTime()) {
    return boundary.start;
  }
  if (date.getTime() > boundary.end.getTime()) {
    return boundary.end;
  }
  return date;
}

function buildAccountingScope(year, granularity, selectedDate, latestDateId) {
  const today = getToday();
  const fallbackDate = parseDateId(latestDateId || toDateId(year === today.getFullYear() ? today : new Date(year, 0, 1)));
  const anchor = clampDateToYear(parseDateId(selectedDate || toDateId(fallbackDate)), year);

  if (granularity === "day") {
    return {
      granularity,
      start: anchor,
      end: anchor,
      label: `${anchor.getMonth() + 1}月${anchor.getDate()}日`,
      pickerValue: toDateId(anchor),
      anchorDateId: toDateId(anchor)
    };
  }

  if (granularity === "week") {
    const start = clampDateToYear(startOfWeek(anchor), year);
    const end = clampDateToYear(endOfWeek(anchor), year);
    return {
      granularity,
      start,
      end,
      label: `${start.getMonth() + 1}/${start.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`,
      pickerValue: toDateId(anchor),
      anchorDateId: toDateId(anchor)
    };
  }

  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  return {
    granularity: "month",
    start: clampDateToYear(monthStart, year),
    end: clampDateToYear(monthEnd, year),
    label: `${anchor.getMonth() + 1}月`,
    pickerValue: `${year}-${String(anchor.getMonth() + 1).padStart(2, "0")}`,
    anchorDateId: toDateId(anchor)
  };
}

function buildScopedExpenseTrend(records, granularity, scope, year) {
  let buckets = [];

  if (granularity === "day") {
    const start = clampDateToYear(addDays(scope.end, -6), year);
    const days = Math.round((scope.end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    buckets = Array.from({ length: days + 1 }, (_, index) => {
      const date = addDays(start, index);
      return {
        label: `${date.getMonth() + 1}/${date.getDate()}`,
        start: date,
        end: date
      };
    });
  } else if (granularity === "week") {
    for (let offset = 6; offset >= 0; offset -= 1) {
      const anchor = addDays(scope.end, -offset * 7);
      if (anchor.getFullYear() !== year && anchor.getTime() < new Date(year, 0, 1).getTime()) {
        continue;
      }
      const start = clampDateToYear(startOfWeek(anchor), year);
      const end = clampDateToYear(endOfWeek(anchor), year);
      buckets.push({
        label: `${start.getMonth() + 1}/${start.getDate()}`,
        start,
        end
      });
    }
  } else {
    for (let offset = 6; offset >= 0; offset -= 1) {
      const anchor = addMonths(scope.start, -offset);
      if (anchor.getFullYear() !== year && anchor.getTime() < new Date(year, 0, 1).getTime()) {
        continue;
      }
      const start = clampDateToYear(startOfMonth(anchor), year);
      const end = clampDateToYear(endOfMonth(anchor), year);
      buckets.push({
        label: `${start.getMonth() + 1}月`,
        start,
        end
      });
    }
  }

  const points = buckets.map((bucket) => {
    const amount = filterRecordsByScope(records, bucket).reduce((sum, item) => {
      return sum + Number(item.amount || 0);
    }, 0);
    return {
      label: bucket.label,
      amount: Number(amount.toFixed(2))
    };
  });

  const maxAmount = points.reduce((max, item) => Math.max(max, item.amount), 0) || 1;
  return points.map((item) => ({
    ...item,
    height: `${Math.max(item.amount > 0 ? 18 : 8, Math.round((item.amount / maxAmount) * 100))}%`
  }));
}

async function getAccountingData(selectedYear, granularity, selectedDate) {
  return withRemoteFallback(
    () => callBridge("getAccountingSummary", buildScopePayload({
      selectedYear,
      granularity,
      selectedDate,
      annualLimit: getAnnualGoal(Number(selectedYear || getToday().getFullYear()))
    })),
    async () => {
      const year = Number(selectedYear || getToday().getFullYear());
      const yearScope = getScopeInfo("year", toDateId(getToday()), year);
      const expenseRecords = (await getRecords()).filter((item) => {
        return !item.isDraft && item.recordType === RECORD_TYPE.DONE && Number(item.amount || 0) > 0 && item.direction !== DIRECTION.INCOME;
      });
      const yearRecords = filterRecordsByScope(expenseRecords, yearScope);
      const latestDateId = getLatestRecordDateId(yearRecords, year);
      const analysisGranularity = granularity || "day";
      const scope = buildAccountingScope(year, analysisGranularity, selectedDate, latestDateId);
      const scopedRecords = filterRecordsByScope(yearRecords, scope);
      const spent = Number(yearRecords.reduce((sum, item) => sum + Number(item.amount || 0), 0).toFixed(2));
      const annualLimit = getAnnualGoal(year);
      const remaining = annualLimit > 0 ? Number(Math.max(annualLimit - spent, 0).toFixed(2)) : 0;
      const overspent = annualLimit > 0 && spent > annualLimit ? Number((spent - annualLimit).toFixed(2)) : 0;
      const progress = annualLimit > 0 ? Math.max(0, Math.min(100, Math.round((spent / annualLimit) * 100))) : 0;

      return {
        year,
        scopeLabel: `${year}年`,
        scope,
        latestDateId,
        summary: {
          spent: Number(scopedRecords.reduce((sum, item) => sum + Number(item.amount || 0), 0).toFixed(2)),
          remaining,
          count: scopedRecords.length
        },
        limitPool: {
          year,
          limit: annualLimit,
          spent,
          remaining,
          overspent,
          progress,
          hasLimit: annualLimit > 0
        },
        categoryStats: groupAmountByCategory(scopedRecords).slice(0, 6),
        recentFinance: scopedRecords.slice(0, 10),
        trendTitle:
          analysisGranularity === "day"
            ? "近7天花销"
            : analysisGranularity === "week"
              ? "近7周花销"
              : "近7个月花销",
        trend: buildScopedExpenseTrend(yearRecords, analysisGranularity, scope, year),
        annualTrend: buildYearlyExpenseTrend(yearRecords, year)
      };
    }
  );
}

function saveAnnualGoal(year, amount) {
  return setAnnualGoal(year, amount);
}

async function getStatisticsData(granularity, selectedDate, selectedYear) {
  return withRemoteFallback(
    () => callBridge("getStatisticsSummary", buildScopePayload({
      granularity,
      selectedDate,
      selectedYear
    })),
    async () => {
      const records = (await getRecords()).filter((item) => !item.isDraft);
      const scope = getScopeInfo(granularity, selectedDate, selectedYear);
      const activityScopedRecords = filterRecordsByScope(
        records.filter((item) => item.recordType === RECORD_TYPE.DONE && item.recordTime),
        scope
      );
      const taskScopedRecords = filterRecordsByScope(
        records.filter((item) => item.recordType === RECORD_TYPE.PLAN && item.dueDate),
        {
          ...scope,
          dateField: "dueDate"
        }
      );
      const financeRecords = activityScopedRecords.filter(isExpenseRecord);

      return {
        scope,
        activity: buildActivityStats(activityScopedRecords),
        task: buildTaskStats(taskScopedRecords),
        finance: {
          ...decorateFinanceSummary(buildFinanceSummary(financeRecords)),
          trend: buildTrend(records.filter(isExpenseRecord), granularity, selectedDate, selectedYear)
        },
        habit: buildHabitStats(activityScopedRecords)
      };
    }
  );
}

module.exports = {
  getHomeData,
  getTodoCalendarData,
  getPlans,
  getAccountingData,
  saveAnnualGoal,
  getStatisticsData
};
