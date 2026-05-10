const MESSAGE_MAP = {
  "cloud-unavailable": "云能力暂时不可用，请稍后再试",
  "request-timeout": "请求超时，请稍后重试",
  "bridge-failed": "远程服务暂时不可用，请稍后再试",
  "unsupported-action": "云函数版本较旧，请重新部署 liuhenBridge",
  "space-name-required": "请先填写空间名称",
  "invite-code-required": "请输入邀请码",
  "space-not-found": "邀请码无效",
  "space-member-limit": "该空间已满 5 人",
  "space-access-denied": "你暂时没有该空间的访问权限",
  "record-not-found": "未找到对应留痕",
  "record-access-denied": "你暂时没有该留痕的访问权限",
  "ai-empty-response": "AI 返回为空，请稍后重试",
  "ai-parse-failed": "AI 暂时没整理好，你可以先手动补全",
  "asr-not-configured": "语音识别还没配置服务密钥",
  "asr-empty-result": "没有识别到有效语音，请再试一次",
  "asr-file-too-large": "这段语音太长了，请控制在 60 秒内",
  "FailedOperation.UserNotRegistered": "腾讯云语音识别服务还没开通",
  "FailedOperation.UserHasNoFreeAmount": "腾讯云语音识别免费额度已用尽",
  "FailedOperation.UserHasNoAmount": "腾讯云语音识别额度已用尽",
  "FailedOperation.ServiceIsolate": "腾讯云语音识别服务已停用，请检查账号状态",
  "InvalidParameterValue.ErrorInvalidVoiceFormat": "录音格式暂不被识别服务支持",
  "InvalidParameterValue.ErrorInvalidVoicedata": "录音数据无效，请再录一次",
  "InvalidParameterValue.ErrorVoicedataTooLong": "语音太长了，请控制在 60 秒内",
  "AuthFailure.SecretIdNotFound": "腾讯云 SecretId 不正确",
  "AuthFailure.SignatureFailure": "腾讯云 SecretKey 或签名配置不正确",
  "voice-file-required": "没有找到录音文件，请再试一次",
  "voice-too-short": "说得太短了，请再试一次",
  "record-permission-denied": "需要开启麦克风权限才能语音输入"
};

function getErrorCode(error) {
  if (!error) {
    return "";
  }
  return String(error.code || error.message || error.errMsg || "").trim();
}

function getErrorDetail(error) {
  if (!error) {
    return "";
  }
  return String(error.detail || error.errMsg || error.stack || error.message || "").trim();
}

function getErrorMessage(error, fallbackMessage) {
  const code = getErrorCode(error);
  if (MESSAGE_MAP[code]) {
    return MESSAGE_MAP[code];
  }

  const rawMessage = String(error && (error.message || error.errMsg) || "").trim();
  if (rawMessage && !/^[-a-z0-9:_]+$/i.test(rawMessage)) {
    return rawMessage;
  }

  return fallbackMessage || "操作失败，请稍后重试";
}

function logError(context, error, extra) {
  console.error(`[${context}]`, {
    error,
    detail: getErrorDetail(error),
    extra: extra || null
  });
}

function showErrorToast(error, fallbackMessage) {
  wx.showToast({
    title: getErrorMessage(error, fallbackMessage),
    icon: "none",
    duration: 2500
  });
}

function showErrorModal(title, error, fallbackMessage) {
  const content = getErrorDetail(error) || getErrorMessage(error, fallbackMessage);
  wx.showModal({
    title: title || "操作失败",
    content: content.length > 480 ? content.slice(0, 480) : content,
    showCancel: false
  });
}

module.exports = {
  getErrorCode,
  getErrorDetail,
  getErrorMessage,
  logError,
  showErrorToast,
  showErrorModal
};
