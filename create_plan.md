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
