# Google AI Studio 项目生成提示词

请复制以下全部内容发送给 Google AI Studio：

---

## 项目需求

请使用 **React 18 + TypeScript** 技术栈，创建一个 **AI API 中转服务平台** 的用户端前端项目。

### 技术栈要求
- React 18 + TypeScript + 函数式组件
- Vite 构建工具
- Ant Design 5.x 组件库
- Tailwind CSS 样式
- Zustand 状态管理
- React Router 6 路由
- Axios + React Query 数据请求
- Recharts 图表库

### 项目功能模块

#### 1. 营销首页 (`/`)
- Hero 首屏：主标题 + 副标题 + CTA 按钮（立即开始/查看套餐）
- 核心优势：6 个卖点卡片（高速稳定、安全可靠、多模型支持、按需付费、开发者友好、透明计费）
- 支持的模型：Claude Code / Gemini / OpenAI / Codex Logo 展示
- 定价区域：3 列套餐卡片（免费版/专业版/企业版）
- FAQ：常见问题折叠面板
- 页脚：产品/支持/关于链接

#### 2. 用户认证模块
- 登录页 `/login`：邮箱 + 密码登录
- 注册页 `/register`：邮箱注册
- 忘记密码 `/forgot-password`
- 邮箱验证 `/verify-email`

#### 3. 用户仪表盘 `/dashboard`
- 统计卡片：今日用量、本月费用、API 调用次数、套餐状态
- 用量趋势折线图
- 模型分布饼图
- 最近使用的 API Key 列表

#### 4. API Key 管理 `/api-keys`
- Key 列表表格：名称、状态、权限、限额、创建时间、操作
- 创建 Key 弹窗
- 复制 Key、启用/禁用、删除操作

#### 5. 套餐订阅 `/plans`
- 套餐卡片列表
- 当前套餐高亮
- 月付/年付切换
- 购买/升级按钮

#### 6. 订单管理 `/orders`
- 订单列表：订单号、套餐、金额、状态、时间
- 订单详情页
- 支付页面

#### 7. 用户设置 `/settings`
- 个人信息
- 安全设置（修改密码）
- 通知设置

### API 接口规范

后端 API 基础路径：`/api/v1`

#### 认证 API
```
POST /auth/register - 注册
POST /auth/login - 登录
POST /auth/logout - 登出
POST /auth/refresh - 刷新 Token
POST /auth/forgot-password - 忘记密码
POST /auth/reset-password - 重置密码
GET /auth/verify-email?token=xxx - 验证邮箱
```

#### 用户 API
```
GET /user/profile - 获取用户信息
PUT /user/profile - 更新用户信息
PUT /user/password - 修改密码
GET /user/api-keys - 获取 API Key 列表
POST /user/api-keys - 创建 API Key
DELETE /user/api-keys/:id - 删除 API Key
```

#### 套餐 API
```
GET /plans - 获取套餐列表
GET /plans/:id - 获取套餐详情
```

#### 订阅 API
```
GET /user/subscription - 获取当前订阅
POST /user/subscription - 订阅套餐
PUT /user/subscription - 升级/降级
DELETE /user/subscription - 取消订阅
```

#### 订单 API
```
GET /user/orders - 获取订单列表
GET /user/orders/:id - 获取订单详情
POST /orders - 创建订单
POST /orders/:id/pay - 发起支付
GET /orders/:id/status - 查询支付状态
```

#### 优惠券 API
```
GET /coupons/available - 获取可领取优惠券
GET /coupons/my - 获取我的优惠券
POST /coupons/receive/:id - 领取优惠券
POST /coupons/exchange - 兑换优惠码
POST /coupons/validate - 验证优惠券
```

### API 响应格式
```json
{
  "success": true,
  "message": "操作成功",
  "data": { ... }
}
```

### 错误响应格式
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述"
  }
}
```

### 设计风格

- 深色科技感主题
- 主色调：蓝紫渐变 `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`
- 背景色：#0f172a（深色背景）
- 卡片背景：#1e293b
- 支持暗黑/明亮模式切换
- 响应式设计（移动端/平板/桌面）
- 卡片悬停动画效果
- 滚动进场动画

### 项目目录结构

```
src/
├── api/                    # API 接口封装
├── components/             # 公共组件
│   ├── common/             # 通用组件
│   ├── charts/             # 图表组件
│   ├── landing/            # 首页组件
│   └── layout/             # 布局组件
├── hooks/                  # 自定义 Hooks
├── layouts/                # 页面布局
├── pages/                  # 页面组件
│   ├── auth/               # 认证页面
│   ├── dashboard/          # 仪表盘
│   ├── api-keys/           # Key 管理
│   ├── plans/              # 套餐
│   ├── orders/             # 订单
│   └── settings/           # 设置
├── router/                 # 路由配置
├── stores/                 # Zustand 状态
├── types/                  # TypeScript 类型
├── utils/                  # 工具函数
├── App.tsx
└── main.tsx
```

请根据以上规范，生成完整的前端项目代码。
