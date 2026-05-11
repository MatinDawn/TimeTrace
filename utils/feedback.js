// 统一反馈工具：触觉 + 听觉占位。
// 听觉预留接口，未接入实际音频资源；如需启用，将 AUDIO_ENABLED 置 true
// 并把资源放到 assets/sounds/{tap,success,error}.mp3 即可。

const AUDIO_ENABLED = false;

const AUDIO_PATHS = {
  tap: "/assets/sounds/tap.mp3",
  success: "/assets/sounds/success.mp3",
  error: "/assets/sounds/error.mp3"
};

const audioCache = Object.create(null);

function ensureAudio(kind) {
  if (!AUDIO_ENABLED) return null;
  if (audioCache[kind]) return audioCache[kind];
  if (!wx.createInnerAudioContext) return null;
  const ctx = wx.createInnerAudioContext();
  ctx.src = AUDIO_PATHS[kind];
  ctx.volume = 0.6;
  audioCache[kind] = ctx;
  return ctx;
}

function playSound(kind) {
  const ctx = ensureAudio(kind);
  if (!ctx) return;
  try {
    ctx.stop();
    ctx.play();
  } catch (e) {
    // 音频资源不存在时静默跳过
  }
}

function hapticTap() {
  if (wx.vibrateShort) {
    wx.vibrateShort({ type: "light", fail: () => {} });
  }
}

function hapticSuccess() {
  if (wx.vibrateShort) {
    wx.vibrateShort({ type: "medium", fail: () => {} });
  }
}

function hapticError() {
  if (wx.vibrateShort) {
    wx.vibrateShort({ type: "heavy", fail: () => {} });
  }
}

function tap() {
  hapticTap();
  playSound("tap");
}

function success() {
  hapticSuccess();
  playSound("success");
}

function error() {
  hapticError();
  playSound("error");
}

module.exports = {
  tap,
  success,
  error,
  hapticTap,
  hapticSuccess,
  hapticError,
  playSound
};
