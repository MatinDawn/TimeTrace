/**
 * 验证 utils/migrate-storage-keys.js 的迁移行为：
 * 1) liuhen-* 平移到 timetrace-*，旧 key 删除
 * 2) 同名 timetrace-* 已存在则保留新值
 * 3) 设置过 flag 后再次调用不再迁移（幂等）
 */

const path = require("path");

function makeMockWx(initial = {}) {
  const store = { ...initial };
  return {
    store,
    api: {
      getStorageSync(key) {
        return store[key] === undefined ? "" : store[key];
      },
      setStorageSync(key, value) {
        store[key] = value;
      },
      removeStorageSync(key) {
        delete store[key];
      },
      getStorageInfoSync() {
        return { keys: Object.keys(store) };
      },
    },
  };
}

function loadFreshMigrate() {
  const target = path.resolve(__dirname, "..", "utils", "migrate-storage-keys.js");
  delete require.cache[require.resolve(target)];
  return require(target).migrateLiuhenStorageKeys;
}

function assertEqual(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`[${ok ? "PASS" : "FAIL"}] ${label}`);
  if (!ok) {
    console.log("  expected:", JSON.stringify(expected));
    console.log("  actual  :", JSON.stringify(actual));
  }
  return ok;
}

function scenario1_basicMigrate() {
  const { store, api } = makeMockWx({
    "liuhen-records-v2:user:abc": [{ id: 1 }],
    "liuhen-current-space-v1": { spaceId: "S1" },
    "liuhen-empty-key": "",
    "ledger-records-v1": [{ legacy: true }], // 不属于迁移范围
    "unrelated-key": "x",
  });
  global.wx = api;
  const migrate = loadFreshMigrate();
  migrate();

  return [
    assertEqual(store["timetrace-records-v2:user:abc"], [{ id: 1 }], "记录 key 平移成功"),
    assertEqual(store["timetrace-current-space-v1"], { spaceId: "S1" }, "空间 key 平移成功"),
    assertEqual(store["liuhen-records-v2:user:abc"], undefined, "旧记录 key 已删除"),
    assertEqual(store["liuhen-current-space-v1"], undefined, "旧空间 key 已删除"),
    assertEqual(store["liuhen-empty-key"], undefined, "空值旧 key 也被清理"),
    assertEqual(store["ledger-records-v1"], [{ legacy: true }], "ledger-* 不在迁移范围"),
    assertEqual(store["unrelated-key"], "x", "其他无关 key 不变"),
    assertEqual(store["timetrace-storage-migrated-v1"], true, "迁移完成 flag 已写入"),
  ];
}

function scenario2_doNotOverwriteNew() {
  const { store, api } = makeMockWx({
    "liuhen-current-space-v1": { spaceId: "OLD" },
    "timetrace-current-space-v1": { spaceId: "NEW" },
  });
  global.wx = api;
  const migrate = loadFreshMigrate();
  migrate();

  return [
    assertEqual(store["timetrace-current-space-v1"], { spaceId: "NEW" }, "新 key 已存在时不覆盖"),
    assertEqual(store["liuhen-current-space-v1"], undefined, "旧 key 仍被清理"),
  ];
}

function scenario3_idempotent() {
  const { store, api } = makeMockWx({
    "timetrace-storage-migrated-v1": true,
    "liuhen-records-v2:user:x": [{ id: 99 }], // 模拟"理论上不应该出现"的脏数据
  });
  global.wx = api;
  const migrate = loadFreshMigrate();
  migrate();

  return [
    assertEqual(store["liuhen-records-v2:user:x"], [{ id: 99 }], "已有 flag 时跳过迁移"),
    assertEqual(store["timetrace-records-v2:user:x"], undefined, "已有 flag 时不再创建新 key"),
  ];
}

const results = [
  ...scenario1_basicMigrate(),
  ...scenario2_doNotOverwriteNew(),
  ...scenario3_idempotent(),
];

const allPassed = results.every(Boolean);
console.log("\n=========================");
console.log(allPassed ? "全部通过：迁移逻辑符合预期。" : "存在失败用例，请检查。");
process.exit(allPassed ? 0 : 1);
