const {
  getRecordById,
  saveRecordDetail,
  updateRemoteDraftParse,
  getCategories,
  getPrefilledRecord,
  savePrefilledAsDraft,
  clearPrefilledRecord
} = require("../../services/appService");
const { parseTraceInput } = require("../../services/aiParser");
const { toDateId, formatDateTime } = require("../../utils/date");
const { isCloudDatabaseWatchAvailable } = require("../../utils/runtime");
const { logError, showErrorToast, showErrorModal } = require("../../utils/error-handler");

function buildUi() {
  return {
    title: "\u7559\u75d5\u8be6\u60c5",
    subtitle: "\u786e\u8ba4\u4fe1\u606f\u65e0\u8bef\u540e\u6b63\u5f0f\u63d0\u4ea4\u3002",
    remoteDraftPendingSubtitle: "\u6b63\u5728\u8c03\u7528 AI \u89e3\u6790\u7559\u75d5\u8981\u70b9\uff0c\u9875\u9762\u4f1a\u81ea\u52a8\u66f4\u65b0\u3002",
    typeLabel: "\u8bb0\u5f55\u7c7b\u578b",
    typeDone: "\u5df2\u5b8c\u6210\u52a8\u4f5c",
    typePlan: "\u672a\u5b8c\u6210\u89c4\u5212",
    actionName: "\u52a8\u4f5c\u540d\u79f0",
    actionPlaceholder: "\u4f8b\u5982\uff1a\u63d0\u4ea4\u5468\u62a5",
    category: "\u5206\u7c7b",
    categoryPlaceholder: "\u7b49\u5f85\u89e3\u6790\u6216\u624b\u52a8\u9009\u62e9",
    dueDate: "\u622a\u6b62\u65e5\u671f",
    dueDatePlaceholder: "\u9009\u62e9\u622a\u6b62\u65e5\u671f",
    dueTime: "\u622a\u6b62\u65f6\u6bb5",
    priority: "\u4f18\u5148\u7ea7",
    status: "\u4efb\u52a1\u72b6\u6001",
    reminder: "\u63d0\u9192",
    reminderTip: "\u5148\u4fdd\u7559\u63d0\u9192\u610f\u5411\uff0c\u540e\u7eed\u518d\u63a5\u5165\u7cfb\u7edf\u901a\u77e5\u3002",
    description: "\u5907\u6ce8",
    descriptionPlaceholder: "\u8bb0\u4e0b\u4f60\u60f3\u8865\u5145\u7684\u5185\u5bb9",
    amount: "\u82b1\u9500\u91d1\u989d",
    amountPlaceholder: "\u7559\u7a7a\u8868\u793a\u65e0\u82b1\u9500",
    duration: "\u65f6\u957f / \u6570\u91cf",
    durationPlaceholder: "30\u5206\u949f / 2\u6b21",
    budget: "\u9884\u7b97\u91d1\u989d",
    budgetPlaceholder: "\u53ef\u9009",
    recordTime: "\u53d1\u751f\u65f6\u95f4",
    recordTimePlaceholder: "\u7b49\u5f85\u89e3\u6790\u6216\u624b\u52a8\u9009\u62e9",
    createdAt: "\u521b\u5efa\u65f6\u95f4",
    save: "\u4fdd\u5b58",
    confirm: "\u786e\u8ba4\u63d0\u4ea4",
    refresh: "\u5237\u65b0\u89e3\u6790\u7ed3\u679c",
    parsing: "\u6b63\u5728\u6574\u7406",
    parsed: "\u89e3\u6790\u5b8c\u6210",
    failed: "\u89e3\u6790\u5931\u8d25",
    parsingTip: "\u6b63\u5728\u66ff\u4f60\u6574\u7406\u8fd9\u6761\u7559\u75d5\u3002",
    parsingSlowTip: "AI \u8fd8\u5728\u601d\u8003\u4e2d\uff0c\u9a6c\u4e0a\u5c31\u597d\u3002",
    parsingTimeoutTip: "\u5df2\u6536\u5230\u7559\u75d5\uff0c\u5269\u4f59\u5b57\u6bb5\u8fd8\u5728\u8865\u5168\u4e2d\u3002",
    parsedTip: "\u89e3\u6790\u7ed3\u679c\u5df2\u56de\u586b\uff0c\u8bf7\u786e\u8ba4\u4fe1\u606f\u65e0\u8bef\u540e\u63d0\u4ea4\u3002",
    failedTip: "\u672a\u80fd\u81ea\u52a8\u89e3\u6790\uff0c\u4f60\u53ef\u4ee5\u624b\u52a8\u8865\u5168\u540e\u63d0\u4ea4\u3002",
    toastName: "\u52a8\u4f5c\u540d\u79f0\u4e0d\u80fd\u4e3a\u7a7a",
    toastSaved: "\u7559\u75d5\u5df2\u786e\u8ba4",
    toastPending: "\u6b63\u5728\u89e3\u6790\uff0c\u8bf7\u7a0d\u5019",
    toastRefreshed: "\u5df2\u66f4\u65b0\u89e3\u6790\u7ed3\u679c",
    toastParseFailed: "AI \u6682\u65f6\u6ca1\u6574\u7406\u597d\uff0c\u4f60\u53ef\u4ee5\u5148\u624b\u52a8\u8865\u5168",
    submitting: "\u6b63\u5728\u786e\u8ba4\u63d0\u4ea4"
  };
}

function buildDefaultForm() {
  const now = new Date();
  return {
    recordType: "done",
    actionName: "",
    description: "",
    categoryId: "other",
    categoryName: "\u5176\u4ed6",
    amount: "",
    durationQuantity: "",
    recordTime: toDateId(now),
    createdAt: now.toISOString(),
    createdAtDisplay: formatDateTime(now),
    dueDate: "",
    dueTime: "",
    priority: "low",
    budgetAmount: "",
    reminderEnabled: false,
    status: "todo",
    originalContent: "",
    aiParseStatus: "parsed"
  };
}

function toAmountInput(value) {
  return value || value === 0 ? String(value) : "";
}

Page({
  data: {
    ui: buildUi(),
    recordId: "",
    mode: "normal",
    hasSubmitted: false,
    isRemoteDraft: false,
    isRefreshingParse: false,
    isSubmitting: false,
    pendingTipLevel: 0,
    pageSubtitle: "",
    parseStatusText: "",
    parseStatusTip: "",
    categoryOptions: [],
    categoryIndex: 0,
    categoryDisplayName: "",
    priorityOptions: ["high", "medium", "low"],
    priorityLabels: ["\u9ad8", "\u4e2d", "\u4f4e"],
    priorityIndex: 2,
    statusOptions: ["todo", "done", "overdue"],
    statusLabels: ["\u5f85\u529e", "\u5df2\u5b8c\u6210", "\u903e\u671f"],
    statusIndex: 0,
    dueTimeOptions: ["", "\u4e0a\u5348", "\u4e2d\u5348", "\u4e0b\u5348", "\u665a\u4e0a"],
    dueTimeLabels: ["\u672a\u8bbe\u7f6e", "\u4e0a\u5348", "\u4e2d\u5348", "\u4e0b\u5348", "\u665a\u4e0a"],
    dueTimeIndex: 0,
    saveButtonText: "\u4fdd\u5b58",
    form: buildDefaultForm()
  },

  async onLoad(options) {
    this.recordWatcher = null;
    this.pendingTipTimers = [];
    try {
      const categories = getCategories();
      const mode = options.mode === "temp" ? "temp" : options.mode === "remoteDraft" ? "remoteDraft" : "normal";
      const record = await this.resolveInitialRecord(options, mode);

      this.setData({
        recordId: options.id || (record ? record.id : ""),
        mode,
        isRemoteDraft: mode === "remoteDraft",
        categoryOptions: categories,
        pageSubtitle: this.getPageSubtitle(mode, record)
      });

      this.applyRecordToForm(record, mode);

      if (mode === "remoteDraft") {
        this.updateParseMeta(this.data.form.aiParseStatus);
        this.syncPendingFeedback(this.data.form.aiParseStatus);
        this.startRecordWatch();
        this.startAiParse(false);
      }
    } catch (error) {
      logError("detail-edit.onLoad", error, { options });
      showErrorToast(error, "详情加载失败");
    }
  },

  getPageSubtitle(mode, record) {
    const ui = this.data ? this.data.ui : buildUi();
    if (mode === "remoteDraft" && record && (record.aiParseStatus || "parsed") === "pending") {
      return ui.remoteDraftPendingSubtitle;
    }
    return ui.subtitle;
  },

  onUnload() {
    this.stopRecordWatch();
    this.clearPendingFeedbackTimers();

    if (this.data.mode !== "temp" || this.data.hasSubmitted) {
      return;
    }

    if (!this.hasMeaningfulContent()) {
      clearPrefilledRecord();
      return;
    }

    savePrefilledAsDraft({
      id: this.data.recordId || `record_${Date.now()}`,
      ...this.data.form
    });
  },

  async resolveInitialRecord(options, mode) {
    if (options.id) {
      if (mode === "remoteDraft") {
        const temp = getPrefilledRecord();
        if (temp && temp.id === options.id) {
          return temp;
        }
      }
      return await getRecordById(options.id, true);
    }
    if (mode === "temp") {
      return getPrefilledRecord();
    }
    return null;
  },

  applyRecordToForm(record, modeOverride) {
    const categories = this.data.categoryOptions.length ? this.data.categoryOptions : getCategories();
    const normalizedStatus = record
      ? (record.status === "draft"
          ? (record.recordType === "plan" ? "todo" : "done")
          : (record.status || (record.recordType === "plan" ? "todo" : "done")))
      : "todo";
    const nextForm = record
      ? {
          recordType: record.recordType || "done",
          actionName: record.actionName || "",
          description: record.description || "",
          categoryId: record.categoryId || "",
          categoryName: record.categoryName || "",
          amount: toAmountInput(record.amount),
          durationQuantity: record.durationQuantity || "",
          recordTime: record.recordTime || "",
          createdAt: record.createdAt || new Date().toISOString(),
          createdAtDisplay: record.createdAtDisplay || formatDateTime(record.createdAt || new Date()),
          dueDate: record.dueDate || "",
          dueTime: record.dueTime || "",
          priority: record.priority || "low",
          budgetAmount: toAmountInput(record.budgetAmount),
          reminderEnabled: Boolean(record.reminderEnabled),
          status: normalizedStatus,
          originalContent: record.originalContent || "",
          aiParseStatus: record.aiParseStatus || "parsed"
        }
      : buildDefaultForm();

    const categoryIndex = Math.max(categories.findIndex((item) => item.id === nextForm.categoryId), 0);
    const hasMatchedCategory = categoryIndex >= 0 && categories[categoryIndex] && categories[categoryIndex].id === nextForm.categoryId;
    const categoryDisplay = nextForm.categoryName || (hasMatchedCategory ? categories[categoryIndex].name : this.data.ui.categoryPlaceholder);
    const priorityIndex = Math.max(this.data.priorityOptions.indexOf(nextForm.priority), 0);
    const dueTimeIndex = Math.max(this.data.dueTimeOptions.indexOf(nextForm.dueTime), 0);
    const statusIndex = Math.max(this.data.statusOptions.indexOf(nextForm.status), 0);

    this.setData({
      form: nextForm,
      categoryIndex,
      categoryDisplayName: categoryDisplay,
      priorityIndex,
      dueTimeIndex,
      statusIndex,
      saveButtonText: (modeOverride || this.data.mode) === "remoteDraft" ? this.data.ui.confirm : this.data.ui.save
    });
  },

  updateParseMeta(status) {
    const ui = this.data.ui;
    let parseStatusText = "";
    let parseStatusTip = "";

    if (status === "pending") {
      parseStatusText = ui.parsing;
      if (this.data.pendingTipLevel >= 2) {
        parseStatusTip = ui.parsingTimeoutTip;
      } else if (this.data.pendingTipLevel >= 1) {
        parseStatusTip = ui.parsingSlowTip;
      } else {
        parseStatusTip = ui.parsingTip;
      }
    } else if (status === "failed") {
      parseStatusText = ui.failed;
      parseStatusTip = ui.failedTip;
    } else {
      parseStatusText = ui.parsed;
      parseStatusTip = ui.parsedTip;
    }

    this.setData({
      parseStatusText,
      parseStatusTip,
      pageSubtitle: status === "pending" ? ui.remoteDraftPendingSubtitle : ui.subtitle
    });
  },

  clearPendingFeedbackTimers() {
    (this.pendingTipTimers || []).forEach((timer) => clearTimeout(timer));
    this.pendingTipTimers = [];
  },

  startRecordWatch() {
    if (!isCloudDatabaseWatchAvailable() || !this.data.recordId || this.recordWatcher) {
      return;
    }
    try {
      const db = wx.cloud.database();
      this.recordWatcher = db.collection("liuhen_records").where({
        recordId: this.data.recordId
      }).watch({
        onChange: async (snapshot) => {
          const doc = snapshot && snapshot.docs && snapshot.docs[0];
          if (!doc) {
            return;
          }
          const nextStatus = doc.aiParseStatus || "parsed";
          if (nextStatus === "pending") {
            return;
          }
          try {
            const record = await getRecordById(this.data.recordId, true);
            if (record) {
              this.applyRecordToForm(record, this.data.mode);
              this.updateParseMeta(record.aiParseStatus || "parsed");
              this.syncPendingFeedback(record.aiParseStatus || "parsed");
            }
          } catch (error) {
            logError("detail-edit.recordWatch.refresh", error, { recordId: this.data.recordId });
          }
        },
        onError: (error) => {
          logError("detail-edit.recordWatch", error, { recordId: this.data.recordId });
        }
      });
    } catch (error) {
      logError("detail-edit.recordWatch.bootstrap", error, { recordId: this.data.recordId });
    }
  },

  stopRecordWatch() {
    if (this.recordWatcher && typeof this.recordWatcher.close === "function") {
      this.recordWatcher.close();
    }
    this.recordWatcher = null;
  },

  syncPendingFeedback(status) {
    this.clearPendingFeedbackTimers();
    if (status !== "pending") {
      if (this.data.pendingTipLevel !== 0) {
        this.setData({ pendingTipLevel: 0 });
      }
      return;
    }

    if (this.data.pendingTipLevel !== 0) {
      this.setData({ pendingTipLevel: 0 });
    }

    this.pendingTipTimers = [
      setTimeout(() => {
        if (this.data.form.aiParseStatus === "pending") {
          this.setData({ pendingTipLevel: 1 });
          this.updateParseMeta("pending");
        }
      }, 3000),
      setTimeout(() => {
        if (this.data.form.aiParseStatus === "pending") {
          this.setData({ pendingTipLevel: 2 });
          this.updateParseMeta("pending");
        }
      }, 8000)
    ];
  },

  async startAiParse(isManual) {
    if (!this.data.isRemoteDraft || !this.data.recordId || this.data.isRefreshingParse) {
      return;
    }

    if (this.data.form.aiParseStatus === "parsed" && !isManual) {
      return;
    }

    this.setData({ isRefreshingParse: true });

    try {
      const parsed = await parseTraceInput(
        this.data.form.originalContent || this.data.form.actionName,
        this.data.form.draftSource || "text",
        {
          id: this.data.recordId,
          createdAt: this.data.form.createdAt,
          createdAtDisplay: this.data.form.createdAtDisplay
        }
      );
      const record = await updateRemoteDraftParse(this.data.recordId, parsed);
      if (record) {
        this.applyRecordToForm(record, this.data.mode);
        this.updateParseMeta(record.aiParseStatus || "parsed");
        this.syncPendingFeedback(record.aiParseStatus || "parsed");
      }
      if (isManual) {
        wx.showToast({
          title: this.data.ui.toastRefreshed,
          icon: "none"
        });
      }
    } catch (error) {
      this.setData({
        "form.aiParseStatus": "failed"
      });
      this.updateParseMeta("failed");
      this.syncPendingFeedback("failed");
      try {
        await updateRemoteDraftParse(this.data.recordId, {
          aiParseStatus: "failed"
        });
      } catch (persistError) {
        logError("detail-edit.persistFailedState", persistError, { recordId: this.data.recordId });
      }
      showErrorToast(error, this.data.ui.toastParseFailed);
    } finally {
      this.setData({ isRefreshingParse: false });
    }
  },

  hasMeaningfulContent() {
    const form = this.data.form;
    return Boolean(
      String(form.originalContent || "").trim() ||
      String(form.actionName || "").trim() ||
      String(form.description || "").trim() ||
      String(form.amount || "").trim()
    );
  },

  onFieldInput(event) {
    const key = event.currentTarget.dataset.key;
    this.setData({
      [`form.${key}`]: event.detail.value
    });
  },

  onRecordTypeChange(event) {
    this.setData({
      "form.recordType": event.detail.value
    });
  },

  onCategoryChange(event) {
    const index = Number(event.detail.value);
    const category = this.data.categoryOptions[index] || { id: "other", name: "\u5176\u4ed6" };
    this.setData({
      categoryIndex: index,
      categoryDisplayName: category.name,
      "form.categoryId": category.id,
      "form.categoryName": category.name
    });
  },

  onDateChange(event) {
    this.setData({
      "form.recordTime": event.detail.value
    });
  },

  onDueDateChange(event) {
    this.setData({
      "form.dueDate": event.detail.value
    });
  },

  onDueTimeChange(event) {
    const index = Number(event.detail.value);
    this.setData({
      dueTimeIndex: index,
      "form.dueTime": this.data.dueTimeOptions[index]
    });
  },

  onPriorityChange(event) {
    const index = Number(event.detail.value);
    this.setData({
      priorityIndex: index,
      "form.priority": this.data.priorityOptions[index]
    });
  },

  onStatusChange(event) {
    const index = Number(event.detail.value);
    this.setData({
      statusIndex: index,
      "form.status": this.data.statusOptions[index]
    });
  },

  onReminderChange(event) {
    this.setData({
      "form.reminderEnabled": event.detail.value
    });
  },

  async onRefreshTap() {
    await this.startAiParse(true);
  },

  async save() {
    if (this.data.isSubmitting) {
      return;
    }

    if (!String(this.data.form.actionName || "").trim()) {
      wx.showToast({
        title: this.data.ui.toastName,
        icon: "none"
      });
      return;
    }

    if (this.data.isRemoteDraft && this.data.form.aiParseStatus === "pending") {
      wx.showToast({
        title: this.data.ui.toastPending,
        icon: "none"
      });
      return;
    }

    this.setData({
      hasSubmitted: true,
      isSubmitting: true
    });

    try {
      const fallbackCategoryId = this.data.form.categoryId || "other";
      const fallbackCategoryName = this.data.form.categoryName || (fallbackCategoryId ? (this.data.categoryOptions.find((item) => item.id === fallbackCategoryId) || {}).name : "") || "\u5176\u4ed6";
      await saveRecordDetail({
        id: this.data.recordId || `record_${Date.now()}`,
        ...this.data.form,
        categoryId: fallbackCategoryId,
        categoryName: fallbackCategoryName,
        recordTime: this.data.form.recordTime || ""
      });

      wx.showToast({
        title: this.data.ui.toastSaved,
        icon: "success"
      });

      setTimeout(() => {
        wx.reLaunch({
          url: "/pages/home/home"
        });
      }, 120);
    } catch (error) {
      logError("detail-edit.save", error, {
        recordId: this.data.recordId,
        mode: this.data.mode,
        form: this.data.form
      });
      this.setData({
        hasSubmitted: false,
        isSubmitting: false
      });
      showErrorModal("保存失败", error, "保存失败");
      showErrorToast(error, "保存失败");
      return;
    }

    this.setData({
      isSubmitting: false
    });
  }
});
