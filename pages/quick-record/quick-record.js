const { createPrefilledRecord } = require("../../services/appService");

Page({
  data: {
    ui: {
      title: "\u5feb\u901f\u6253\u5361",
      subtitle: "\u5148\u8bf4\u4e00\u53e5\u6216\u5199\u4e00\u53e5\uff0c\u7cfb\u7edf\u4f1a\u81ea\u52a8\u8bc6\u522b\u5e76\u8865\u5168\u5230\u8be6\u60c5\u9875\u3002",
      placeholder: "\u6bd4\u5982\uff1a\u660e\u5929\u4e0b\u5348\u4e09\u70b9\u548c\u5ba2\u6237\u5f00\u4f1a\uff0c\u8bb0\u6210\u5de5\u4f5c\u89c4\u5212",
      voiceHint: "\u6309\u4f4f\u8bf4\u8bdd",
      voiceButton: "\u957f\u6309\u5f00\u59cb\u5f55\u97f3",
      voiceTip: "\u8bed\u97f3\u5165\u53e3\u5148\u653e\u5728\u8fd9\u91cc\uff0c\u540e\u9762\u63a5\u771f\u5b9e\u8bc6\u522b\u80fd\u529b\u3002",
      keyboard: "\u952e\u76d8",
      voice: "\u8bed\u97f3",
      switchToText: "\u5207\u56de\u6587\u5b57\u8f93\u5165",
      switchToVoice: "\u5207\u5230\u6309\u4f4f\u8bf4\u8bdd",
      examplesTitle: "\u8bd5\u8bd5\u8fd9\u4e9b\u8868\u8fbe",
      submit: "\u8bc6\u522b\u5e76\u8865\u5168",
      toastVoice: "\u8bed\u97f3\u8bc6\u522b\u4e0b\u4e00\u7248\u63a5\u5165",
      toastVoiceOrText: "\u5148\u8bf4\u4e00\u53e5\u8bdd\u6216\u5207\u56de\u6587\u5b57",
      toastInput: "\u5148\u8f93\u5165\u5185\u5bb9"
    },
    showVoiceInput: false,
    inputText: "",
    examples: [
      "\u5348\u996d\u82b1\u4e8628\u5143",
      "\u660e\u5929\u4e0b\u5348\u63d0\u4ea4\u5468\u62a5",
      "\u4eca\u5929\u8dd1\u6b6530\u5206\u949f",
      "\u5de5\u8d44\u5230\u8d2612000"
    ]
  },

  toggleInputMode() {
    this.setData({
      showVoiceInput: !this.data.showVoiceInput
    });
  },

  onInput(event) {
    this.setData({
      inputText: event.detail.value
    });
  },

  fillExample(event) {
    this.setData({
      inputText: event.currentTarget.dataset.value,
      showVoiceInput: false
    });
  },

  handleVoicePress() {
    wx.showToast({
      title: this.data.ui.toastVoice,
      icon: "none"
    });
  },

  submitForAutofill() {
    const text = String(this.data.inputText || "").trim();
    if (!text) {
      wx.showToast({
        title: this.data.showVoiceInput ? this.data.ui.toastVoiceOrText : this.data.ui.toastInput,
        icon: "none"
      });
      return;
    }

    createPrefilledRecord(text, this.data.showVoiceInput ? "voice" : "text");
    wx.navigateTo({
      url: "/pages/detail-edit/detail-edit?mode=temp"
    });
  }
});
