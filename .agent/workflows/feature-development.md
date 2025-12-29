---
description: 新功能开发完整工作流（7阶段）
---
// turbo-all

# 新功能开发工作流

当用户请求添加新功能时，严格按照以下 7 个阶段执行。

## 阶段 1：准备与分析

1. 检查项目环境
```bash
node --version
npm --version
git status
```

2. 扫描现有代码结构，查找类似功能避免重复开发

3. 分析需求并与用户确认理解

## 阶段 2：数据库设计

1. 设计表结构（字段、类型、约束）
2. 检查与现有表的关系（外键）
3. 设计索引策略
4. 生成 Prisma migration 脚本

**关键检查项：**
- 外键是否有索引
- 时间字段使用 created_at/updated_at
- 是否需要软删除（deleted_at）
- 唯一索引是否添加

## 阶段 3：代码实现

1. 创建/更新 Model/Entity 层
2. 实现 Service/业务逻辑层
3. 实现 Controller/API 层
4. 添加输入验证
5. 实现错误处理和异常捕获
6. 添加日志记录点

**执行代码检查：**
```bash
npm run lint
npx prettier --write <file>
```

## 阶段 4：数据库迁移与测试

**重要：需要用户手动启动数据库**
```bash
# 用户执行：
cd F:\WorkSpace\WebStorm\claude-relay-service
prisma dev
```

等待用户确认数据库启动后：
```bash
npx prisma db push
npx prisma generate
```

## 阶段 5：功能测试

1. 启动开发服务器
```bash
npm run dev
```

2. 运行测试
```bash
npm test
npm run test:orders  # 订单相关测试
```

3. 测试用例设计：
   - 正常流程（happy path）
   - 边界条件（空值、极限值）
   - 错误场景（非法输入）

## 阶段 6：文档与安全

1. 在 `docs/api/<feature-name>/` 创建 OpenAPI 文档
2. 更新 `docs/api/README.md` 索引
3. 更新 CHANGELOG.md
4. 安全检查

**安全检查运行：**
```bash
npm audit
```

## 阶段 7：最终审查与交付

1. 完整检查流程
```bash
npm run lint && npm test && npm audit
```

2. 检查残留进程
```bash
tasklist | findstr node
```

3. 关闭所有后台进程
```bash
taskkill /F /PID <pid>
```

4. 生成 Git commit message
```
feat(<scope>): <description>

- 变更点1
- 变更点2

Closes #<issue>
```

---

**⚠️ 重要提醒：**
- 测试完成后必须关闭所有启动的程序
- 数据库需要用户手动启动 `prisma dev`
- 敏感信息永远不要硬编码
