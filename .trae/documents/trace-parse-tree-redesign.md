# 留痕解析等待 + 即时长树 + 水墨小树重设计

## Summary
解决用户提出的三个体验问题：
1. **Q1 解析等待**：留痕（composer 提交）后由当前的 `wx.navigateTo → detail-edit` 立即看到空表单，改为在 detail-edit 页内强化"AI 正在解析"的视觉反馈，让用户清晰感知"等待解析→自动填充→编辑提交"的节奏（页面跳转保持，但解析中表单灰显锁定 + 旋转环加动效）。
2. **Q2 即时长树**：留痕保存后由 `wx.reLaunch('/pages/home/home')` 改为 `wx.navigateBack`，复用首页栈避免冷启，触发 `onShow → loadHome → consumePendingTreeGrow → triggerTreeGrowAnimation`，让任务列表立即刷新，同时小树立即生长。
3. **Q3 水墨小树**：当前 9 个 `<view>` 拼接的小树太丑（圆叶+线条干），重写为单文件水墨写意 SVG `assets/home/ink-tree.svg`，配合 `clip-path: inset()` 自下而上揭示动画，与首页 `task-overview-illustration.svg` 山水图保持画风统一。

---

## Current State Analysis

### Q1 当前实现（已读 [detail-edit.js](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/pages/detail-edit/detail-edit.js#L361-L411)）
- composer 提交后调用 `createRemoteDraftFromInput`，然后 `wx.navigateTo` 到 detail-edit。
- detail-edit `onLoad` 时若 `mode === remoteDraft` → `startAiParse(false)` 启动 hunyuan streamText，并 `startRecordWatch()` 监听云端结果。
- 解析中已有 `<view class="parse-card">`（见 [detail-edit.wxml#L10-L29](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/pages/detail-edit/detail-edit.wxml#L10-L29)），但仅一个静态 `.parse-dot` 圆点 + 文字提示，下方表单仍可编辑、保存按钮仍可点击 → 体感"AI 是不是没工作"。
- 用户反馈：希望强化"等待解析完才能编辑"的语义。

### Q2 当前实现（已读 [detail-edit.js#L536-L540](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/pages/detail-edit/detail-edit.js#L536-L540)）
```js
setTimeout(() => {
  wx.reLaunch({ url: "/pages/home/home" });
}, 120);
```
- `reLaunch` 销毁所有页面栈再重建首页，体感是"白屏闪一下→等 onShow loadHome"。
- 已有 [home.js consumePendingTreeGrow](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/pages/home/home.js#L316-L326) + [triggerTreeGrowAnimation](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/pages/home/home.js#L328-L337) 桥接逻辑，依赖 `app.globalData.pendingTreeGrow`，已经在 `save()` 第 529 行写入 `true`。
- 改为 `navigateBack` 后：home 实例仍在栈底，`onShow` 触发 `loadHome` → `applyHomeData` → `consumePendingTreeGrow(progressLevel, fromCache=false)` 触发动画，符合 `pendingTreeGrow` 设计意图。
- 注意：detail-edit 是否一定从 home 跳来？home `goQuickRecord → submitTextForAutofill → wx.navigateTo`（remoteDraft 分支）和 `openRecord/quickTrace` 都是从 home `navigateTo` 进入 detail-edit。但也有兜底情况（draft-list 跳来），所以需要 fallback。

### Q3 当前实现（已读 [home.wxml#L107-L121](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/pages/home/home.wxml#L107-L121) + [home.wxss#L497-L742](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/pages/home/home.wxss#L497-L742)）
- WXML 用 9 个 `<view>` 拼接：tree-soil（土壤椭圆）、tree-glow（光点）、tree-trunk（绿色渐变树干）、2 个 tree-branch（线条树枝）、6 个 tree-leaf（弧形叶片，单个 28×20rpx 圆叶）。
- WXSS 通过 `.stage-1/2/3` 控制 `.tree-trunk height + .leaf opacity/transform` 渐进显隐，4 个 keyframes 控制生长动画。
- 问题：圆叶 + 线条干 + 渐变绿+棕，与首页水墨山水图风格冲突，体感卡通且不精致。
- 容器：`.progress-tree-zone`（位置 `right:-6rpx; bottom:18rpx; width:118rpx; height:142rpx`）需保留，外层 `class` 名 `progress-tree stage-{{progressLevel}} {{treeGrowAnimating ? 'growing' : ''}} {{progressBeyond ? 'complete' : ''}}` 必须保留供 JS 联动。

---

## Proposed Changes

### A. Q1 解析等待视觉强化
**目标**：解析中（`isRemoteDraft && form.aiParseStatus === 'pending'`）整个表单灰显锁定，parse-card 内放置旋转环 + 3 个轨道 spark，让等待变得"有动效"。

**A1. 文件 [detail-edit.wxml](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/pages/detail-edit/detail-edit.wxml)**（已修改）
- 第 2 行 `.card` 加上动态 class：`{{isRemoteDraft && form.aiParseStatus === 'pending' ? 'is-parsing' : ''}}`
- 第 12-17 行 `.parse-head` 内已新增：
  ```xml
  <view wx:if="{{form.aiParseStatus === 'pending'}}" class="parse-orbit">
    <view class="parse-orbit-ring"></view>
    <view class="parse-spark spark-1"></view>
    <view class="parse-spark spark-2"></view>
    <view class="parse-spark spark-3"></view>
  </view>
  ```

**A2. 文件 [detail-edit.wxss](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/pages/detail-edit/detail-edit.wxss)**（待修改）
- 在文件末尾追加：
  - `.parse-orbit` 容器：`width:64rpx; height:64rpx; position:relative; flex-shrink:0`
  - `.parse-orbit-ring`：`width:64rpx; height:64rpx; border-radius:50%; border:3rpx solid rgba(45,107,75,0.18); border-top-color:#2d6b4b; animation: parseOrbit 1.4s linear infinite`
  - `.parse-spark`：`width:8rpx; height:8rpx; border-radius:50%; background:#7da06f; position:absolute; top:50%; left:50%`
  - `.parse-spark.spark-1/2/3` 三种 transform-origin + animation-delay 错开
  - `.is-parsing .form-block`：`opacity:0.5; pointer-events:none; filter:saturate(0.5) blur(0.4rpx)`
  - `.is-parsing .save-button`：`opacity:0.5; pointer-events:none`
  - `.is-parsing .two-col`：同 form-block
  - `@keyframes parseOrbit { from { transform: rotate(0) } to { transform: rotate(360deg) } }`

---

### B. Q2 navigateBack 即时长树
**目标**：保存后回退到首页（不冷启），触发 `onShow → loadHome` 自动刷新+长树。

**B1. 文件 [detail-edit.js](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/pages/detail-edit/detail-edit.js#L536-L540)**
- 第 536-540 行 `setTimeout` 块改为：
  ```js
  setTimeout(() => {
    const pages = getCurrentPages();
    const prev = pages[pages.length - 2];
    if (prev && prev.route === "pages/home/home") {
      wx.navigateBack({ delta: 1 });
    } else {
      wx.reLaunch({ url: "/pages/home/home" });
    }
  }, 120);
  ```
- 说明：`getApp().globalData.pendingTreeGrow = true` 已在第 529 行设置；home `onShow → loadHome → applyHomeData → consumePendingTreeGrow` 链路本就完整，无需改 home.js。

**B2. quickTrace 已是 `await this.loadHome()`，无需改动**（见 [home.js#L948](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/pages/home/home.js#L948)）

---

### C. Q3 水墨写意小树
**目标**：单文件 SVG 替代 9 个拼接 view，水墨写意风（深墨笔触+淡墨叶团），4 个生长阶段通过 `clip-path: inset(bottom)` 揭示。

**C1. 新建 [assets/home/ink-tree.svg](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/assets/home/ink-tree.svg)**
- viewBox `0 0 120 150`
- 元素分组（自下而上，便于 clip-path 揭示）：
  - `<ellipse>` 土坡墨晕：cx=60 cy=144 rx=36 ry=4，fill `#8b7355` opacity 0.3
  - `<path>` 树干主笔：M 60 142 C 58 110, 64 90, 60 60 — `stroke="#3a3a3a" stroke-width="3" fill="none" stroke-linecap="round"` 带轻微弯曲（仿毛笔起收）
  - `<path>` 左枝：M 60 95 Q 45 90 38 78 stroke-width 2
  - `<path>` 右枝：M 60 80 Q 75 76 82 64 stroke-width 2
  - `<path>` 上枝：M 60 65 Q 55 58 58 48 stroke-width 1.8
  - 5 个叶团（水墨晕染）：用 ellipse + ellipse 叠加，深墨 `#5a6e3f` + 淡墨 `#a8b78a` 半透明 0.65 营造泼墨感
    - 主冠（顶）cx=58 cy=42 rx=22 ry=14
    - 左下 cx=38 cy=72 rx=14 ry=9
    - 右下 cx=82 cy=58 rx=15 ry=10
    - 中部装饰 cx=70 cy=85 rx=10 ry=6
    - 顶尖 cx=60 cy=28 rx=8 ry=6
  - 3 个红梅点（仅 stage-3 显示）：fill `#c04848` r=1.8 散落于主冠

**C2. 文件 [home.wxml](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/pages/home/home.wxml#L107-L121)**
- 第 107-121 行 9 个 `<view>` 整体替换为：
  ```xml
  <view class="progress-tree-zone">
    <view class="progress-tree stage-{{progressLevel}} {{treeGrowAnimating ? 'growing' : ''}} {{progressBeyond ? 'complete' : ''}}">
      <view class="ink-tree-soil"></view>
      <image class="ink-tree-image" src="/assets/home/ink-tree.svg" mode="aspectFit"></image>
    </view>
  </view>
  ```
- 保留外层 `progress-tree-zone` + `progress-tree stage-x growing complete` 完整 class 链。

**C3. 文件 [home.wxss](file:///c:/Users/Admin/Documents/Codex/2026-04-17-new-chat/wechat-ledger-miniapp/pages/home/home.wxss#L515-L742)**
- 删除：`.tree-soil`、`.tree-glow`、`.tree-trunk`、`.tree-branch`、`.branch-left`、`.branch-right`、`.tree-leaf`、`.leaf-top-left/.leaf-top-right/.leaf-mid-left/.leaf-mid-right/.leaf-low-left/.leaf-low-right`、`.progress-tree.stage-1/2/3` 内所有旧选择器、`.progress-tree.growing .tree-trunk`、`.progress-tree.stage-2.growing .tree-branch` 等所有 9 view 相关规则、4 个 keyframes：`treeTrunkGrow`、`treeBranchGrow`、`treeLeafPop`（保留 `treeGentleSway` 复用到 `.complete`）。
- 新增：
  - `.ink-tree-image` 绝对定位 inset:0; width:100%; height:100%; transition: clip-path 0.9s cubic-bezier(0.2,0.8,0.2,1);
  - `.ink-tree-soil` 底部墨晕（保留小土坡视觉）
  - `.progress-tree.stage-0 .ink-tree-image { clip-path: inset(100% 0 0 0); }` 隐藏
  - `.progress-tree.stage-1 .ink-tree-image { clip-path: inset(60% 30% 0 30%); }` 嫩芽（露出底部 40% 中段）
  - `.progress-tree.stage-2 .ink-tree-image { clip-path: inset(30% 10% 0 10%); }` 中段（露出底部 70%）
  - `.progress-tree.stage-3 .ink-tree-image { clip-path: inset(0 0 0 0); }` 完整
  - `.progress-tree.growing .ink-tree-image { animation: inkTreeReveal 1s cubic-bezier(0.2,0.8,0.2,1) }`
  - `@keyframes inkTreeReveal` 让 clip-path 从更收缩态过渡到当前 stage 终态（用 transform: scale(0.85) → scale(1) + opacity 0.4 → 1 即可，避开 clip-path 动画 keyframe 兼容问题）
  - 保留 `.progress-tree.stage-3.growing, .progress-tree.complete { animation: treeGentleSway 1.7s ease-in-out 0.7s; }`

---

## Assumptions & Decisions

1. **Q1 不在 home 加蒙层**：用户已确认（前一轮 AskUserQuestion）跳转后在 detail-edit 页内等待，体验比"home 蒙层 + 后跳"更自然。
2. **Q2 fallback 保留 reLaunch**：detail-edit 也可能由 draft-list / report 等页 navigateTo 进入，fallback 兜底避免 navigateBack 回到非首页时不刷新。
3. **Q3 不用 SMIL 内嵌动画**：微信小程序 image 标签对 SVG 的 SMIL 动画支持不完整，改用 wxss `clip-path: inset()` + transform 实现"自下而上揭示"，更稳定。
4. **Q3 配色与山水图统一**：墨色 `#3a3a3a` 笔触 + `#5a6e3f / #a8b78a` 叶团淡彩，与 task-overview-illustration.svg 山水风格一致。
5. **`progressLevel` 取值**：home.js 中 `progressLevel = Math.min(DAILY_TARGET=3, ...)`，已是 0/1/2/3 四档，正好对应 stage-0/1/2/3。

---

## Verification Steps

1. **静态路径校验**：`node scripts/check-require-paths.js` 确保 require 链未破坏（本次只改 wxml/wxss/svg 与 1 处 js setTimeout 内部逻辑，预期通过）。
2. **现有自检脚本**：依次运行
   - `node test-habit-page.js`
   - `node test-home-space-behavior.js`
   - `node test-migrate-storage-keys.js`
   - `node test-submit-composer-debounce.js`
   全部通过。
3. **微信开发者工具手测**：
   - 点击留痕按钮 → 输入文字 → 提交 → 跳转 detail-edit → **观察解析中表单灰显 + 旋转环旋转 + spark 沿轨运动**（Q1 验证）
   - 等解析完 → 表单恢复亮色 → 点保存 → toast → **回退到 home 不闪屏 + 任务列表立即多一条 + 小树水墨自下而上揭示动画播放**（Q2+Q3 验证）
   - 进度从 stage-0 → stage-1 → stage-2 → stage-3 视觉层次清晰，Beyond 状态时复用 treeGentleSway 摆动。
4. **Git 工作流**：所有改动用一次 commit `feat(detail-edit, home): parsing-ux + navigate-back + ink-tree redesign` 推送 `origin main`（按用户硬性要求每次独立改动必须提交）。

---

## Out of Scope

- 不动 services/aiParser.js（hunyuan streamText 引擎稳定）
- 不动 services/app/record-draft-service.js（pending 状态机已 OK）
- 不动 cloud functions
- 不引入新的依赖
