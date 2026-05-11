const {
  createPrefilledRecord,
  createRemoteDraftFromInput,
  recognizeVoiceInput,
  getHomeData,
  switchSpace
} = require("../../services/appService");
const { isRemoteEnabled } = require("../../utils/runtime");
const { logError, showErrorToast } = require("../../utils/error-handler");
const { clearCurrentSpace } = require("../../utils/session");
const { navigateMainPage } = require("../../utils/navigation");
const { invalidateRemoteCache } = require("../../services/app/record-cache");
const perf = require("../../utils/perf");
const feedback = require("../../utils/feedback");

const PAGE_PATH = "/pages/home/home";

const DAILY_TARGET = 3;
const VOICE_MIN_DURATION = 700;
const VOICE_MAX_DURATION = 60000;
const RIPPLE_INTERVAL = 520;
const RIPPLE_MAX = 3;
const RECORDER_OPTIONS = {
  duration: VOICE_MAX_DURATION,
  sampleRate: 16000,
  numberOfChannels: 1,
  encodeBitRate: 48000,
  format: "mp3",
  frameSize: 3
};

function formatVoiceDuration(seconds) {
  const safeSeconds = Math.max(0, Number(seconds || 0));
  const minute = Math.floor(safeSeconds / 60);
  const second = safeSeconds % 60;
  return `${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
}

Page({
  data: {
    ui: {
      brandTitle: "\u7559\u75d5",
      brandSubtitle: "\u5148\u8bb0\u4e0b\u6765\uff0c\u518d\u6162\u6162\u5b8c\u5584",
      personalMode: "\u4e2a\u4eba\u7a7a\u95f4",
      scopeLabel: "\u5f53\u524d\u7a7a\u95f4",
      draftBox: "\u8349\u7a3f\u7bb1",
      switchSpace: "\u5207\u6362\u7a7a\u95f4",
      createSpace: "\u521b\u5efa\u65b0\u7a7a\u95f4",
      joinSpace: "\u52a0\u5165\u65b0\u7a7a\u95f4",
      backToPersonal: "\u5207\u56de\u4e2a\u4eba\u7a7a\u95f4",
      quoteLineOne: "\u8bb0\u5f55\u6b64\u523b\uff0c",
      quoteLineTwo: "\u672a\u6765\u7684\u4f60\u4f1a\u611f\u8c22\u73b0\u5728\u7684\u81ea\u5df1\u3002",
      progressTitle: "\u4eca\u65e5\u8db3\u8ff9",
      progressInfo: "\u8ba9\u6bcf\u4e00\u6b21\u8bb0\u5f55\uff0c\u90fd\u53d8\u6210\u6e05\u6670\u53ef\u89c1\u7684\u6210\u957f\u8f68\u8ff9\u3002",
      progressGoalHint: "\u4eca\u65e5\u5c0f\u76ee\u6807\u00b7\u8bb0\u4e0b 3 \u6761\u8db3\u8ff9",
      progressBubblePrefix: "\u518d\u8bb0\u5f55",
      progressBubbleSuffix: "\u6761\uff0c\u5c31\u80fd\u70b9\u4eae\u5c0f\u6811",
      progressDone: "\u4eca\u5929\u7684\u5c0f\u6811\u5df2\u7ecf\u88ab\u4f60\u70b9\u4eae\u4e86",
      progressBeyondPrefix: "\u4eca\u5929\u5df2\u7559\u4e0b ",
      progressBeyondSuffix: " \u6761\u8db3\u8ff9\uff0c\u5c0f\u6811\u679d\u7e41\u53f6\u8302\u4e86\u2728",
      traceTitle: "\u7559\u75d5",
      traceSubtitle: "\u8bed\u97f3 / \u6587\u5b57\u5feb\u901f\u8bb0\u5f55",
      traceSideLeftOne: "\u8bf4\u4e00\u53e5",
      traceSideLeftTwo: "\u5c31\u80fd\u8bb0\u5f55",
      traceSideRightOne: "\u8ba9\u6bcf\u4e2a\u77ac\u95f4",
      traceSideRightTwo: "\u90fd\u6709\u8ff9\u53ef\u5faa",
      traceHintEmpty: "\u4eca\u5929\u8fd8\u6ca1\u6709\u7559\u4e0b\u75d5\u8ff9\uff0c\u5feb\u6765\u8bb0\u5f55\u5427\uff5e",
      traceHintDone: "\u4eca\u5929\u5df2\u7ecf\u7559\u4e0b\u65b0\u7684\u75d5\u8ff9\uff0c\u7ee7\u7eed\u4fdd\u6301\u5427",
      overviewTitle: "\u4eca\u65e5\u8db3\u8ff9",
      doneTitle: "\u5df2\u8bb0\u5f55",
      todoTitle: "\u5f85\u529e\u4e8b\u9879",
      todoEmpty: "\u4eca\u5929\u8fd8\u6ca1\u6709\u5f85\u529e\u4e8b\u9879\uff0c\u53ef\u4ee5\u53bb\u7559\u4e0b\u65b0\u7684\u8ba1\u5212\u3002",
      doneEmpty: "\u4eca\u5929\u8fd8\u6ca1\u6709\u8bb0\u5f55\uff0c\u70b9\u4e0a\u9762\u7684\u201c\u7559\u75d5\u201d\u5f00\u59cb\u7b2c\u4e00\u6761\u3002",
      noDueDate: "\u672a\u8bbe\u7f6e\u622a\u6b62\u65e5\u671f",
      metaSeparator: "\u00b7",
      high: "\u9ad8\u4f18\u5148\u7ea7",
      medium: "\u4e2d\u4f18\u5148\u7ea7",
      low: "\u4f4e\u4f18\u5148\u7ea7",
      doneText: "\u5df2\u5b8c\u6210",
      currencyPrefix: "\u00a5",
      countSuffix: "\u6761",
      overviewQuote: "\u5b8c\u6210\u8bb0\u5f55\u540e\uff0c\u522b\u5fd8\u4e86\u56de\u987e\u548c\u603b\u7ed3\u54e6\uff5e",
      composerTitle: "\u7559\u4e0b\u4e00\u6761\u75d5\u8ff9",
      composerPlaceholder: "\u8bb0\u5f55\u6b64\u523b\u7684\u7f8e\u597d...",
      composerSave: "\u4fdd\u5b58\u8bb0\u5f55",
      composerSaving: "\u6b63\u5728\u5199\u5165",
      composerHint: "\u5df2\u6536\u5230\u5185\u5bb9\uff0c\u6b63\u5728\u8bc6\u522b\u5e76\u8865\u5168\u3002",
      voiceRecording: "\u6b63\u5728\u542c\u4f60\u8bf4",
      voiceRecognizing: "\u6b63\u5728\u8f6c\u6210\u6587\u5b57",
      voiceRecognized: "\u5df2\u8f6c\u6210\u6587\u5b57",
      voiceListening: "\u6b63\u5728\u804b\u542c\u60a8\u7684\u5fc3\u58f0...",
      voiceTapToStop: "\u518d\u70b9\u4e00\u6b21\u7ed3\u675f\u5f55\u97f3",
      quickVoiceStart: "\u677e\u624b\u5b8c\u6210\u7559\u75d5",
      quickVoiceSubmitting: "\u5df2\u542c\u5230\uff0c\u6b63\u5728\u6574\u7406",
      toastInput: "\u5148\u8f93\u5165\u5185\u5bb9",
      toastVoiceBusy: "\u8bed\u97f3\u8fd8\u5728\u5904\u7406"
    },
    currentTab: "/pages/home/home",
    dailyTarget: DAILY_TARGET,
    activeFeedTab: "completed",
    draftCount: 0,
    todayRecordCount: 0,
    todayCompleted: [],
    todayPlans: [],
    todayCompletedCount: 0,
    todayPlanCount: 0,
    currentScopeLabel: "",
    statusBarHeight: 20,
    navBarHeight: 88,
    menuRightWidth: 96,
    progressIndicatorPercent: 0,
    progressLevel: 0,
    progressBeyond: false,
    progressBubbleText: "",
    traceHintText: "",
    composerVisible: false,
    composerText: "",
    composerCount: 0,
    composerSubmitting: false,
    composerHintVisible: false,
    voiceRecording: false,
    voiceRecognizing: false,
    voiceStatusText: "",
    voiceDurationText: "00:00",
    heroVoiceActive: false,
    heroVoiceStatusText: "",
    heroPressed: false,
    heroLoading: false,
    heroSuccess: false,
    heroRipples: [],
    progressSparkVisible: false,
    progressSparkFrom: 0,
    progressSparkTo: 33,
    lastInsertedId: ""
  },

  onLoad() {
    perf.markPageLoad(PAGE_PATH);
    this.setupCustomNav();
    this.initRecorder();
  },

  onHide() {
    perf.markPageHide(PAGE_PATH);
  },

  async onShow() {
    perf.markPageShow(PAGE_PATH);
    // 1) 立即从 globalData 快照预填，避免空白
    this.hydrateFromCache();
    // 2) syncBootstrap 与 loadHome 并行（loadHome 不依赖 bootstrap 结果）
    try {
      await Promise.all([
        this.syncBootstrap().catch((error) => {
          logError("home.syncBootstrap", error);
        }),
        this.loadHome().catch((error) => {
          logError("home.loadHome", error);
          showErrorToast(error, "首页加载失败，请稍后重试");
        })
      ]);
    } catch (error) {
      logError("home.onShow", error);
      showErrorToast(error, "首页加载失败，请稍后重试");
    }
    perf.log("onShow.done", PAGE_PATH);
  },

  hydrateFromCache() {
    const app = getApp();
    const cachedHome = app.globalData.lastHomeData;
    if (cachedHome) {
      this.applyHomeData(cachedHome, true);
    }
    const activeSpace = app.globalData.activeSpace;
    if (activeSpace || this.data.ui.personalMode) {
      this.setData({
        currentScopeLabel: activeSpace ? activeSpace.name : this.data.ui.personalMode
      });
    }
  },

  setupCustomNav() {
    try {
      const systemInfo = wx.getSystemInfoSync();
      const menuButton = wx.getMenuButtonBoundingClientRect();
      const statusBarHeight = Number(systemInfo.statusBarHeight || 20);
      const navBarHeight = menuButton.top + menuButton.height + (menuButton.top - statusBarHeight);
      const menuRightWidth = Math.max(88, systemInfo.windowWidth - menuButton.left);
      this.setData({
        statusBarHeight,
        navBarHeight,
        menuRightWidth
      });
    } catch (error) {
      this.setData({
        statusBarHeight: 20,
        navBarHeight: 88,
        menuRightWidth: 96
      });
    }
  },

  async syncBootstrap() {
    const app = getApp();
    const bootstrap = await app.syncBootstrap();
    const activeSpace = bootstrap.activeSpace;
    this.setData({
      currentScopeLabel: activeSpace ? activeSpace.name : this.data.ui.personalMode
    });
  },

  async loadHome() {
    const homeData = await getHomeData();
    getApp().globalData.lastHomeData = homeData; // 写回快照供下次 onShow 命中
    this.applyHomeData(homeData, false);
  },

  applyHomeData(homeData, fromCache) {
    const todayCompletedCount = (homeData.todayCompleted || []).length;
    const todayPlanCount = (homeData.todayPlans || []).length;
    const todayRecordCount = Number(homeData.todayRecordCount || 0);
    const remaining = Math.max(0, DAILY_TARGET - todayRecordCount);
    const progressLevel = Math.min(DAILY_TARGET, Math.max(0, todayRecordCount));
    const indicatorStep = Math.max(1, progressLevel);
    const progressBeyond = todayRecordCount > DAILY_TARGET;
    const ui = this.data.ui;
    let progressBubbleText;
    if (progressBeyond) {
      progressBubbleText = `${ui.progressBeyondPrefix}${todayRecordCount}${ui.progressBeyondSuffix}`;
    } else if (remaining) {
      progressBubbleText = `${ui.progressBubblePrefix} ${remaining} ${ui.progressBubbleSuffix}`;
    } else {
      progressBubbleText = ui.progressDone;
    }

    this.setData({
      draftCount: homeData.draftCount,
      todayRecordCount,
      todayCompleted: homeData.todayCompleted || [],
      todayPlans: homeData.todayPlans || [],
      todayCompletedCount,
      todayPlanCount,
      progressIndicatorPercent: ((indicatorStep - 1) / (DAILY_TARGET - 1)) * 100,
      progressLevel,
      progressBeyond,
      progressBubbleText,
      traceHintText: todayRecordCount ? this.data.ui.traceHintDone : this.data.ui.traceHintEmpty
    });
  },

  goQuickRecord() {
    if (this.suppressNextHeroTap) {
      this.suppressNextHeroTap = false;
      return;
    }
    if (this.data.voiceRecording || this.data.voiceRecognizing || this.data.composerSubmitting) {
      return;
    }
    this.setData({
      composerVisible: true,
      composerHintVisible: false
    });
  },

  closeComposer() {
    if (this.data.composerSubmitting) {
      return;
    }
    if (this.data.voiceRecording && this.recorderManager) {
      this.skipNextVoiceRecognition = true;
      this.recorderManager.stop();
    }
    this.clearVoiceTimer();
    this.clearComposerHintTimer();
    this.setData({
      composerVisible: false,
      composerText: "",
      composerCount: 0,
      composerHintVisible: false,
      voiceRecording: false,
      voiceRecognizing: false,
      voiceStatusText: "",
      voiceDurationText: "00:00",
      heroVoiceActive: false,
      heroVoiceStatusText: ""
    });
  },

  noop() {},

  onComposerInput(event) {
    const value = event.detail.value || "";
    this.setData({
      composerText: value,
      composerCount: value.length
    });
  },

  initRecorder() {
    if (!wx.getRecorderManager) {
      this.recorderManager = null;
      return;
    }
    const recorderManager = wx.getRecorderManager();
    this.recorderManager = recorderManager;
    recorderManager.onStart(() => {
      this.voiceStartTime = Date.now();
      this.startVoiceTimer();
      this.startRippleLoop(); // 状态 3：录音中持续吐波纹
      const isQuickVoice = this.voiceInputMode === "quick";
      this.setData({
        voiceRecording: true,
        voiceRecognizing: false,
        voiceStatusText: this.data.ui.voiceRecording,
        voiceDurationText: "00:00",
        heroVoiceActive: isQuickVoice,
        heroVoiceStatusText: isQuickVoice ? this.data.ui.quickVoiceStart : ""
      });
      if (this.pendingQuickVoiceStop && isQuickVoice) {
        this.pendingQuickVoiceStop = false;
        setTimeout(() => {
          if (this.data.voiceRecording && this.voiceInputMode === "quick") {
            this.recorderManager.stop();
          }
        }, VOICE_MIN_DURATION);
      }
    });
    if (recorderManager.onFrameRecorded) {
      recorderManager.onFrameRecorded((res) => {
        // 用 frameBuffer 的体量近似估计音量强度（无需 AudioContext）
        if (!res || !res.frameBuffer) return;
        const len = res.frameBuffer.byteLength || 0;
        // 经验值：3KB 帧大小，越大代表越响（不精确但足以驱动视觉）
        const intensity = Math.max(0.35, Math.min(1, len / 3072));
        this.lastVoiceIntensity = intensity;
      });
    }
    recorderManager.onStop((res) => {
      this.stopRippleLoop();
      this.handleRecorderStop(res);
    });
    recorderManager.onError((error) => {
      logError("home.recorder", error);
      this.clearVoiceTimer();
      this.stopRippleLoop();
      feedback.error();
      this.setData({
        voiceRecording: false,
        voiceRecognizing: false,
        voiceStatusText: "",
        voiceDurationText: "00:00",
        heroVoiceActive: false,
        heroVoiceStatusText: "",
        heroLoading: false
      });
      showErrorToast(error, "录音失败，请稍后重试");
    });
  },

  startVoiceTimer() {
    this.clearVoiceTimer();
    this.voiceTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - (this.voiceStartTime || Date.now())) / 1000);
      this.setData({
        voiceDurationText: formatVoiceDuration(elapsed)
      });
    }, 500);
  },

  clearVoiceTimer() {
    if (this.voiceTimer) {
      clearInterval(this.voiceTimer);
      this.voiceTimer = null;
    }
  },

  requestRecordPermission() {
    return new Promise((resolve, reject) => {
      wx.getSetting({
        success: (setting) => {
          if (setting.authSetting["scope.record"]) {
            resolve();
            return;
          }
          wx.authorize({
            scope: "scope.record",
            success: resolve,
            fail: () => {
              const error = new Error("record-permission-denied");
              error.code = "record-permission-denied";
              reject(error);
            }
          });
        },
        fail: reject
      });
    });
  },

  async toggleVoiceInput() {
    if (this.data.composerSubmitting || this.data.voiceRecognizing) {
      wx.showToast({
        title: this.data.ui.toastVoiceBusy,
        icon: "none"
      });
      return;
    }
    if (!this.recorderManager) {
      wx.showToast({
        title: "当前基础库不支持录音",
        icon: "none"
      });
      return;
    }
    if (this.data.voiceRecording) {
      this.recorderManager.stop();
      return;
    }

    try {
      await this.requestRecordPermission();
      this.voiceInputMode = "composer";
      this.skipNextVoiceRecognition = false;
      this.recorderManager.start(RECORDER_OPTIONS);
    } catch (error) {
      logError("home.requestRecordPermission", error);
      showErrorToast(error, "无法使用麦克风");
    }
  },

  onHeroTouchStart() {
    if (this.data.voiceRecording || this.data.voiceRecognizing || this.data.composerSubmitting) {
      return;
    }
    this.heroHoldTriggered = false;
    this.pendingQuickVoiceStop = false;
    this.setData({ heroPressed: true });
    feedback.tap();
    this.spawnRipple(0.7); // 状态 2：按下瞬间荡开第一圈波纹
    clearTimeout(this.heroHoldTimer);
    this.heroHoldTimer = setTimeout(() => {
      this.heroHoldTriggered = true;
      this.suppressNextHeroTap = true;
      this.startQuickVoiceInput();
    }, 350);
  },

  onHeroTouchEnd() {
    clearTimeout(this.heroHoldTimer);
    this.setData({ heroPressed: false });
    if (this.heroHoldTriggered || this.voiceInputMode === "quick") {
      this.stopQuickVoiceInput();
    }
  },

  onHeroTouchCancel() {
    clearTimeout(this.heroHoldTimer);
    this.setData({ heroPressed: false });
    if (this.heroHoldTriggered || this.voiceInputMode === "quick") {
      this.stopQuickVoiceInput();
    }
  },

  // 状态 2/3：根据音量产生波纹
  spawnRipple(intensity) {
    const safeIntensity = Math.max(0.3, Math.min(1, Number(intensity) || 0.5));
    const id = ++this.rippleSeq || (this.rippleSeq = 1);
    const ripple = {
      id,
      scale: 1,
      opacity: 0
    };
    const list = (this.data.heroRipples || []).concat(ripple).slice(-RIPPLE_MAX);
    this.setData({ heroRipples: list });
    // 下一帧改 scale/opacity 触发 transition
    setTimeout(() => {
      const updated = (this.data.heroRipples || []).map((item) =>
        item.id === id
          ? { ...item, scale: 1 + safeIntensity * 0.55, opacity: 0.45 * safeIntensity }
          : item
      );
      this.setData({ heroRipples: updated });
      // 0.5s 后淡出
      setTimeout(() => {
        const fading = (this.data.heroRipples || []).map((item) =>
          item.id === id ? { ...item, opacity: 0, scale: item.scale + 0.15 } : item
        );
        this.setData({ heroRipples: fading });
        // 0.45s 后回收
        setTimeout(() => {
          const cleaned = (this.data.heroRipples || []).filter((item) => item.id !== id);
          this.setData({ heroRipples: cleaned });
        }, 460);
      }, 320);
    }, 16);
  },

  startRippleLoop() {
    this.stopRippleLoop();
    this.rippleTimer = setInterval(() => {
      // 当未拿到音量时，使用呼吸式默认强度
      const intensity = this.lastVoiceIntensity || 0.55;
      this.spawnRipple(intensity);
      this.lastVoiceIntensity = Math.max(0.4, this.lastVoiceIntensity * 0.85);
    }, RIPPLE_INTERVAL);
  },

  stopRippleLoop() {
    if (this.rippleTimer) {
      clearInterval(this.rippleTimer);
      this.rippleTimer = null;
    }
    this.lastVoiceIntensity = 0.55;
  },

  // 状态 4：进入加载态
  enterLoadingState() {
    this.setData({ heroLoading: true });
  },

  exitLoadingState() {
    this.setData({ heroLoading: false });
  },

  // 状态 5：成功反馈 + 进度槽光点联动
  playSuccessBurst(insertedId) {
    feedback.success();
    this.setData({ heroSuccess: true });
    setTimeout(() => this.setData({ heroSuccess: false }), 820);

    // 进度光点：从中央按钮中心出发，飞向当前进度位置
    const fromPercent = 50;
    const toPercent = Math.max(8, Math.min(95, Number(this.data.progressIndicatorPercent) || 33));
    this.setData({
      progressSparkVisible: true,
      progressSparkFrom: fromPercent,
      progressSparkTo: toPercent
    });
    setTimeout(() => this.setData({ progressSparkVisible: false }), 920);

    if (insertedId) {
      this.setData({ lastInsertedId: insertedId });
      setTimeout(() => {
        if (this.data.lastInsertedId === insertedId) {
          this.setData({ lastInsertedId: "" });
        }
      }, 720);
    }
  },

  async startQuickVoiceInput() {
    if (!this.recorderManager || this.data.voiceRecording || this.data.voiceRecognizing) {
      return;
    }
    try {
      await this.requestRecordPermission();
      this.voiceInputMode = "quick";
      this.skipNextVoiceRecognition = false;
      this.recorderManager.start(RECORDER_OPTIONS);
    } catch (error) {
      logError("home.startQuickVoiceInput", error);
      this.resetQuickVoiceState();
      showErrorToast(error, "无法使用麦克风");
    }
  },

  stopQuickVoiceInput() {
    if (this.voiceInputMode !== "quick") {
      if (this.heroHoldTriggered) {
        this.pendingQuickVoiceStop = true;
      }
      return;
    }
    if (this.data.voiceRecording && this.recorderManager) {
      this.recorderManager.stop();
      return;
    }
    this.pendingQuickVoiceStop = true;
  },

  resetQuickVoiceState() {
    this.pendingQuickVoiceStop = false;
    this.heroHoldTriggered = false;
    this.setData({
      heroVoiceActive: false,
      heroVoiceStatusText: ""
    });
  },

  async handleRecorderStop(res) {
    this.clearVoiceTimer();
    const voiceMode = this.voiceInputMode || "composer";
    this.voiceInputMode = "";
    const shouldSkip = this.skipNextVoiceRecognition;
    this.skipNextVoiceRecognition = false;
    this.setData({
      voiceRecording: false
    });
    if (shouldSkip) {
      return;
    }

    const duration = Number(res && res.duration || 0);
    const tempFilePath = res && res.tempFilePath;
    if (!tempFilePath || duration < VOICE_MIN_DURATION) {
      showErrorToast(new Error("voice-too-short"), "说得太短了");
      this.setData({
        voiceStatusText: "",
        voiceDurationText: "00:00",
        heroVoiceActive: false,
        heroVoiceStatusText: ""
      });
      return;
    }

    this.setData({
      voiceRecognizing: true,
      voiceStatusText: this.data.ui.voiceRecognizing,
      voiceDurationText: formatVoiceDuration(Math.round(duration / 1000)),
      heroVoiceActive: voiceMode === "quick",
      heroVoiceStatusText: voiceMode === "quick" ? this.data.ui.quickVoiceSubmitting : "",
      heroLoading: voiceMode === "quick" // 状态 4：松手进入加载环
    });

    try {
      const result = await recognizeVoiceInput(tempFilePath);
      const text = String(result && result.text || "").trim();
      if (!text) {
        throw new Error("asr-empty-result");
      }
      if (voiceMode === "quick") {
        await this.submitTextForAutofill(text, "voice");
        return;
      }
      const currentText = String(this.data.composerText || "").trim();
      const nextText = currentText ? `${currentText}\n${text}` : text;
      this.setData({
        composerText: nextText,
        composerCount: nextText.length,
        voiceStatusText: this.data.ui.voiceRecognized
      });
    } catch (error) {
      logError("home.recognizeVoice", error);
      feedback.error();
      showErrorToast(error, "语音识别失败");
      this.setData({
        voiceStatusText: "",
        heroVoiceStatusText: "",
        heroLoading: false
      });
    } finally {
      this.setData({
        voiceRecognizing: false,
        heroVoiceActive: false,
        heroLoading: false
      });
    }
  },

  clearComposerHintTimer() {
    if (this.composerHintTimer) {
      clearTimeout(this.composerHintTimer);
      this.composerHintTimer = null;
    }
  },

  async submitComposer() {
    const text = String(this.data.composerText || "").trim();
    if (this.data.voiceRecording || this.data.voiceRecognizing) {
      wx.showToast({
        title: this.data.ui.toastVoiceBusy,
        icon: "none"
      });
      return;
    }
    if (!text) {
      wx.showToast({
        title: this.data.ui.toastInput,
        icon: "none"
      });
      return;
    }
    if (this.data.composerSubmitting) {
      return;
    }

    await this.submitTextForAutofill(text, "text");
  },

  async submitTextForAutofill(text, source) {
    if (isRemoteEnabled()) {
      this.setData({
        composerSubmitting: true,
        composerHintVisible: false
      });
      this.clearComposerHintTimer();
      this.composerHintTimer = setTimeout(() => {
        this.setData({
          composerHintVisible: true
        });
      }, 1200);

      try {
        const draft = await createRemoteDraftFromInput(text, source || "text");
        this.clearComposerHintTimer();
        this.setData({
          composerSubmitting: false,
          composerVisible: false,
          composerText: "",
          composerCount: 0,
          composerHintVisible: false,
          heroVoiceStatusText: ""
        });
        // 状态 5：成功联动反馈（quick voice 模式）
        if (source === "voice" && draft && draft.id) {
          this.playSuccessBurst(draft.id);
          // 等待爆开动画播放一会儿再跳转，让用户感知成就
          setTimeout(() => {
            wx.navigateTo({
              url: `/pages/detail-edit/detail-edit?id=${draft.id}&mode=remoteDraft`
            });
          }, 480);
        } else {
          wx.navigateTo({
            url: `/pages/detail-edit/detail-edit?id=${draft.id}&mode=remoteDraft`
          });
        }
      } catch (error) {
        logError("home.submitComposer", error);
        this.clearComposerHintTimer();
        feedback.error();
        this.setData({
          composerSubmitting: false,
          composerHintVisible: false,
          heroLoading: false
        });
        showErrorToast(error, "创建记录失败");
      }
      return;
    }

    createPrefilledRecord(text, source || "text");
    this.setData({
      composerVisible: false,
      composerText: "",
      composerCount: 0,
      heroVoiceStatusText: ""
    });
    wx.navigateTo({
      url: "/pages/detail-edit/detail-edit?mode=temp"
    });
  },

  goDraftList() {
    wx.navigateTo({
      url: "/pages/draft-list/draft-list"
    });
  },

  goTodoList() {
    navigateMainPage(this.data.currentTab, "/pages/todo-list/todo-list");
  },

  setFeedTab(event) {
    this.setData({
      activeFeedTab: event.currentTarget.dataset.value
    });
  },

  openRecord(event) {
    wx.navigateTo({
      url: `/pages/detail-edit/detail-edit?id=${event.currentTarget.dataset.id}`
    });
  },

  openWorkspaceSheet() {
    const app = getApp();
    const spaces = app.globalData.spaces || [];
    const activeSpace = app.globalData.activeSpace || null;
    const itemList = [];

    if (activeSpace) {
      itemList.push(this.data.ui.backToPersonal);
    }
    if (spaces.length) {
      itemList.push(this.data.ui.switchSpace);
    }
    itemList.push(this.data.ui.createSpace);
    itemList.push(this.data.ui.joinSpace);

    wx.showActionSheet({
      itemList,
      success: (res) => {
        const action = itemList[res.tapIndex];
        if (action === this.data.ui.backToPersonal) {
          this.switchPersonalLocally();
          wx.showToast({
            title: "\u5df2\u5207\u56de\u4e2a\u4eba\u7a7a\u95f4",
            icon: "success"
          });
          this.loadHome().catch((error) => {
            logError("home.loadAfterSwitchPersonal", error);
            showErrorToast(error, "首页加载失败");
          });
          switchSpace("")
            .then(() => {
              getApp().globalData.pendingSpaceSwitchUntil = 0;
            })
            .catch((error) => {
              getApp().globalData.pendingSpaceSwitchUntil = 0;
              logError("home.switchPersonal", error);
              showErrorToast(error, "切换失败");
            });
          return;
        }

        if (action === this.data.ui.switchSpace) {
          wx.navigateTo({
            url: "/pages/workspace/workspace?action=list"
          });
          return;
        }

        if (action === this.data.ui.createSpace) {
          wx.navigateTo({
            url: "/pages/workspace/workspace?action=create"
          });
          return;
        }

        wx.navigateTo({
          url: "/pages/workspace/workspace?action=join"
        });
      }
    });
  },

  switchPersonalLocally() {
    const app = getApp();
    clearCurrentSpace();
    invalidateRemoteCache();
    app.globalData.activeSpace = null;
    app.globalData.spaces = (app.globalData.spaces || []).map((item) => ({
      ...item,
      isActive: false
    }));
    app.globalData.skipNextBootstrapOnce = true;
    app.globalData.pendingSpaceSwitchUntil = Date.now() + 5000;
    this.setData({
      currentScopeLabel: this.data.ui.personalMode
    });
  },

  onUnload() {
    perf.markPageUnload(PAGE_PATH);
    this.clearComposerHintTimer();
    this.clearVoiceTimer();
    this.stopRippleLoop();
    clearTimeout(this.heroHoldTimer);
    if (this.data.voiceRecording && this.recorderManager) {
      this.skipNextVoiceRecognition = true;
      this.recorderManager.stop();
    }
  }
});
