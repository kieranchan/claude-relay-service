---
description: 代码质量检查和格式化
---
// turbo-all

# 代码质量工作流

## 代码格式化

后端代码格式化：
```bash
npx prettier --write <file>
```

前端代码格式化（含 Tailwind 插件）：
```bash
cd web/admin-spa
npx prettier --write <file>
```

格式检查：
```bash
npx prettier --check <file>
```

## 代码风格检查

运行 ESLint：
```bash
npm run lint
```

## 测试

运行所有测试：
```bash
npm test
```

运行订单 API 测试：
```bash
npm run test:orders
```

## 构建检查

```bash
npm run build
```

## 完整检查流程

```bash
npm run lint && npm test && npm audit
```

## 前端开发规范

### 响应式设计
使用 Tailwind CSS 响应式前缀：`sm:`, `md:`, `lg:`, `xl:`

### 暗黑模式
所有组件必须同时兼容明亮和暗黑模式：
- 文本：`text-gray-700 dark:text-gray-200`
- 背景：`bg-white dark:bg-gray-800`
- 边框：`border-gray-200 dark:border-gray-700`

### 主题切换
使用 `stores/theme.js` 中的 `useThemeStore()`

## 进程清理

检查残留进程：
```bash
tasklist | findstr node
```

强制关闭进程：
```bash
taskkill /F /PID <pid>
```
