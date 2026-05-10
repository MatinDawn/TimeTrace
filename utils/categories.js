const DEFAULT_CATEGORIES = [
  { id: "food", name: "\u9910\u996e", sortOrder: 1, defaultAmount: 0, defaultReminderRule: "", builtin: true },
  { id: "commute", name: "\u4ea4\u901a", sortOrder: 2, defaultAmount: 0, defaultReminderRule: "", builtin: true },
  { id: "work", name: "\u5de5\u4f5c", sortOrder: 3, defaultAmount: 0, defaultReminderRule: "", builtin: true },
  { id: "study", name: "\u5b66\u4e60", sortOrder: 4, defaultAmount: 0, defaultReminderRule: "", builtin: true },
  { id: "sport", name: "\u8fd0\u52a8", sortOrder: 5, defaultAmount: 0, defaultReminderRule: "", builtin: true },
  { id: "health", name: "\u5065\u5eb7", sortOrder: 6, defaultAmount: 0, defaultReminderRule: "", builtin: true },
  { id: "life", name: "\u751f\u6d3b", sortOrder: 7, defaultAmount: 0, defaultReminderRule: "", builtin: true },
  { id: "project", name: "\u9879\u76ee", sortOrder: 8, defaultAmount: 0, defaultReminderRule: "", builtin: true },
  { id: "income", name: "\u6536\u5165", sortOrder: 9, defaultAmount: 0, defaultReminderRule: "", builtin: true },
  { id: "other", name: "\u5176\u4ed6", sortOrder: 10, defaultAmount: 0, defaultReminderRule: "", builtin: true }
];

const CATEGORY_KEYWORDS = {
  food: ["\u5496\u5561", "\u5976\u8336", "\u5348\u996d", "\u665a\u996d", "\u65e9\u9910", "\u5916\u5356", "\u9910\u996e", "\u5403\u996d", "\u805a\u9910"],
  commute: ["\u6253\u8f66", "\u516c\u4ea4", "\u5730\u94c1", "\u9ad8\u94c1", "\u673a\u7968", "\u505c\u8f66", "\u52a0\u6cb9", "\u901a\u52e4", "\u4ea4\u901a"],
  work: ["\u5468\u62a5", "\u5f00\u4f1a", "\u5ba2\u6237", "\u590d\u76d8", "\u5de5\u4f5c", "\u8ff0\u804c", "\u6c47\u62a5", "\u65b9\u6848"],
  study: ["\u80cc\u5355\u8bcd", "\u8bfe\u7a0b", "\u5b66\u4e60", "\u8003\u8bd5", "\u5237\u9898", "\u9605\u8bfb", "\u8bad\u7ec3\u8425", "\u4f5c\u4e1a"],
  sport: ["\u8dd1\u6b65", "\u5065\u8eab", "\u745c\u4f3d", "\u6e38\u6cf3", "\u9a91\u884c", "\u8fd0\u52a8"],
  health: ["\u4f53\u68c0", "\u533b\u9662", "\u6302\u53f7", "\u836f", "\u7259\u533b", "\u51a5\u60f3", "\u7761\u7720"],
  life: ["\u5bb6\u52a1", "\u91c7\u8d2d", "\u6536\u7eb3", "\u65e5\u7528", "\u751f\u6d3b", "\u6d17\u8863", "\u505a\u996d"],
  project: ["\u9879\u76ee", "\u9700\u6c42", "\u6392\u671f", "\u4e0a\u7ebf", "\u5f00\u53d1", "\u8bbe\u8ba1", "\u7248\u672c"],
  income: ["\u5de5\u8d44", "\u5956\u91d1", "\u62a5\u9500", "\u5230\u8d26", "\u6536\u5165", "\u6536\u6b3e"],
  other: []
};

function getDefaultCategories() {
  return DEFAULT_CATEGORIES.map((item) => ({ ...item }));
}

function getCategoryMetaMap(categories) {
  return (categories || getDefaultCategories()).reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});
}

function inferCategory(text, recordType, direction) {
  const lowerText = String(text || "").toLowerCase();

  if (direction === "income") {
    return "income";
  }

  const matched = Object.keys(CATEGORY_KEYWORDS).find((categoryId) => {
    return CATEGORY_KEYWORDS[categoryId].some((keyword) => lowerText.includes(keyword));
  });

  if (matched) {
    return matched;
  }

  if (recordType === "plan") {
    return "project";
  }

  return "other";
}

module.exports = {
  DEFAULT_CATEGORIES,
  getDefaultCategories,
  getCategoryMetaMap,
  inferCategory
};
