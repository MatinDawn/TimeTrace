const { getCategories } = require("../../utils/store");
const readService = require("./record-read-service");
const writeService = require("./record-write-service");
const draftService = require("./record-draft-service");

module.exports = {
  ...readService,
  ...writeService,
  ...draftService,
  getCategories
};
