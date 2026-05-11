/**
 * 验证首页留痕保存按钮的"入口级防抖锁"是否生效。
 *
 * 模拟方式：
 * - 重建一个最小 page 对象：data + setData（同步更新 this.data，与小程序运行时同语义）
 * - submitComposer / submitTextForAutofill 的核心结构 1:1 复刻自 pages/home/home.js
 * - 远端写入用 200ms 的 sleep 模拟，并对每次"真正进入云写入"+1 计数
 * - 触发 N 次"用户连点"：在同一 tick 同步发出 N 个 tap
 *
 * 期望：无论触发几次，realRemoteWriteCount 始终为 1；其余 tap 应被入口锁挡住。
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let realRemoteWriteCount = 0;
let blockedByGuardCount = 0;

const isRemoteEnabled = () => true;

// 模拟云端写入
async function createRemoteDraftFromInput(text) {
  realRemoteWriteCount += 1;
  await sleep(200);
  return { id: `mock-${realRemoteWriteCount}` };
}

const showToastCalls = [];
const wx = {
  showToast(opt) {
    showToastCalls.push(opt);
  },
  navigateTo() {},
};
global.wx = wx;

function makePage() {
  return {
    data: {
      composerText: "今天测试连点",
      composerSubmitting: false,
      voiceRecording: false,
      voiceRecognizing: false,
      ui: { toastInput: "请输入内容", toastVoiceBusy: "语音处理中" },
    },
    composerHintTimer: null,
    setData(patch) {
      Object.assign(this.data, patch);
    },
    clearComposerHintTimer() {
      if (this.composerHintTimer) {
        clearTimeout(this.composerHintTimer);
        this.composerHintTimer = null;
      }
    },

    // —— 与 pages/home/home.js submitComposer 1:1 复刻 ——
    async submitComposer() {
      const text = String(this.data.composerText || "").trim();
      if (this.data.voiceRecording || this.data.voiceRecognizing) {
        wx.showToast({ title: this.data.ui.toastVoiceBusy, icon: "none" });
        return;
      }
      if (!text) {
        wx.showToast({ title: this.data.ui.toastInput, icon: "none" });
        return;
      }
      // 入口锁
      if (this.data.composerSubmitting) {
        blockedByGuardCount += 1;
        return;
      }
      this.setData({ composerSubmitting: true });

      try {
        await this.submitTextForAutofill(text, "text");
      } finally {
        if (this.data.composerSubmitting) {
          this.setData({ composerSubmitting: false });
        }
      }
    },

    async submitTextForAutofill(text, source) {
      if (isRemoteEnabled()) {
        this.setData({ composerSubmitting: true, composerHintVisible: false });
        try {
          const draft = await createRemoteDraftFromInput(text, source || "text");
          this.setData({
            composerSubmitting: false,
            composerVisible: false,
            composerText: "",
            composerCount: 0,
          });
          wx.navigateTo({ url: `/pages/detail-edit/detail-edit?id=${draft.id}` });
        } catch (error) {
          this.setData({ composerSubmitting: false });
        }
      }
    },
  };
}

async function runScenario(name, tapCount) {
  realRemoteWriteCount = 0;
  blockedByGuardCount = 0;
  showToastCalls.length = 0;

  const page = makePage();

  // 模拟用户在同一 tick 内连点 N 次（Promise 立刻入队）
  const taps = [];
  for (let i = 0; i < tapCount; i += 1) {
    taps.push(page.submitComposer());
  }
  await Promise.all(taps);

  const passed = realRemoteWriteCount === 1 && blockedByGuardCount === tapCount - 1;
  const flag = passed ? "PASS" : "FAIL";
  console.log(
    `[${flag}] ${name}: tap=${tapCount} | 实际云写入=${realRemoteWriteCount} | 被入口锁拦截=${blockedByGuardCount}`
  );
  return passed;
}

// 验证空文本仍能 toast，不会触发提交
async function runEmptyTextScenario() {
  realRemoteWriteCount = 0;
  blockedByGuardCount = 0;
  showToastCalls.length = 0;

  const page = makePage();
  page.data.composerText = "   ";
  await page.submitComposer();
  await page.submitComposer();

  const passed = realRemoteWriteCount === 0 && showToastCalls.length === 2;
  console.log(
    `[${passed ? "PASS" : "FAIL"}] 空文本拦截: 云写入=${realRemoteWriteCount} | toast=${showToastCalls.length}`
  );
  return passed;
}

(async () => {
  const results = [];
  results.push(await runScenario("连点 2 次", 2));
  results.push(await runScenario("连点 5 次", 5));
  results.push(await runScenario("连点 20 次（暴力）", 20));
  results.push(await runEmptyTextScenario());

  const allPassed = results.every(Boolean);
  console.log("\n=========================");
  console.log(allPassed ? "全部通过：入口锁防抖生效。" : "存在失败用例，请检查。");
  process.exit(allPassed ? 0 : 1);
})();
