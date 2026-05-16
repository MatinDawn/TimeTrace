const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const forbiddenStatisticsRoute = "/pages/" + "statistics/statistics";

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function walk(dir, files = []) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if ([".git", "node_modules", "miniprogram_npm"].includes(entry.name)) {
        return;
      }
      walk(fullPath, files);
      return;
    }
    if (/\.(js|json|wxml|wxss)$/.test(entry.name)) {
      files.push(fullPath);
    }
  });
  return files;
}

const appJson = JSON.parse(read("app.json"));
const tabbarJs = read("components/main-tabbar/main-tabbar.js");
const navigationJs = read("utils/navigation.js");
const serviceStats = read("services/app/stats.js");
const appService = read("services/appService.js");
const cloudBridge = read("cloudfunctions/liuhenBridge/index.js");

assert(appJson.pages.includes("pages/habit/habit"), "app.json must register pages/habit/habit");
assert(!appJson.pages.includes("pages/statistics/statistics"), "app.json must not register the old statistics page");
assert(tabbarJs.includes('url: "/pages/habit/habit"'), "tabbar fourth page must point to habit");
assert(tabbarJs.includes('zh: "习惯"') || tabbarJs.includes("\\u4e60\\u60ef"), "tabbar must label fourth page as 习惯");
assert(tabbarJs.includes('en: "HABIT"'), "tabbar must label fourth page as HABIT");
assert(navigationJs.includes('"/pages/habit/habit"'), "main page navigation must include habit page");
assert(!navigationJs.includes(forbiddenStatisticsRoute), "main page navigation must not include statistics page");
assert(!fs.existsSync(path.join(root, "pages/statistics")), "old statistics page directory must be removed");

assert(/function getHabitData/.test(serviceStats), "front-end stats service must expose getHabitData");
assert(!/getStatisticsData/.test(serviceStats), "front-end stats service must remove getStatisticsData");
assert(/getHabitData/.test(appService), "appService must export getHabitData");
assert(/async function getHabitSummary/.test(cloudBridge), "cloud bridge must implement getHabitSummary");
assert(/getHabitSummary: async/.test(cloudBridge), "cloud bridge must expose getHabitSummary handler");
assert(!/getStatisticsSummary/.test(cloudBridge), "cloud bridge must remove getStatisticsSummary");

const allRefs = walk(root)
  .filter((filePath) => path.basename(filePath) !== "test-habit-page.js")
  .filter((filePath) => fs.readFileSync(filePath, "utf8").includes(forbiddenStatisticsRoute));
assert(!allRefs.length, `old statistics route must be fully removed: ${allRefs.map((item) => path.relative(root, item)).join(", ")}`);

const { buildHabitStats } = require("../utils/stats");
const { toDateId, addDays } = require("../utils/date");

const today = new Date();
const dateId = (offset) => toDateId(addDays(today, offset));
const habitStats = buildHabitStats([
  { recordType: "done", isDraft: false, actionName: "跑步", categoryName: "运动", recordTime: dateId(0) },
  { recordType: "done", isDraft: false, actionName: "跑步", categoryName: "运动", recordTime: dateId(-1) },
  { recordType: "done", isDraft: false, actionName: "跑步", categoryName: "运动", recordTime: dateId(-2) },
  { recordType: "done", isDraft: false, actionName: "读书", categoryName: "学习", recordTime: dateId(0) },
  { recordType: "done", isDraft: false, actionName: "读书", categoryName: "学习", recordTime: dateId(-1) },
  { recordType: "done", isDraft: false, actionName: "读书", categoryName: "学习", recordTime: dateId(-3) },
  { recordType: "done", isDraft: false, actionName: "读书", categoryName: "学习", recordTime: dateId(-5) },
  { recordType: "done", isDraft: false, actionName: "读书", categoryName: "学习", recordTime: dateId(-6) },
  { recordType: "done", isDraft: true, actionName: "草稿", categoryName: "忽略", recordTime: dateId(0) },
  { recordType: "plan", isDraft: false, actionName: "计划", categoryName: "忽略", recordTime: dateId(0) },
  { recordType: "done", isDraft: false, actionName: "", categoryName: "", recordTime: dateId(0) }
]);

assert(habitStats.overview, "habit stats must expose overview");
assert(habitStats.overview.totalHabits === 2, "habit stats must only count named non-draft done records");
assert(habitStats.overview.growthLevel === 3, "habit stats must map active habits to a stable small-tree growth level");
assert(habitStats.streakRanking[0].name === "跑步", "three-day streak habit must lead streak ranking");
assert(habitStats.streakRanking[0].latestStreak === 3, "same behavior over three consecutive days must have latestStreak 3");
assert(habitStats.streakRanking[0].longestStreak === 3, "same behavior over three consecutive days must have longestStreak 3");
assert(habitStats.recentRanking[0].name === "读书", "recent ranking must sort by latest seven-day count");
assert(habitStats.recentRanking[0].recentCount === 5, "recent ranking must count latest seven-day occurrences");
assert(habitStats.frequentRanking[0].totalCount === 5, "frequent ranking must sort by total occurrences");

const pastHabitStats = buildHabitStats([
  { recordType: "done", isDraft: false, actionName: "冥想", categoryName: "健康", recordTime: dateId(-4) },
  { recordType: "done", isDraft: false, actionName: "冥想", categoryName: "健康", recordTime: dateId(-5) },
  { recordType: "done", isDraft: false, actionName: "冥想", categoryName: "健康", recordTime: dateId(-6) }
]);

assert(pastHabitStats.streakRanking.length === 0, "habit not recorded today must not appear in current streak ranking");
assert(pastHabitStats.frequentRanking[0].latestStreak === 0, "habit not recorded today must have current streak 0");
assert(pastHabitStats.frequentRanking[0].longestStreak === 3, "habit not recorded today must keep historical longest streak");

console.log("habit page checks passed");
