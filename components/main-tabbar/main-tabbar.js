const { navigateMainPage } = require("../../utils/navigation");

const TABS = [
  { key: "home", url: "/pages/home/home", zh: "\u9996\u9875", en: "HOME" },
  { key: "todo", url: "/pages/todo-list/todo-list", zh: "TODO", en: "PLAN" },
  { key: "money", url: "/pages/accounting/accounting", zh: "\u8bb0\u8d26", en: "MONEY" },
  { key: "habit", url: "/pages/habit/habit", zh: "\u4e60\u60ef", en: "HABIT" },
  { key: "me", url: "/pages/my/my", zh: "\u6211\u7684", en: "ME" }
];

Component({
  properties: {
    current: {
      type: String,
      value: ""
    }
  },

  data: {
    tabs: TABS
  },

  methods: {
    navigate(event) {
      const target = event.currentTarget.dataset.url;
      navigateMainPage(this.properties.current, target);
    }
  }
});
