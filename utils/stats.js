const { getScopeInfo, parseDateId, toDateId, addDays } = require("./date");

function filterRecordsByScope(records, scope) {
  const startTime = scope.start.getTime();
  const endTime = scope.end.getTime();
  const dateField = scope.dateField || "recordTime";

  return (records || []).filter((item) => {
    const dateValue = item[dateField] || item.recordTime || item.date;
    if (!dateValue) {
      return false;
    }
    const date = parseDateId(dateValue);
    const time = date.getTime();
    return time >= startTime && time <= endTime;
  });
}

function buildFinanceSummary(records) {
  return (records || []).reduce(
    (acc, item) => {
      if (item.direction === "income") {
        acc.income += Number(item.amount || 0);
      } else {
        acc.expense += Number(item.amount || 0);
      }
      acc.count += 1;
      return acc;
    },
    { income: 0, expense: 0, balance: 0, count: 0 }
  );
}

function decorateFinanceSummary(summary) {
  return {
    income: Number(summary.income.toFixed(2)),
    expense: Number(summary.expense.toFixed(2)),
    balance: Number((summary.income - summary.expense).toFixed(2)),
    count: summary.count
  };
}

function groupAmountByCategory(records) {
  const totals = {};
  (records || []).forEach((item) => {
    if (!item.amount) {
      return;
    }
    const key = item.categoryName || "其他";
    totals[key] = (totals[key] || 0) + Number(item.amount || 0);
  });

  return Object.keys(totals)
    .map((key) => ({ name: key, amount: Number(totals[key].toFixed(2)) }))
    .sort((a, b) => b.amount - a.amount);
}

function buildTrend(records, granularity, anchorDateId, selectedYear) {
  const scope = getScopeInfo(granularity, anchorDateId, selectedYear);
  const buckets = [];

  if (granularity === "day") {
    for (let index = 0; index < 7; index += 1) {
      const date = addDays(scope.end, index - 6);
      buckets.push({
        label: `${date.getMonth() + 1}/${date.getDate()}`,
        start: date,
        end: date
      });
    }
  } else if (granularity === "week") {
    for (let index = 0; index < 8; index += 1) {
      const end = addDays(scope.end, (index - 7) * 7);
      const start = addDays(end, -6);
      buckets.push({
        label: `${start.getMonth() + 1}/${start.getDate()}`,
        start,
        end
      });
    }
  } else if (granularity === "month") {
    for (let index = 0; index < 6; index += 1) {
      const current = new Date(scope.start.getFullYear(), scope.start.getMonth() + index - 5, 1);
      const start = new Date(current.getFullYear(), current.getMonth(), 1);
      const end = new Date(current.getFullYear(), current.getMonth() + 1, 0);
      buckets.push({
        label: `${start.getMonth() + 1}月`,
        start,
        end
      });
    }
  } else {
    for (let index = 0; index < 5; index += 1) {
      const year = scope.start.getFullYear() + index - 4;
      buckets.push({
        label: `${year}`,
        start: new Date(year, 0, 1),
        end: new Date(year, 11, 31)
      });
    }
  }

  const points = buckets.map((bucket) => {
    const amount = filterRecordsByScope(records, bucket).reduce((sum, item) => {
      if (item.direction === "income") {
        return sum;
      }
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
    height: `${Math.max(8, Math.round((item.amount / maxAmount) * 100))}%`
  }));
}

function getTrendTitle(granularity) {
  if (granularity === "day") {
    return "近7日支出趋势";
  }
  if (granularity === "week") {
    return "近8周支出趋势";
  }
  if (granularity === "month") {
    return "近6月支出趋势";
  }
  return "近5年支出趋势";
}

function buildActivityStats(records) {
  const doneRecords = (records || []).filter((item) => item.recordType === "done" && !item.isDraft);
  const durationCount = doneRecords.reduce((sum, item) => {
    const numeric = parseFloat(item.durationQuantity) || 0;
    return sum + numeric;
  }, 0);
  return {
    completedCount: doneRecords.length,
    durationCount: Number(durationCount.toFixed(1)),
    categoryRanking: groupAmountByCategory(doneRecords).slice(0, 3)
  };
}

function buildTaskStats(records) {
  const plans = (records || []).filter((item) => item.recordType === "plan" && !item.isDraft);
  const completed = plans.filter((item) => item.status === "done");
  const overdue = plans.filter((item) => item.status === "overdue");
  const rate = plans.length ? Math.round((completed.length / plans.length) * 100) : 0;
  return {
    total: plans.length,
    completed: completed.length,
    overdue: overdue.length,
    completionRate: rate
  };
}

function buildHabitStats(records) {
  const doneRecords = (records || []).filter((item) => item.recordType === "done" && !item.isDraft);
  const behaviorMap = {};

  doneRecords.forEach((item) => {
    const rawName = String(item.actionName || item.categoryName || "").trim();
    if (!rawName) {
      return;
    }
    const name = rawName.length > 12 ? `${rawName.slice(0, 12)}...` : rawName;
    if (!behaviorMap[name]) {
      behaviorMap[name] = {
        name,
        dates: [],
        count: 0
      };
    }
    behaviorMap[name].dates.push(item.recordTime);
    behaviorMap[name].count += 1;
  });

  const latestSevenDays = [];
  const today = toDateId(new Date());
  const todayDate = parseDateId(today);
  for (let offset = 6; offset >= 0; offset -= 1) {
    latestSevenDays.push(toDateId(addDays(todayDate, -offset)));
  }
  const latestSevenDaySet = new Set(latestSevenDays);

  const behaviorList = Object.keys(behaviorMap).map((key) => {
    const item = behaviorMap[key];
    const uniqueDays = Array.from(new Set(item.dates)).sort();
    let currentStreak = 0;
    let longestStreak = 0;
    let previous = null;

    uniqueDays.forEach((day) => {
      if (!previous) {
        currentStreak = 1;
      } else {
        const diff = (parseDateId(day).getTime() - parseDateId(previous).getTime()) / (1000 * 60 * 60 * 24);
        currentStreak = diff === 1 ? currentStreak + 1 : 1;
      }
      longestStreak = Math.max(longestStreak, currentStreak);
      previous = day;
    });

    let latestStreak = 0;
    let cursor = today;
    const daySet = new Set(uniqueDays);
    while (daySet.has(cursor)) {
      latestStreak += 1;
      cursor = toDateId(addDays(parseDateId(cursor), -1));
    }

    const recentCount = item.dates.filter((dateId) => latestSevenDaySet.has(dateId)).length;

    return {
      name: item.name,
      totalCount: item.count,
      recentCount,
      latestStreak,
      longestStreak
    };
  });

  const streakRanking = behaviorList
    .filter((item) => item.latestStreak > 0)
    .sort((a, b) => {
      if (b.latestStreak !== a.latestStreak) {
        return b.latestStreak - a.latestStreak;
      }
      return b.totalCount - a.totalCount;
    })
    .slice(0, 3);

  const recentRanking = behaviorList
    .filter((item) => item.recentCount > 0)
    .sort((a, b) => {
      if (b.recentCount !== a.recentCount) {
        return b.recentCount - a.recentCount;
      }
      return b.totalCount - a.totalCount;
    })
    .slice(0, 5);

  const frequentRanking = behaviorList
    .sort((a, b) => b.totalCount - a.totalCount)
    .slice(0, 5);

  return {
    topStreakName: streakRanking.length ? streakRanking[0].name : "",
    topStreakDays: streakRanking.length ? streakRanking[0].latestStreak : 0,
    topRecentName: recentRanking.length ? recentRanking[0].name : "",
    topRecentCount: recentRanking.length ? recentRanking[0].recentCount : 0,
    streakRanking,
    recentRanking,
    frequentRanking
  };
}

function getTodayRecords(records) {
  const todayId = toDateId(new Date());
  return (records || []).filter((item) => item.recordTime === todayId && !item.isDraft);
}

module.exports = {
  filterRecordsByScope,
  buildFinanceSummary,
  decorateFinanceSummary,
  groupAmountByCategory,
  buildTrend,
  getTrendTitle,
  buildActivityStats,
  buildTaskStats,
  buildHabitStats,
  getTodayRecords
};
