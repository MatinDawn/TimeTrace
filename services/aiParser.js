const { getCategories } = require("../utils/store");
const { createDraftFromInput } = require("../utils/parser");
const { toDateId, getToday, formatDateTime } = require("../utils/date");

const MODEL_FACTORY = "deepseek";
const MODEL_NAME = "deepseek-r1-0528";

function getAiModel() {
  if (!wx.cloud || !wx.cloud.extend || !wx.cloud.extend.AI || !wx.cloud.extend.AI.createModel) {
    throw new Error("cloud-ai-unavailable");
  }
  return wx.cloud.extend.AI.createModel(MODEL_FACTORY);
}

function extractJsonBlock(text) {
  const normalized = String(text || "").trim();
  if (!normalized) {
    throw new Error("ai-empty-response");
  }
  const fenced = normalized.match(/```json\s*([\s\S]*?)```/i) || normalized.match(/```\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    return fenced[1].trim();
  }
  const start = normalized.indexOf("{");
  const end = normalized.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return normalized.slice(start, end + 1);
  }
  return normalized;
}

function normalizeRecordType(value, fallback) {
  const text = String(value || "").trim().toLowerCase();
  if (text === "plan" || text === "todo" || text === "\u672a\u5b8c\u6210" || text === "\u672a\u5b8c\u6210\u89c4\u5212") {
    return "plan";
  }
  if (text === "done" || text === "\u5df2\u5b8c\u6210" || text === "\u5df2\u5b8c\u6210\u52a8\u4f5c") {
    return "done";
  }
  return fallback || "done";
}

function normalizePriority(value, fallback) {
  const text = String(value || "").trim().toLowerCase();
  if (text === "high" || text === "\u9ad8") {
    return "high";
  }
  if (text === "medium" || text === "\u4e2d") {
    return "medium";
  }
  if (text === "low" || text === "\u4f4e") {
    return "low";
  }
  return fallback || "low";
}

function normalizeDueTime(value) {
  const text = String(value || "").trim();
  if (["\u4e0a\u5348", "\u4e2d\u5348", "\u4e0b\u5348", "\u665a\u4e0a"].includes(text)) {
    return text;
  }
  return "";
}

function normalizeDateId(value) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function getCategoryByName(categoryName) {
  const normalized = String(categoryName || "").trim();
  const categories = getCategories();
  const matched = categories.find((item) => item.name === normalized);
  if (matched) {
    return matched;
  }
  return categories.find((item) => item.id === "other") || { id: "other", name: normalized || "\u5176\u4ed6" };
}

function normalizeActionName(value, fallback) {
  const text = String(value || "").trim();
  if (text) {
    return text.slice(0, 30);
  }
  return String(fallback || "").trim() || "\u672a\u547d\u540d\u7559\u75d5";
}

function normalizeAmount(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num < 0) {
    return 0;
  }
  return Number(num.toFixed(2));
}

function normalizeTextField(value) {
  return String(value || "").trim();
}

function buildPrompt(text, createdAtDisplay) {
  const categories = getCategories().map((item) => item.name).join("\u3001");
  const today = toDateId(getToday());
  return [
    "\u4f60\u662f\u4e00\u4e2a\u4e13\u95e8\u505a\u300c\u7559\u75d5\u300d\u7ed3\u6784\u5316\u89e3\u6790\u7684\u5f15\u64ce\uff0c\u4efb\u52a1\u662f\u628a\u4e00\u53e5\u81ea\u7136\u8bed\u8a00\u53d8\u6210\u4e25\u683c JSON\u3002",
    "\u4f60\u5fc5\u987b\u9075\u5b88\uff1a",
    "1. \u53ea\u80fd\u8f93\u51fa 1 \u4e2a JSON \u5bf9\u8c61\uff0c\u4e0d\u80fd\u8f93\u51fa markdown\u3001\u89e3\u91ca\u3001\u6807\u9898\u3001\u4ee3\u7801\u5757\u3002",
    "2. \u4e0d\u80fd\u865a\u6784\u7528\u6237\u6ca1\u63d0\u5230\u7684\u4fe1\u606f\u3002",
    "3. \u5982\u679c\u4e0d\u786e\u5b9a\uff0c\u5b57\u6bb5\u7528\u7a7a\u5b57\u7b26\u4e32\u6216 0\uff0c\u4e0d\u8981\u731c\u6d4b\u3002",
    "4. categoryName \u53ea\u80fd\u4ece\u8fd9\u4e9b\u503c\u91cc\u9009\uff1a" + categories,
    '5. recordType \u53ea\u80fd\u662f "done" \u6216 "plan"\u3002',
    '6. priority \u53ea\u80fd\u662f "high" / "medium" / "low"\u3002',
    "7. dueTime \u53ea\u80fd\u662f \u4e0a\u5348/\u4e2d\u5348/\u4e0b\u5348/\u665a\u4e0a/\u7a7a\u5b57\u7b26\u4e32\u3002",
    "8. recordTime \u548c dueDate \u683c\u5f0f\u5fc5\u987b\u662f YYYY-MM-DD \u6216\u7a7a\u5b57\u7b26\u4e32\u3002",
    `\u4eca\u5929\u65e5\u671f\uff1a${today}`,
    `\u8fd9\u6761\u7559\u75d5\u7684\u521b\u5efa\u65f6\u95f4\uff1a${createdAtDisplay || formatDateTime(new Date())}`,
    "\u5b57\u6bb5 schema \u5982\u4e0b\uff1a",
    "{",
    '  "recordType": "done|plan",',
    '  "actionName": "\u7b80\u6d01\u7684\u52a8\u4f5c\u540d\u79f0",',
    '  "categoryName": "\u5206\u7c7b",',
    '  "amount": 0,',
    '  "recordTime": "YYYY-MM-DD \u6216\u7a7a",',
    '  "dueDate": "YYYY-MM-DD \u6216\u7a7a",',
    '  "dueTime": "\u4e0a\u5348|\u4e2d\u5348|\u4e0b\u5348|\u665a\u4e0a|\u7a7a",',
    '  "priority": "high|medium|low",',
    '  "description": "\u5907\u6ce8\u6216\u7a7a",',
    '  "durationQuantity": "\u65f6\u957f/\u6570\u91cf\u6216\u7a7a",',
    '  "budgetAmount": 0',
    "}",
    "\u5224\u65ad\u89c4\u5219\uff1a",
    "- \u8868\u8fbe\u5df2\u53d1\u751f\u7684\u4e8b\u60c5\uff0c\u7528 done\u3002",
    "- \u8868\u8fbe\u5c06\u8981\u505a\u7684\u4e8b\u60c5\u3001\u63d0\u9192\u3001\u5f85\u529e\u3001\u622a\u6b62\u65f6\u95f4\uff0c\u7528 plan\u3002",
    "- \u5982\u679c\u662f plan\uff0crecordTime \u5fc5\u987b\u7a7a\u3002",
    "- \u5982\u679c\u662f done\uff0cdueDate \u548c dueTime \u5fc5\u987b\u7a7a\u3002",
    "- \u6ca1\u6709\u63d0\u5230\u82b1\u8d39\u91d1\u989d\u5c31\u7528 0\u3002",
    `\u7528\u6237\u8f93\u5165\uff1a${text}`,
    "\u73b0\u5728\u76f4\u63a5\u8fd4\u56de JSON\uff1a"
  ].join("\n");
}

async function parseTraceInput(text, source, seedRecord) {
  const fallback = createDraftFromInput(text, source);
  try {
    const model = getAiModel();
    const response = await model.streamText({
      data: {
        model: MODEL_NAME,
        messages: [
          {
            role: "user",
            content: buildPrompt(text, seedRecord && seedRecord.createdAtDisplay)
          }
        ]
      }
    });
    let content = "";
    for await (const event of response.eventStream) {
      if (!event || event.data === "[DONE]") {
        break;
      }
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (error) {
        continue;
      }
      const textDelta = data && data.choices && data.choices[0] && data.choices[0].delta
        ? data.choices[0].delta.content
        : "";
      if (textDelta) {
        content += textDelta;
      }
    }
    const jsonText = extractJsonBlock(content);
    const parsed = JSON.parse(jsonText);
    const recordType = normalizeRecordType(parsed.recordType, fallback.recordType);
    const category = getCategoryByName(parsed.categoryName);
    const amount = normalizeAmount(parsed.amount);
    const budgetAmount = normalizeAmount(parsed.budgetAmount);
    const actionName = normalizeActionName(parsed.actionName, fallback.actionName);
    const description = normalizeTextField(parsed.description);
    const durationQuantity = normalizeTextField(parsed.durationQuantity);
    const recordTime = recordType === "done" ? normalizeDateId(parsed.recordTime) : "";
    const dueDate = recordType === "plan" ? normalizeDateId(parsed.dueDate) : "";
    const dueTime = recordType === "plan" ? normalizeDueTime(parsed.dueTime) : "";
    const priority = recordType === "plan" ? normalizePriority(parsed.priority, fallback.priority) : "low";

    return {
      ...fallback,
      id: seedRecord && seedRecord.id ? seedRecord.id : fallback.id,
      createdAt: seedRecord && seedRecord.createdAt ? seedRecord.createdAt : fallback.createdAt,
      createdAtDisplay: seedRecord && seedRecord.createdAtDisplay ? seedRecord.createdAtDisplay : formatDateTime(seedRecord && seedRecord.createdAt ? seedRecord.createdAt : fallback.createdAt),
      originalContent: String(text || "").trim(),
      recordType,
      actionName,
      categoryId: category.id,
      categoryName: category.name,
      amount,
      recordTime: recordTime || (recordType === "done" ? fallback.recordTime : ""),
      dueDate: dueDate || (recordType === "plan" ? fallback.dueDate : ""),
      dueTime,
      priority,
      description,
      durationQuantity,
      budgetAmount: recordType === "plan" ? budgetAmount : 0,
      status: "draft",
      isDraft: true,
      aiParseStatus: "parsed",
      source: "cloudbase-ai"
    };
  } catch (error) {
    const nextError = new Error(error.message || "ai-parse-failed");
    nextError.detail = error.detail || error.stack || "";
    nextError.fallbackRecord = fallback;
    throw nextError;
  }
}

module.exports = {
  parseTraceInput
};
