/**
 * 今日痕迹 · 文艺总结服务
 * --------------------------------------------------
 * - 无今日记录 → 从素材库随机抽一条文艺短句（pickLiteraryQuote）
 * - 有今日记录 → 调 deepseek-v3-0324 根据今日 done/plan 内容生成
 *               2 句、每句 7-10 字的文艺短句
 * - 失败兜底  → 回退到素材库
 * - 复用规则   → 同一 dateId 同一记录摘要 hash 生成结果会缓存到 globalData
 */

const { pickLiteraryQuote } = require("../utils/literary-quotes");

const MODEL_FACTORY = "deepseek";
const MODEL_NAME = "deepseek-v3-0324";

function getAiModel() {
  if (!wx.cloud || !wx.cloud.extend || !wx.cloud.extend.AI || !wx.cloud.extend.AI.createModel) {
    throw new Error("cloud-ai-unavailable");
  }
  return wx.cloud.extend.AI.createModel(MODEL_FACTORY);
}

function summarizeRecordsForPrompt(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return "";
  }
  const lines = records.slice(0, 12).map((record, index) => {
    const action = String(record.actionName || record.title || "").trim();
    const desc = String(record.description || "").trim();
    const type = record.recordType === "plan" ? "计划" : "已完成";
    return `${index + 1}. [${type}] ${action}${desc ? "（" + desc + "）" : ""}`;
  });
  return lines.join("\n");
}

function buildPrompt(records) {
  const summary = summarizeRecordsForPrompt(records);
  return [
    "你是一位古风文艺写手，请基于用户今日的留痕（已完成或计划），",
    "写一段两句话的文艺总结，要求：",
    "1) 必须正好两句；",
    "2) 每句 7-10 个汉字；",
    "3) 风格含蓄、富诗意，可参考唐诗宋词或现代散文，避免直白罗列；",
    "4) 不要出现具体的事项名、金额、人名；",
    "5) 不要出现引号、标点（句末除外，可不带），不要使用列表或编号；",
    "6) 仅输出 JSON：{\"line1\":\"...\",\"line2\":\"...\"}，不要任何额外文字。",
    "",
    "# 今日留痕",
    summary || "（暂无）",
    "",
    "# 输出（仅 JSON）"
  ].join("\n");
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

function clampLine(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  // 去除句末标点便于排版
  return text.replace(/[，。！？、；：,.!?;:]+$/g, "");
}

function isValidLine(text) {
  const len = String(text || "").length;
  return len >= 5 && len <= 14;
}

async function callDeepseekSummary(records) {
  const model = getAiModel();
  const response = await model.streamText({
    data: {
      model: MODEL_NAME,
      messages: [
        { role: "user", content: buildPrompt(records) }
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
    } catch (err) {
      continue;
    }
    const delta = data && data.choices && data.choices[0] && data.choices[0].delta
      ? data.choices[0].delta.content
      : "";
    if (delta) {
      content += delta;
    }
  }
  const json = JSON.parse(extractJsonBlock(content));
  const line1 = clampLine(json.line1);
  const line2 = clampLine(json.line2);
  if (!isValidLine(line1) || !isValidLine(line2)) {
    throw new Error("ai-invalid-format");
  }
  return { line1, line2, source: "ai" };
}

/**
 * 生成今日文艺总结
 * @param {Array} records 今日记录数组（done/plan 混合）
 * @returns {Promise<{ line1: string, line2: string, source: 'ai' | 'preset' }>}
 */
async function generateDailySummary(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return pickLiteraryQuote();
  }
  try {
    return await callDeepseekSummary(records);
  } catch (err) {
    // AI 不可用或格式错误 → 回退到素材库
    return pickLiteraryQuote();
  }
}

/**
 * 生成稳定的"今日记录摘要 hash"，用于在同一日内做缓存复用
 * 当用户新增/删除记录时 hash 变化，会触发重新生成
 */
function buildRecordsFingerprint(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return "empty";
  }
  return records
    .map((r) => [
      r.id || "",
      r.actionName || r.title || "",
      r.recordType || "",
      r.updatedAt || "",
      r.status || "",
      r.description || "",
      r.amount || "",
      r.recordTime || "",
      r.dueDate || "",
      r.dueTime || ""
    ].join("|"))
    .join("#");
}

module.exports = {
  generateDailySummary,
  pickLiteraryQuote,
  buildRecordsFingerprint
};
