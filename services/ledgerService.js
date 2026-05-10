const { getRecords, batchDeleteRecords } = require("./appService");
const { buildFinanceSummary, decorateFinanceSummary } = require("../utils/stats");

function processNaturalLanguage() {
  return {
    ok: false,
    type: "legacy",
    message: "\u5f53\u524d\u7248\u672c\u5df2\u5207\u6362\u5230\u5feb\u901f\u6253\u5361\u6d41\u7a0b\uff0c\u8bf7\u4f7f\u7528\u201c\u5feb\u901f\u6253\u5361\u201d\u9875\u9762\u3002"
  };
}

function deleteRecord(recordId) {
  return batchDeleteRecords([recordId]);
}

function buildSummary(records) {
  return decorateFinanceSummary(buildFinanceSummary(records || []));
}

module.exports = {
  processNaturalLanguage,
  getRecords,
  deleteRecord,
  buildSummary
};
