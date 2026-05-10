const { getReminderItems, saveRecordDetail, getRecordById } = require("../../services/appService");
const { logError, showErrorToast } = require("../../utils/error-handler");

Page({
  data: {
    reminders: []
  },

  async onShow() {
    try {
      await this.loadReminders();
    } catch (error) {
      logError("reminder-manage.onShow", error);
      showErrorToast(error, "提醒加载失败");
    }
  },

  async loadReminders() {
    this.setData({
      reminders: await getReminderItems()
    });
  },

  async disableReminder(event) {
    try {
      const record = await getRecordById(event.currentTarget.dataset.id);
      if (!record) {
        return;
      }
      await saveRecordDetail({
        ...record,
        reminderEnabled: false
      });
      await this.loadReminders();
    } catch (error) {
      logError("reminder-manage.disableReminder", error, {
        recordId: event.currentTarget.dataset.id
      });
      showErrorToast(error, "关闭提醒失败");
    }
  },

  openRecord(event) {
    wx.navigateTo({
      url: `/pages/detail-edit/detail-edit?id=${event.currentTarget.dataset.id}`
    });
  }
});
