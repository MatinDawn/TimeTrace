const MAIN_PAGES = [
  "/pages/home/home",
  "/pages/todo-list/todo-list",
  "/pages/accounting/accounting",
  "/pages/statistics/statistics",
  "/pages/my/my"
];

function navigateMainPage(currentPath, targetPath) {
  if (currentPath === targetPath) {
    return;
  }

  if (MAIN_PAGES.indexOf(targetPath) >= 0) {
    wx.redirectTo({ url: targetPath });
    return;
  }

  wx.navigateTo({ url: targetPath });
}

module.exports = {
  MAIN_PAGES,
  navigateMainPage
};
