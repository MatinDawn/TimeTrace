# GitHub 远程备份方案

## 目标

将当前本地 Git 仓库备份到 GitHub 私有仓库 `timetrace`，作为上线前的代码保险箱。后续每次修改都先写方案、确认后开发、完成后提交 Git，确保可以追踪和回滚。

## 仓库配置

- 仓库名：`timetrace`
- 可见性：Private
- 默认分支：`main`
- 本地远程名：`origin`
- 不额外创建 GitHub README，因为项目内已有 `README.md`
- 不使用 GitHub 默认 `.gitignore`，因为项目内已有专用 `.gitignore`

## 推送前安全检查

推送前必须确认以下内容不会上传：

- `project.private.config.json`
- `node_modules/`
- `cloudfunctions/**/node_modules/`
- 日志、压缩包、临时文件
- 明文密钥、`SecretKey`、`AKID`、`TENCENTCLOUD_SECRET` 等敏感字段

## 执行步骤

1. 确认本地 Git 工作区干净。
2. 提交本方案文件。
3. 创建 GitHub 私有仓库 `timetrace`。
4. 绑定远程仓库为 `origin`。
5. 将本地 `main` 分支推送到 `origin/main`。
6. 推送后检查本地与远程分支是否对齐。

## 后续协作流程

1. 每次修改前先写改动方案。
2. 用户确认后再开发。
3. 开发完成后运行必要检查。
4. 提交到本地 Git。
5. 用户确认后再推送到 GitHub。

## 回滚方式

常用命令：

```bash
git status
git diff
git log --oneline
git restore path/to/file
git checkout <commit> -- path/to/file
```

默认不使用 `git reset --hard`，除非明确确认要整体强制回退。

## 当前限制

当前本机未安装 GitHub CLI（`gh`），且当前可用的 GitHub 插件能力不包含“创建仓库”。因此远程仓库创建有两种路径：

- 路径 A：用户在 GitHub 网页手动创建私有仓库 `timetrace`，然后由 Codex 绑定远程并推送。
- 路径 B：用户安装并登录 GitHub CLI 后，由 Codex 使用 `gh repo create` 自动创建并推送。

## 实际执行记录

- 用户已在 GitHub 手动创建远程仓库：`git@github.com:MatinDawn/TimeTrace.git`
- 本次不再依赖 GitHub CLI 创建仓库，改为使用 Git 原生 SSH remote 推送。
- 推送前需要先提交当前工作区中已有的样式变量调整，确保远程备份包含当前真实版本。

## 首页原图素材恢复方案

### 背景

此前为解决微信小程序上传报错 `source size exceed max limit 2MB`，首页部分图片被替换为轻量 SVG。该处理降低了源码包体积，但改变了用户原本确认过的视觉质感。后续恢复应遵循“保留原画风、只优化体积、不擅自替换风格”的原则。

### 恢复原则

- 优先恢复用户提供的原图或原 SVG。
- 不再用重新绘制的极简图替代原图。
- PNG 类素材只做无损或低损压缩，不改变主体、构图和画风。
- 每个素材恢复前确认来源文件、目标文件、引用位置和预计包体影响。
- 恢复后必须重新检查小程序源码包体积，目标仍控制在 2MB 以内。
- 如果单个原图过大，优先压缩；压缩后仍过大，再讨论云存储或分包方案。

### 素材恢复清单

| 模块 | 当前项目文件 | 当前体积 | 恢复来源 | 来源体积 | 处理建议 | 引用位置 |
| --- | --- | ---: | --- | ---: | --- | --- |
| 进度小绿人 | `assets/home/progress-mascot-head.svg` | 1.4KB | `C:\Users\Admin\Downloads\e680fa8b-1a7a-423e-a34a-c3ff28eab4e5.png` | 约 1.0MB | 压缩为 PNG/WebP 后替换，目标 100KB-200KB | `pages/home/home.wxml:62` |
| 进度小绿人备份 | `assets/home/progress-mascot-head.svg` | 1.4KB | `C:\Users\Admin\Downloads\liuhen_asset_backup\progress-mascot-head.original.png` | 约 1.0MB | 与上方二选一，优先使用 Downloads 原图 | `pages/home/home.wxml:62` |
| 草稿箱图标 | `assets/home/draftbox-approved.svg` | 1.2KB | `C:\Users\Admin\Downloads\draftbox_approved_preview_style.svg` | 约 5.3KB | 直接替换，包体影响很小 | `pages/home/home.wxml:23` |
| 草稿箱大图 SVG | `assets/home/draftbox-approved.svg` | 1.2KB | `C:\Users\Admin\Downloads\b8a1a26b-c935-40e4-85f9-0cdc377a2e8b.svg` | 约 624KB | 不建议直接使用，除非确认这是唯一正确版本 | `pages/home/home.wxml:23` |
| 草稿箱 PNG | `assets/home/draftbox-approved.svg` | 1.2KB | `C:\Users\Admin\Downloads\b8a1a26b-c935-40e4-85f9-0cdc377a2e8b.png` | 约 1.6MB | 不建议直接使用，需强压缩或外链 | `pages/home/home.wxml:23` |
| 进度右侧小树 | `assets/home/progress-seedling-trace.svg` | 1.3KB | 待从 Downloads 中确认原始文件 | 待确认 | 先定位原图，再决定压缩或直接替换 | `pages/home/home.wxml:68` |
| 顶部纸条横幅 | `assets/home/quote-board.svg` | 5.1KB | 当前项目内已有版本 | 5.1KB | 暂不替换，除非用户指出不是原图 | `pages/home/home.wxml:20` |
| 任务概览插图 | `assets/home/task-overview-illustration.svg` | 2.5KB | 当前项目内已有版本 | 2.5KB | 暂不替换，除非用户指出不是原图 | `pages/home/home.wxml:189` |

### 实施步骤

1. 先恢复草稿箱图标，使用 `draftbox_approved_preview_style.svg`，因为体积小且更接近用户原图。
2. 再恢复进度小绿人，使用用户 PNG 原图，先压缩后替换，避免再次触发 2MB 限制。
3. 定位进度右侧小树原始素材；确认后按同样策略恢复。
4. 检查首页 WXML 引用，确保资源路径与文件类型一致。
5. 统计项目源码包体积，确认低于 2MB。
6. 运行静态检查：JSON 解析、页面文件完整性、资源引用存在性。
7. 单独提交 Git：`fix: restore original home artwork assets`。

### 待用户确认

- 是否先按“草稿箱图标 + 小绿人”两项恢复，右侧小树单独确认来源后再恢复。
- 小绿人压缩后的目标体积是否接受 100KB-200KB 区间。
- 如果恢复后仍接近 2MB，是否接受将非关键大图迁移到云存储。
