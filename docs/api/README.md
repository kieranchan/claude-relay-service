# API 文档目录

本目录存放所有功能模块的 API 文档，每个功能模块有独立的文件夹。

## 目录结构

```
docs/api/
├── README.md                    # 本文件
├── email-auth/                  # 邮箱认证模块
│   ├── openapi.yaml            # OpenAPI 3.0 规范
│   └── README.md               # 模块说明文档
├── [new-feature]/              # 新功能模块（示例）
│   ├── openapi.yaml
│   └── README.md
└── ...
```

## 功能模块列表

| 模块 | 文件夹 | 说明 |
|------|--------|------|
| 邮箱认证 | [email-auth/](./email-auth/) | 用户注册、登录、邮箱验证、密码重置、API Key 管理 |
| 套餐管理 | [plans/](./plans/) | 套餐 CRUD、上下架、统计、订阅管理 |
| 订阅管理 | [subscriptions/](./subscriptions/) | 用户订阅查询、升级、取消、续费 |
| 订单支付 | [orders/](./orders/) | 订单创建、列表、支付流程、回调处理 |

> 新增功能时，请更新此列表

---

## 查看 API 文档

**方式 1：在线查看**
- 访问 [Swagger Editor](https://editor.swagger.io/)
- 导入对应模块的 `openapi.yaml` 文件

**方式 2：本地运行 Swagger UI**
```bash
npx @redocly/cli preview-docs docs/api/email-auth/openapi.yaml
```

**方式 3：生成静态 HTML 文档**
```bash
npx @redocly/cli build-docs docs/api/email-auth/openapi.yaml -o docs/api/email-auth/index.html
```

---

## 生成 TypeScript 类型和 API 客户端

```bash
# 生成 TypeScript 类型
npx openapi-typescript docs/api/email-auth/openapi.yaml -o src/types/email-auth.d.ts

# 生成完整 API 客户端
npx @openapitools/openapi-generator-cli generate \
  -i docs/api/email-auth/openapi.yaml \
  -g typescript-axios \
  -o src/api-client/email-auth
```

---

## 新增功能模块规范

1. 在 `docs/api/` 下创建功能文件夹（如 `webhook/`）
2. 在文件夹内创建：
   - `openapi.yaml` - OpenAPI 3.0 规范文件
   - `README.md` - 模块说明（环境变量、使用示例等）
3. 更新本文件的「功能模块列表」
