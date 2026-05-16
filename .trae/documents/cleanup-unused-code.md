# 计划：清理未被引用的代码与页面

## Summary
对项目做一次「死代码」体检：删除未在 [app.json](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/app.json) 注册、且全项目无任何 `require / url / pages` 引用的孤立页面、服务与工具文件。本次只动「无引用」的纯死代码，不做任何重构、不改动现有有引用代码的逻辑。

## Current State Analysis

### app.json 已注册页面（保留）
[app.json](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/app.json#L2-L14) 中注册的 11 个页面均保留：
home / todo-list / accounting / habit / my / workspace / draft-list / detail-edit / category-manage / reminder-manage / search-result。

### 自定义 tabbar 真实使用页面
[main-tabbar.js](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/components/main-tabbar/main-tabbar.js#L3-L9)：home / todo-list / accounting / habit / my。
[utils/navigation.js](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/utils/navigation.js#L3-L9) 的 MAIN_PAGES 同步。

### 孤立页面（**未注册于 app.json**，且**全项目 0 个 require / 0 个 url 引用**）
经 grep 校验：
| 目录 | 状况 |
|---|---|
| [pages/index](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/pages/index/index.js) | 仅一个 `wx.redirectTo("/pages/home/home")` 占位，无引用 |
| [pages/records](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/pages/records/records.js) | `redirectTo("/pages/accounting/accounting")` 占位，无引用 |
| [pages/report](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/pages/report/report.js) | `redirectTo("/pages/statistics/statistics")` 死链占位，无引用 |
| [pages/statistics](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/pages/statistics/statistics.js) | 历史 tab 页，已被 habit 替换，[scripts/test-habit-page.js](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/scripts/test-habit-page.js#L42-L48) **明确断言此目录必须被删除** |
| [pages/ledger](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/pages/ledger/ledger.js) | 唯一外部引用是它自己 require 的 [services/ledgerService.js](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/services/ledgerService.js)；无任何页面跳转到 `/pages/ledger/...` |
| [pages/quick-record](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/pages/quick-record/quick-record.js) | 全项目无 `/pages/quick-record/...` 跳转。代码里出现的 "quick-record" 是 [utils/parser.js](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/utils/parser.js#L101) 的 `source` 字符串字面量，与该页面无关 |
| [pages/quickentry](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/pages/quickentry/quickentry.js) | 全项目无 `/pages/quickentry/...` 跳转 |
| [pages/space-manage](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/pages/space-manage/space-manage.js) | 全项目无 `/pages/space-manage/...` 跳转，工作空间入口已统一走 [pages/workspace](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/pages/workspace/workspace.js) |

### 孤立服务
| 文件 | 状况 |
|---|---|
| [services/ledgerService.js](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/services/ledgerService.js) | 仅被 [pages/ledger/ledger.js](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/pages/ledger/ledger.js#L1) 引用；删 ledger 后即孤儿 |

### 孤立 utils
| 文件 | 状况 |
|---|---|
| [utils/categories.js](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/utils/categories.js) | 全项目 0 处 `require(...categories)`。分类常量真实来源是 [utils/constants.js](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/utils/constants.js) + [utils/store.js](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/utils/store.js) |

### 不动的部分（即使看似可疑也保留）
- [services/aiParser.js](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/services/aiParser.js) — [pages/detail-edit/detail-edit.js#L10](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/pages/detail-edit/detail-edit.js#L10) 仍在使用
- [services/dailySummary.js](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/services/dailySummary.js) — home 在用
- [utils/literary-quotes.js](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/utils/literary-quotes.js) — dailySummary 在用
- 4 个 [scripts/](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/scripts/) 测试 — 是项目自检脚本，保留

## Proposed Changes

### A. 删除孤立页面目录（共 8 个目录、约 32 个文件）
对以下每个目录的全部 `.js / .json / .wxml / .wxss` 一并删除：
1. `pages/index/`
2. `pages/records/`
3. `pages/report/`
4. `pages/statistics/`（同时满足 [test-habit-page.js#L48](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/scripts/test-habit-page.js#L48) 断言）
5. `pages/ledger/`
6. `pages/quick-record/`
7. `pages/quickentry/`
8. `pages/space-manage/`

为什么：未注册到 app.json + 全项目 0 引用 = 死代码。

### B. 删除孤立服务
- `services/ledgerService.js`

为什么：随 `pages/ledger` 删除后无任何 require 链入。

### C. 删除孤立 utils
- `utils/categories.js`

为什么：全项目 grep `require(...utils/categories)` 0 命中。

### D. 不需要修改任何现有引用
- [app.json](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/app.json) 未列出这些页面 → 无需改 pages 数组
- [main-tabbar.js](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/components/main-tabbar/main-tabbar.js)、[utils/navigation.js](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/utils/navigation.js) 未引用这些页面 → 无需改
- [services/appService.js](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/services/appService.js) 未引用 ledgerService → 无需改

### E. Git 提交
按 [project_memory](trae://memory/projects/-c-Users-Admin-Documents-Codex-2026-04-17-new-chat-wechat-ledger-miniapp/project_memory.md) 强制规则：
- 单次提交：`chore(cleanup): 删除未引用的孤立页面/服务/工具`
- 显式 `git add <files>`，不用 `git add -A`
- PowerShell heredoc 不可用 → 通过 `.git/COMMIT_EDITMSG_TMP` 写消息后 `git commit -F`
- `git push origin main`，不 force

## Assumptions & Decisions
- "未引用"判定标准：app.json 未注册 + 全项目 grep `require(...)`、`url:"/pages/<name>"`、`navigateTo`、`redirectTo`、`switchTab`、`reLaunch` 均无命中（从 redirectTo 死链页本身发出的跳转不算"被引用"）。
- 不"补全"任何被删页面的引用——它们本来就无引用。
- 不删 `scripts/` 测试，即使 `test-habit-page.js` 引用 `pages/statistics` 字面量——这正是它在校验"已删除"。

## Verification
1. `git status` 仅显示上述 ~34 个文件的删除变更
2. 全项目重新 grep 关键词，应均无残留：
   - `require\(['\"].*utils/categories['\"]\)`
   - `require\(['\"].*services/ledgerService['\"]\)`
   - `'/pages/(index|records|report|statistics|ledger|quick-record|quickentry|space-manage)/`
3. 用 `node scripts/test-habit-page.js` 跑一次（如果环境允许），确认 `old statistics page directory must be removed` 断言通过
4. `git push origin main` 成功
