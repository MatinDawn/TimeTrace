const RECORD_TYPE = {
  DONE: "done",
  PLAN: "plan"
};

const RECORD_STATUS = {
  DRAFT: "draft",
  TODO: "todo",
  DONE: "done",
  OVERDUE: "overdue"
};

const AI_PARSE_STATUS = {
  PENDING: "pending",
  PARSED: "parsed",
  FAILED: "failed"
};

const DIRECTION = {
  INCOME: "income",
  EXPENSE: "expense"
};

const PRIORITY = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low"
};

const DUE_TIME_OPTIONS = ["", "上午", "中午", "下午", "晚上"];

const REMOTE_CACHE_TTL = 8000;
const BRIDGE_MAX_RETRIES = 2;
const BRIDGE_RETRY_DELAY = 400;

module.exports = {
  RECORD_TYPE,
  RECORD_STATUS,
  AI_PARSE_STATUS,
  DIRECTION,
  PRIORITY,
  DUE_TIME_OPTIONS,
  REMOTE_CACHE_TTL,
  BRIDGE_MAX_RETRIES,
  BRIDGE_RETRY_DELAY
};
