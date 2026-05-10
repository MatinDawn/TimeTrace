const { processNaturalLanguage } = require("../../services/ledgerService");

function createResultText(result) {
  if (result.type === "query") {
    return result.data.reply;
  }

  const { record } = result.data;
  return `\u5df2\u8bb0\u5f55 ${record.categoryLabel}\uff0c\u91d1\u989d \u00a5${record.amount}\uff0c\u65e5\u671f ${record.date}\u3002`;
}

Page({
  data: {
    inputText: "",
    latestResult: "",
    examples: [
      "\u5348\u996d\u82b1\u4e8628\u5143",
      "\u6628\u5929\u6253\u8f6636.5",
      "\u5de5\u8d44\u5230\u8d2612000",
      "\u8fd9\u4e2a\u6708\u82b1\u4e86\u591a\u5c11"
    ]
  },

  onInput(event) {
    this.setData({
      inputText: event.detail.value
    });
  },

  fillExample(event) {
    this.setData({
      inputText: event.currentTarget.dataset.value
    });
  },

  submitText() {
    const text = String(this.data.inputText || "").trim();
    if (!text) {
      wx.showToast({
        title: "\u5148\u8f93\u5165\u4e00\u53e5\u8bdd",
        icon: "none"
      });
      return;
    }

    const result = processNaturalLanguage(text);
    if (!result.ok) {
      wx.showToast({
        title: result.message,
        icon: "none"
      });
      return;
    }

    this.setData({
      inputText: "",
      latestResult: createResultText(result)
    });

    wx.showToast({
      title: result.type === "record" ? "\u5df2\u8bb0\u8d26" : "\u5df2\u7edf\u8ba1",
      icon: "success"
    });
  }
});
