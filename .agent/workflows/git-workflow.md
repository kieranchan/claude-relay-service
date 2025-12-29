---
description: Git 远程仓库管理和提交规范
---

# Git 工作流

## 远程仓库配置

| 远程名称 | 仓库地址 | 用途 |
|---------|---------|------|
| `origin` | `<你的仓库地址>` | 你的 Fork 仓库（推送用） |
| `upstream` | `https://github.com/Wei-Shaw/claude-relay-service.git` | 官方原仓库（用于拉取最新代码） |

**配置命令示例：**
```bash
# 1. 检查当前远程
git remote -v

# 2. 如果没有 upstream，则添加官方仓库：
git remote add upstream https://github.com/Wei-Shaw/claude-relay-service.git

# 3. 确保 origin 指向你自己的 Fork：
# git remote set-url origin <你的仓库SSH或HTTPS地址>
```

## 常用命令

// turbo
查看远程仓库配置：
```bash
git remote -v
```

// turbo
查看当前状态：
```bash
git status
```

推送到自己的仓库：
```bash
git push origin main
```

// turbo
拉取原仓库更新：
```bash
git fetch upstream
git merge upstream/main
```

## 合并冲突处理

1. **逐个手动解决（推荐）**
```bash
git fetch upstream
git merge upstream/main
# 手动编辑冲突文件后：
git add <冲突文件>
git commit
```

2. **优先保留本地修改**
```bash
git merge upstream/main -X ours
```

3. **优先使用原仓库版本**
```bash
git merge upstream/main -X theirs
```

## Commit Message 规范

格式：
```
<type>(<scope>): <subject>

<body>

<footer>
```

Type 类型：
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建/辅助工具

示例：
```
feat(user): 添加用户头像上传功能

- 新增 user_avatars 表
- 实现图片上传 API
- 添加文件大小和格式验证

Closes #123
```
