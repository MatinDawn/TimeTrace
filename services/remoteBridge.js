const { BRIDGE_MAX_RETRIES, BRIDGE_RETRY_DELAY } = require("../utils/constants");
const { isRemoteEnabled } = require("../utils/runtime");

function buildBridgeError(code, detail) {
  const error = new Error(code || "bridge-failed");
  error.code = code || "bridge-failed";
  error.detail = detail || "";
  return error;
}

function buildDetailText(action, payload, extra) {
  return JSON.stringify(
    {
      action,
      payload,
      ...extra
    },
    null,
    2
  );
}

function isRetriableError(error) {
  const code = String(error && (error.code || error.message || error.errMsg) || "").toLowerCase();
  const detail = String(error && (error.detail || error.errMsg) || "").toLowerCase();
  return (
    code === "cloud-unavailable" ||
    code === "request-timeout" ||
    code.includes("timeout") ||
    code.includes("network") ||
    detail.includes("timeout") ||
    detail.includes("network") ||
    detail.includes("econnreset") ||
    detail.includes("request:fail")
  );
}

function callBridgeOnce(action, payload) {
  return new Promise((resolve, reject) => {
    if (!isRemoteEnabled()) {
      const error = buildBridgeError(
        "cloud-unavailable",
        buildDetailText(action, payload, {
          error: {
            message: "wx.cloud.callFunction unavailable"
          }
        })
      );
      console.error("[liuhenBridge] cloud unavailable", { action, payload });
      reject(error);
      return;
    }

    wx.cloud.callFunction({
      name: "liuhenBridge",
      data: {
        action,
        payload: payload || {}
      },
      success: (res) => {
        const result = res.result || {};
        if (result.code === 0) {
          resolve(result.data || {});
          return;
        }
        const detailText = buildDetailText(action, payload, { result });
        console.error("[liuhenBridge] business failed detail");
        console.error(detailText);
        reject(buildBridgeError(result.message || "bridge-failed", result.detail || detailText));
      },
      fail: (rawError) => {
        const detailText = buildDetailText(action, payload, { error: rawError });
        console.error("[liuhenBridge] callFunction failed detail");
        console.error(detailText);
        const rawMessage = String(rawError && (rawError.errMsg || rawError.message) || "").toLowerCase();
        const errorCode = rawMessage.includes("timeout") ? "request-timeout" : "bridge-failed";
        reject(buildBridgeError(errorCode, detailText));
      }
    });
  });
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function callBridge(action, payload, options) {
  const settings = options || {};
  const maxRetries = settings.maxRetries === undefined ? BRIDGE_MAX_RETRIES : Number(settings.maxRetries || 0);
  let attempt = 0;
  let lastError = null;

  while (attempt <= maxRetries) {
    try {
      return await callBridgeOnce(action, payload);
    } catch (error) {
      lastError = error;
      if (attempt >= maxRetries || !isRetriableError(error)) {
        throw error;
      }
      attempt += 1;
      await wait(BRIDGE_RETRY_DELAY * attempt);
    }
  }

  throw lastError || buildBridgeError("bridge-failed");
}

module.exports = {
  callBridge
};
