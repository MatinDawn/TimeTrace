// 轻量性能日志工具：用于诊断页面切换时机、是否被销毁/重建。
// 关闭时只需把 ENABLED 改为 false，所有调用零开销返回。

const ENABLED = true;
const PREFIX = "[PERF]";

let lastTs = 0;
let counter = 0;
const pageInstances = Object.create(null); // path -> 创建次数

function now() {
  return Date.now();
}

function delta() {
  const ts = now();
  const d = lastTs ? ts - lastTs : 0;
  lastTs = ts;
  return d;
}

function log(stage, path, extra) {
  if (!ENABLED) return;
  const seq = ++counter;
  const d = delta();
  const since = d ? `+${d}ms` : "  init";
  const tail = extra ? ` ${JSON.stringify(extra)}` : "";
  console.log(`${PREFIX} #${seq} ${since} [${stage}] ${path || ""}${tail}`);
}

// 标记一次"页面被构造"（onLoad）。同一 path 多次出现 => 页面栈未保留。
function markPageLoad(path) {
  pageInstances[path] = (pageInstances[path] || 0) + 1;
  log("onLoad", path, { instanceCount: pageInstances[path] });
}

function markPageShow(path) {
  log("onShow", path);
}

function markPageHide(path) {
  log("onHide", path);
}

function markPageUnload(path) {
  log("onUnload", path, { remaining: --pageInstances[path] });
}

function markNav(stage, fromPath, toPath, method) {
  log(stage, `${fromPath || "?"} -> ${toPath}`, method ? { method } : null);
}

module.exports = {
  log,
  markPageLoad,
  markPageShow,
  markPageHide,
  markPageUnload,
  markNav
};
