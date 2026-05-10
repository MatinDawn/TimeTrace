const { markNav } = require("./perf");

const MAIN_PAGES = [
  "/pages/home/home",
  "/pages/todo-list/todo-list",
  "/pages/accounting/accounting",
  "/pages/statistics/statistics",
  "/pages/my/my"
];

function navigateMainPage(currentPath, targetPath) {
  if (currentPath === targetPath) {
    markNav("nav.skip", currentPath, targetPath, "same-page");
    return;
  }

  if (MAIN_PAGES.indexOf(targetPath) >= 0) {
    markNav("nav.before", currentPath, targetPath, "redirectTo");
    wx.redirectTo({
      url: targetPath,
      success: () => markNav("nav.after.success", currentPath, targetPath, "redirectTo"),
      fail: (error) => markNav("nav.after.fail", currentPath, targetPath, error && error.errMsg)
    });
    return;
  }

  markNav("nav.before", currentPath, targetPath, "navigateTo");
  wx.navigateTo({
    url: targetPath,
    success: () => markNav("nav.after.success", currentPath, targetPath, "navigateTo"),
    fail: (error) => markNav("nav.after.fail", currentPath, targetPath, error && error.errMsg)
  });
}

module.exports = {
  MAIN_PAGES,
  navigateMainPage
};
