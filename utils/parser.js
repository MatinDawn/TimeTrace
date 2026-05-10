const { inferCategory } = require("./categories");
const { getToday, toDateId, resolveRecordDate, resolveDueDate, resolveDueTime } = require("./date");

const INCOME_KEYWORDS = ["收入", "工资", "奖金", "报销", "到账", "收到", "收款"];
const EXPENSE_KEYWORDS = ["花了", "支出", "付款", "买了", "消费", "付了", "充值", "缴费"];
const PLAN_KEYWORDS = ["待办", "计划", "提醒", "截止", "安排", "明天", "后天", "下周", "要做", "需要", "提交", "完成"];
const HIGH_PRIORITY_KEYWORDS = ["尽快", "紧急", "重要", "马上", "立刻"];
const MEDIUM_PRIORITY_KEYWORDS = ["本周", "今天", "这周"];

function extractAmount(text) {
  const normalized = String(text || "");
  const moneyMatched = normalized.match(/(\d+(\.\d+)?)\s*(元|块|人民币|rmb|RMB)/);
  if (moneyMatched) {
    return Number(moneyMatched[1]);
  }
  if (!EXPENSE_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return 0;
  }
  const matched = normalized.match(/(\d+(\.\d+)?)/);
  return matched ? Number(matched[1]) : 0;
}

function extractDurationQuantity(text) {
  const normalized = String(text || "");
  const durationMatched = normalized.match(/(\d+(\.\d+)?)\s*(分钟|小时|天|次|个|页|公里|km|KM)/);
  return durationMatched ? `${durationMatched[1]}${durationMatched[3]}` : "";
}

function inferDirection(text) {
  const normalized = String(text || "");
  if (INCOME_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "income";
  }
  if (EXPENSE_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "expense";
  }
  return "expense";
}

function inferRecordType(text) {
  const normalized = String(text || "");
  return PLAN_KEYWORDS.some((keyword) => normalized.includes(keyword)) ? "plan" : "done";
}

function inferPriority(text) {
  const normalized = String(text || "");
  if (HIGH_PRIORITY_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "high";
  }
  if (MEDIUM_PRIORITY_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "medium";
  }
  return "low";
}

function buildActionName(text) {
  const cleaned = String(text || "")
    .replace(/记一条|记一个|记录|打卡|留痕|待办|计划|提醒|截止|花了|支出|付款|买了|消费|工资|奖金|收入|到账|收款|收到|明天|后天|今天|昨天|上午|中午|下午|晚上|今晚/g, " ")
    .replace(/\d+(\.\d+)?/g, " ")
    .replace(/[元块分钱分钟小时天月年次笔个]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || "未命名留痕";
}

function createDraftFromInput(text, source) {
  const normalizedText = String(text || "").trim();
  const recordType = inferRecordType(normalizedText);
  const direction = inferDirection(normalizedText);
  const amount = extractAmount(normalizedText);
  const categoryId = inferCategory(normalizedText, recordType, direction);
  const now = new Date().toISOString();

  return {
    id: `record_${Date.now()}`,
    originalContent: normalizedText,
    recordType,
    categoryId,
    actionName: buildActionName(normalizedText),
    description: "",
    durationQuantity: extractDurationQuantity(normalizedText),
    amount,
    direction,
    currency: "CNY",
    attachmentURLs: [],
    locationInfo: "",
    recordTime: recordType === "plan" ? "" : resolveRecordDate(normalizedText),
    createdAt: now,
    updatedAt: now,
    isDraft: true,
    draftSource: source || "text",
    dueDate: recordType === "plan" ? resolveDueDate(normalizedText) : "",
    dueTime: recordType === "plan" ? resolveDueTime(normalizedText) : "",
    priority: inferPriority(normalizedText),
    status: recordType === "plan" ? "todo" : "done",
    subTasks: [],
    budgetAmount: recordType === "plan" ? amount : 0,
    reminderEnabled: false,
    reminderTime: "",
    source: "quick-record",
    aiParseStatus: "parsed"
  };
}

module.exports = {
  createDraftFromInput
};
