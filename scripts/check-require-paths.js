/**
 * 静态校验：扫描项目所有 .js 文件，提取 require("./..." | "../...") 的相对路径，
 * 用 Node 的 Module._resolveFilename 验证目标存在；
 * 任意失败即退出 1。
 *
 * 仅供本地一次性诊断使用，不会被小程序加载。
 */
const fs = require("fs");
const path = require("path");
const Module = require("module");

const ROOT = path.resolve(__dirname, "..");
const SCAN_DIRS = ["app.js", "pages", "services", "utils", "components", "scripts"];

const targets = [];
function walk(dir) {
  const stat = fs.statSync(dir);
  if (stat.isFile()) {
    if (dir.endsWith(".js")) targets.push(dir);
    return;
  }
  for (const name of fs.readdirSync(dir)) {
    walk(path.join(dir, name));
  }
}
for (const entry of SCAN_DIRS) {
  const abs = path.join(ROOT, entry);
  if (fs.existsSync(abs)) walk(abs);
}

const REQUIRE_RE = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
const failures = [];

for (const file of targets) {
  const code = fs.readFileSync(file, "utf8");
  REQUIRE_RE.lastIndex = 0;
  let m;
  while ((m = REQUIRE_RE.exec(code)) !== null) {
    const spec = m[1];
    if (!spec.startsWith(".") && !spec.startsWith("/")) continue;
    try {
      Module.createRequire(file).resolve(spec);
    } catch (err) {
      failures.push({ file: path.relative(ROOT, file), spec, err: err.code || err.message });
    }
  }
}

if (failures.length === 0) {
  console.log(`[OK] 扫描 ${targets.length} 个 .js 文件，所有相对 require 路径均可解析`);
  process.exit(0);
}

console.log(`[FAIL] 共 ${failures.length} 处 require 路径解析失败：`);
for (const f of failures) console.log(`  - ${f.file} -> require("${f.spec}") : ${f.err}`);
process.exit(1);
