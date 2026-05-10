const {
  getCategories,
  saveCategory,
  deleteCategory
} = require("../utils/store");
const recordService = require("./app/records");
const spaceService = require("./app/spaces");
const statsService = require("./app/stats");

module.exports = {
  getCategories,
  saveCategory,
  deleteCategory,
  ...recordService,
  ...spaceService,
  ...statsService
};
