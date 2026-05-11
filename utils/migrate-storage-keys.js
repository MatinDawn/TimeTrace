/**
 * 一次性迁移：把旧 liuhen-* 前缀的本地存储 key 平移到 timetrace-* 前缀。
 *
 * 触发时机：utils/session.js 与 utils/store.js 顶部 require 时各调一次；
 * Node 模块缓存 + 内置幂等标记，保证整个小程序生命周期只执行一次。
 *
 * 安全策略：
 * - 只搬运 key 名以 "liuhen-" 开头的条目
 * - 同名新 key 已存在时跳过，避免覆盖更新数据
 * - 全程异常不抛出，迁移失败不影响业务
 */

const MIGRATION_FLAG_KEY = "timetrace-storage-migrated-v1";
const OLD_PREFIX = "liuhen-";
const NEW_PREFIX = "timetrace-";

let memoryFlag = false;

function migrateLiuhenStorageKeys() {
  if (memoryFlag) {
    return;
  }
  memoryFlag = true;

  if (typeof wx === "undefined" || !wx.getStorageInfoSync) {
    return;
  }

  try {
    if (wx.getStorageSync(MIGRATION_FLAG_KEY)) {
      return;
    }
  } catch (error) {
    // 读不出 flag 就当作未迁移，下面有重复写保护
  }

  let info;
  try {
    info = wx.getStorageInfoSync();
  } catch (error) {
    return;
  }
  const keys = (info && info.keys) || [];

  keys.forEach((key) => {
    if (typeof key !== "string" || !key.startsWith(OLD_PREFIX)) {
      return;
    }
    const nextKey = NEW_PREFIX + key.slice(OLD_PREFIX.length);
    try {
      const oldValue = wx.getStorageSync(key);
      if (oldValue === "" || oldValue === undefined || oldValue === null) {
        wx.removeStorageSync(key);
        return;
      }
      const existingNew = wx.getStorageSync(nextKey);
      if (existingNew === "" || existingNew === undefined || existingNew === null) {
        wx.setStorageSync(nextKey, oldValue);
      }
      wx.removeStorageSync(key);
    } catch (error) {
      // 忽略单条迁移失败，不影响其他 key
    }
  });

  try {
    wx.setStorageSync(MIGRATION_FLAG_KEY, true);
  } catch (error) {
    // 忽略；下次启动仍会重试一次，幂等
  }
}

module.exports = {
  migrateLiuhenStorageKeys
};
