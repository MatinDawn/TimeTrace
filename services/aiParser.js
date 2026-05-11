const { getCategories } = require("../utils/store");
const { createDraftFromInput } = require("../utils/parser");
const { toDateId, getToday, formatDateTime } = require("../utils/date");

const MODEL_FACTORY = "hunyuan-exp";
const MODEL_NAME = "hunyuan-turbos-latest";

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

async function readStreamContent(response) {
  if (response && response.textStream && response.textStream[Symbol.asyncIterator]) {
    let content = "";
    for await (const text of response.textStream) {
      content += String(text || "");
    }
    return content;
  }

  if (response && response.eventStream && response.eventStream[Symbol.asyncIterator]) {
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
    return content;
  }

  if (response && typeof response.text === "string") {
    return response.text;
  }

  throw new Error("ai-empty-response");
}

function buildPrompt(text, createdAtDisplay) {
  const categories = getCategories().map((item) => item.name);
  const categoryList = categories.join("\u3001");
  const today = toDateId(getToday());
  const createdAt = createdAtDisplay || formatDateTime(new Date());

  return [
    "# \u89d2\u8272",
    "\u4f60\u662f\u300c\u7559\u75d5\u300d\u5c0f\u7a0b\u5e8f\u7684\u7ed3\u6784\u5316\u89e3\u6790\u5f15\u64ce\uff0c\u552f\u4e00\u804c\u8d23\u662f\u628a\u7528\u6237\u7684\u4e00\u53e5\u81ea\u7136\u8bed\u8a00\u8f6c\u6362\u6210\u4e00\u4e2a\u4e25\u683c\u7b26\u5408 schema \u7684 JSON \u5bf9\u8c61\u3002",
    "",
    "# \u4e0a\u4e0b\u6587",
    `- \u4eca\u5929\u65e5\u671f\uff1a${today}`,
    `- \u7559\u75d5\u521b\u5efa\u65f6\u95f4\uff1a${createdAt}`,
    `- \u5141\u8bb8\u7684\u5206\u7c7b\u679a\u4e3e\uff1a${categoryList}`,
    "",
    "# \u786c\u7ea6\u675f\uff08\u8fdd\u53cd\u5373\u89c6\u4e3a\u5931\u8d25\uff09",
    "1. \u53ea\u8f93\u51fa 1 \u4e2a JSON \u5bf9\u8c61\uff0c\u7981\u6b62 markdown\u3001\u4ee3\u7801\u5757\u3001\u89e3\u91ca\u3001\u524d\u7f00\u540e\u7f00\u6587\u5b57\uff0c\u7981\u6b62\u8f93\u51fa\u591a\u4e2a\u5bf9\u8c61\u6216\u6570\u7ec4\u3002",
    "2. \u7981\u6b62\u865a\u6784\u3001\u7981\u6b62\u731c\u6d4b\u3001\u7981\u6b62\u8865\u5145\u7528\u6237\u672a\u63d0\u53ca\u7684\u4fe1\u606f\uff1b\u4e0d\u786e\u5b9a\u7684\u5b57\u6bb5\u5fc5\u987b\u7559\u7a7a\u5b57\u7b26\u4e32 \"\" \u6216 0\u3002",
    '3. recordType \u4ec5\u53ef\u4e3a "done" \u6216 "plan"\uff0c\u4e0d\u5f97\u8f93\u51fa\u5176\u4ed6\u503c\u3002',
    `4. categoryName \u5fc5\u987b\u4e25\u683c\u4ece\u300c\u5141\u8bb8\u7684\u5206\u7c7b\u679a\u4e3e\u300d\u4e2d\u9009\u53d6\u4e00\u4e2a\uff1b\u5982\u65e0\u5339\u914d\u9879\uff0c\u7edf\u4e00\u7528 "${categories.includes("\u5176\u4ed6") ? "\u5176\u4ed6" : categories[categories.length - 1] || ""}"\uff1b\u7981\u6b62\u65b0\u589e\u3001\u7ffb\u8bd1\u6216\u53d8\u5f62\u3002`,
    '5. priority \u4ec5\u53ef\u4e3a "high" | "medium" | "low"\uff1b\u672a\u660e\u786e\u65f6\u9ed8\u8ba4 "low"\u3002',
    '6. dueTime \u4ec5\u53ef\u4e3a "\u4e0a\u5348" | "\u4e2d\u5348" | "\u4e0b\u5348" | "\u665a\u4e0a" | ""\uff0c\u5176\u4ed6\u8868\u8ff0\u4e00\u5f8b\u8f93\u51fa ""\u3002',
    "7. recordTime\u3001dueDate \u683c\u5f0f\u4ec5\u53ef\u4e3a YYYY-MM-DD \u6216 \"\"\uff1b\u7981\u6b62\u51fa\u73b0\u65f6\u95f4\u3001\u659c\u6760\u3001\u4e2d\u6587\u65e5\u671f\u3002",
    "8. amount\u3001budgetAmount \u5fc5\u987b\u662f \u2265 0 \u7684\u6570\u5b57\uff1b\u7981\u6b62\u8d1f\u6570\u3001\u7981\u6b62\u5e26\u5355\u4f4d\u7b26\u53f7\u3002",
    "9. actionName \u2264 30 \u5b57\uff0c\u53ea\u5305\u542b\u7528\u6237\u539f\u53e5\u4e2d\u660e\u786e\u8868\u8ff0\u7684\u52a8\u4f5c\uff0c\u7981\u6b62\u540e\u7f00\u52a8\u8bcd\u3002",
    "10. \u8f93\u51fa JSON \u5fc5\u987b\u5305\u542b\u4e0b\u6587 schema \u7684\u5168\u90e8\u952e\uff0c\u7981\u6b62\u589e\u51cf\u5b57\u6bb5\uff0c\u7f3a\u7701\u503c\u6309\u7c7b\u578b\u586b \"\" \u6216 0\u3002",
    "",
    "# \u7c7b\u578b\u5206\u6d41\u89c4\u5219",
    "- \u5df2\u53d1\u751f\u7684\u4e8b\u5b9e\uff08\u8fc7\u53bb\u65f6\u6001\u3001\u91d1\u989d/\u65f6\u957f\u5df2\u4ea7\u751f\uff09\u2192 recordType=\"done\"\uff1a",
    "  - \u53ef\u586b recordTime\u3001amount\u3001durationQuantity\uff1b",
    "  - \u5f3a\u5236\u7f6e\u7a7a\uff1adueDate=\"\"\u3001dueTime=\"\"\u3001priority=\"low\"\u3001budgetAmount=0\u3002",
    "- \u672a\u6765\u8ba1\u5212\uff08\u5f85\u529e\u3001\u63d0\u9192\u3001\u622a\u6b62\u65f6\u95f4\u3001\u5c06\u8981\u505a\uff09\u2192 recordType=\"plan\"\uff1a",
    "  - \u53ef\u586b dueDate\u3001dueTime\u3001priority\u3001budgetAmount\uff1b",
    "  - \u5f3a\u5236\u7f6e\u7a7a\uff1arecordTime=\"\"\u3001amount=0\u3001durationQuantity=\"\"\u3002",
    "- \u65e0\u6cd5\u5224\u65ad\u65f6\u9ed8\u8ba4 done\u3002",
    "",
    "# Schema\uff08\u952e\u540d\u3001\u987a\u5e8f\u5fc5\u987b\u4e00\u81f4\uff09",
    '{"recordType":"done|plan","actionName":"","categoryName":"","amount":0,"recordTime":"","dueDate":"","dueTime":"","priority":"low","description":"","durationQuantity":"","budgetAmount":0}',
    "",
    "# \u793a\u4f8b",
    '\u8f93\u5165\uff1a\u4eca\u5929\u5348\u9910\u82b1\u4e86 28 \u5757',
    `\u8f93\u51fa\uff1a{"recordType":"done","actionName":"\u5348\u9910","categoryName":"\u9910\u996a","amount":28,"recordTime":"${today}","dueDate":"","dueTime":"","priority":"low","description":"","durationQuantity":"","budgetAmount":0}`,
    "",
    '\u8f93\u5165\uff1a\u660e\u5929\u4e0b\u5348\u4e09\u70b9\u548c\u5ba2\u6237\u5f00\u4f1a',
    '\u8f93\u51fa\uff1a{"recordType":"plan","actionName":"\u548c\u5ba2\u6237\u5f00\u4f1a","categoryName":"\u5de5\u4f5c","amount":0,"recordTime":"","dueDate":"<\u660e\u5929\u7684YYYY-MM-DD>","dueTime":"\u4e0b\u5348","priority":"medium","description":"","durationQuantity":"","budgetAmount":0}',
    "",
    '\u8f93\u5165\uff1a\u8dd1\u6b65 30 \u5206\u949f',
    `\u8f93\u51fa\uff1a{"recordType":"done","actionName":"\u8dd1\u6b65","categoryName":"\u8fd0\u52a8","amount":0,"recordTime":"${today}","dueDate":"","dueTime":"","priority":"low","description":"","durationQuantity":"30\u5206\u949f","budgetAmount":0}`,
    "",
    "# \u81ea\u68c0\uff08\u8f93\u51fa\u524d\u5185\u90e8\u6267\u884c\uff0c\u4e0d\u8981\u8f93\u51fa\u68c0\u67e5\u8fc7\u7a0b\uff09",
    "- \u6240\u6709\u679a\u4e3e\u5b57\u6bb5\u662f\u5426\u5728\u5141\u8bb8\u503c\u5185\uff1f",
    "- \u6839\u636e recordType \u7f6e\u7a7a\u7684\u5b57\u6bb5\u662f\u5426\u5df2\u7f6e\u7a7a\uff1f",
    "- \u65e5\u671f\u683c\u5f0f\u662f\u5426\u4e3a YYYY-MM-DD\uff1f",
    "- JSON \u662f\u5426\u53ef\u88ab JSON.parse \u76f4\u63a5\u89e3\u6790\uff1f",
    "",
    `# \u7528\u6237\u8f93\u5165\n${text}`,
    "",
    "# \u8f93\u51fa\uff08\u4ec5 JSON\uff0c\u65e0\u4efb\u4f55\u5176\u4ed6\u5b57\u7b26\uff09"
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
    const content = await readStreamContent(response);
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
