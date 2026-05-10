function pad(value) {
  return String(value).padStart(2, "0");
}

function toDateId(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateId(value) {
  const matched = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!matched) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  return new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]));
}

function parseDateTime(value) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? new Date() : new Date(time);
}

function formatDateTime(value) {
  const date = value instanceof Date ? value : parseDateTime(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function addDays(date, amount) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function addYears(date, amount) {
  return new Date(date.getFullYear() + amount, 0, 1);
}

function startOfWeek(date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(date, diff);
}

function endOfWeek(date) {
  return addDays(startOfWeek(date), 6);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfYear(date) {
  return new Date(date.getFullYear(), 0, 1);
}

function endOfYear(date) {
  return new Date(date.getFullYear(), 11, 31);
}

function getToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function resolveRelativeDate(text) {
  const normalized = String(text || "");
  const today = getToday();

  if (normalized.includes("\u524d\u5929")) {
    return addDays(today, -2);
  }
  if (normalized.includes("\u6628\u5929")) {
    return addDays(today, -1);
  }
  if (normalized.includes("\u660e\u5929")) {
    return addDays(today, 1);
  }
  if (normalized.includes("\u540e\u5929")) {
    return addDays(today, 2);
  }
  if (normalized.includes("\u4eca\u5929") || normalized.includes("\u521a\u521a")) {
    return today;
  }
  return null;
}

function resolveDateFromText(text) {
  const relative = resolveRelativeDate(text);
  if (relative) {
    return relative;
  }

  const monthDayMatch = String(text || "").match(/(\d{1,2})\u6708(\d{1,2})[\u65e5\u53f7]?/);
  if (monthDayMatch) {
    const today = getToday();
    return new Date(today.getFullYear(), Number(monthDayMatch[1]) - 1, Number(monthDayMatch[2]));
  }

  return getToday();
}

function resolveRecordDate(text) {
  return toDateId(resolveDateFromText(String(text || "")));
}

function resolveDueDate(text) {
  return toDateId(resolveDateFromText(String(text || "")));
}

function resolveDueTime(text) {
  const normalized = String(text || "");
  if (normalized.includes("\u4e0a\u5348")) {
    return "\u4e0a\u5348";
  }
  if (normalized.includes("\u4e2d\u5348")) {
    return "\u4e2d\u5348";
  }
  if (normalized.includes("\u4e0b\u5348")) {
    return "\u4e0b\u5348";
  }
  if (normalized.includes("\u665a\u4e0a") || normalized.includes("\u4eca\u665a")) {
    return "\u665a\u4e0a";
  }
  return "";
}

function getScopeInfo(granularity, anchorDateId, selectedYear) {
  const now = getToday();
  const anchorDate = parseDateId(anchorDateId || toDateId(now));
  const year = Number(selectedYear || now.getFullYear());

  if (granularity === "day") {
    return {
      granularity,
      start: anchorDate,
      end: anchorDate,
      label: `${anchorDate.getMonth() + 1}\u6708${anchorDate.getDate()}\u65e5`,
      pickerText: toDateId(anchorDate)
    };
  }

  if (granularity === "week") {
    const start = startOfWeek(anchorDate);
    const end = endOfWeek(anchorDate);
    return {
      granularity,
      start,
      end,
      label: `${start.getMonth() + 1}/${start.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`,
      pickerText: `${start.getMonth() + 1}/${start.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`
    };
  }

  if (granularity === "month") {
    const start = startOfMonth(anchorDate);
    const end = endOfMonth(anchorDate);
    return {
      granularity,
      start,
      end,
      label: `${start.getFullYear()}\u5e74${start.getMonth() + 1}\u6708`,
      pickerText: `${start.getFullYear()}-${pad(start.getMonth() + 1)}`
    };
  }

  return {
    granularity: "year",
    start: new Date(year, 0, 1),
    end: new Date(year, 11, 31),
    label: `${year}\u5e74`,
    pickerText: `${year}\u5e74`
  };
}

module.exports = {
  pad,
  toDateId,
  parseDateId,
  parseDateTime,
  formatDateTime,
  addDays,
  addMonths,
  addYears,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  getToday,
  resolveRecordDate,
  resolveDueDate,
  resolveDueTime,
  getScopeInfo
};
