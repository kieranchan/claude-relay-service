# 前端项目架构规范 (React + TypeScript)

## 项目概述

这是一个 **AI API 中继服务管理平台** 的用户端前端项目。用户可以通过此平台管理 API Key、查看使用统计、购买套餐、管理订阅等。

## 技术栈要求

- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **UI 框架**: Ant Design 5.x
- **样式**: Tailwind CSS
- **状态管理**: Zustand
- **路由**: React Router 6
- **HTTP 客户端**: Axios + React Query
- **图表**: ECharts 或 Recharts

---

## 核心功能模块

### 1. 用户认证模块 (`/auth`)
| 页面 | 路由 | 功能 |
|------|------|------|
| 登录 | `/login` | 邮箱+密码登录 |
| 注册 | `/register` | 邮箱注册 + 验证码 |
| 忘记密码 | `/forgot-password` | 邮箱重置密码 |
| 邮箱验证 | `/verify-email` | 验证邮箱链接 |

### 2. 仪表盘模块 (`/dashboard`)
- 用量概览卡片（今日/本周/本月 Token）
- 费用统计卡片
- API 调用趋势图（折线图）
- 套餐状态卡片

### 3. API Key 管理模块 (`/api-keys`)
| 页面 | 路由 | 功能 |
|------|------|------|
| Key 列表 | `/api-keys` | 查看所有 API Key |
| 创建 Key | `/api-keys/create` | 创建新的 API Key |
| Key 详情 | `/api-keys/:id` | 查看/编辑 Key 详情 |

### 4. 套餐与订阅模块 (`/plans`)
| 页面 | 路由 | 功能 |
|------|------|------|
| 套餐列表 | `/plans` | 查看所有可用套餐 |
| 我的订阅 | `/subscription` | 当前订阅状态 |

### 5. 订单与支付模块 (`/orders`)
| 页面 | 路由 | 功能 |
|------|------|------|
| 订单列表 | `/orders` | 历史订单 |
| 订单详情 | `/orders/:id` | 订单详细信息 |
| 支付页面 | `/pay/:orderId` | 支付确认 |

### 6. 使用统计模块 (`/stats`)
- 用量统计图表
- 费用分析图表
- API 调用日志

### 7. 用户设置模块 (`/settings`)
- 个人信息、安全设置、通知设置

---

## 项目目录结构

```
src/
├── api/                    # API 接口封装
│   ├── auth.ts            # 认证相关
│   ├── apiKeys.ts         # API Key 管理
│   ├── plans.ts           # 套餐相关
│   ├── orders.ts          # 订单相关
│   └── index.ts           # Axios 实例
├── components/             # 公共组件
│   ├── common/            # 通用组件
│   ├── charts/            # 图表组件
│   └── layout/            # 布局组件
├── hooks/                 # 自定义 Hooks
│   ├── useAuth.ts         # 认证逻辑
│   ├── useApiKeys.ts      # Key 管理
│   └── useStats.ts        # 统计数据
├── layouts/               # 页面布局
│   ├── MainLayout.tsx     # 默认布局（带侧边栏）
│   └── AuthLayout.tsx     # 认证页面布局
├── pages/                 # 页面组件
│   ├── auth/              # 认证页面
│   ├── dashboard/         # 仪表盘
│   ├── api-keys/          # Key 管理
│   ├── plans/             # 套餐
│   ├── orders/            # 订单
│   └── settings/          # 设置
├── router/                # 路由配置
│   └── index.tsx
├── stores/                # Zustand 状态管理
│   ├── authStore.ts       # 认证状态
│   ├── userStore.ts       # 用户信息
│   └── themeStore.ts      # 主题设置
├── types/                 # TypeScript 类型定义
│   ├── api.ts
│   ├── user.ts
│   └── plan.ts
├── utils/                 # 工具函数
│   └── request.ts
├── App.tsx
└── main.tsx
```

---

## UI/UX 设计规范

### 颜色方案
```css
:root {
  --primary: #1677ff;       /* Ant Design 主色 */
  --success: #52c41a;       /* 成功 */
  --warning: #faad14;       /* 警告 */
  --error: #ff4d4f;         /* 错误 */
  --background: #f5f5f5;    /* 浅色背景 */
  --background-dark: #141414; /* 深色背景 */
}
```

### 设计原则
1. **简洁现代** - 使用卡片布局，圆角边框
2. **数据可视化** - 关键数据用大字体突出
3. **响应式设计** - 支持桌面和移动端
4. **暗黑模式** - 必须支持深色主题
5. **微动画** - 按钮悬停、页面切换添加过渡

---

## API 基础配置

```typescript
// api/index.ts
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('accessToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

---

## 状态管理 (Zustand)

```typescript
// stores/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      login: (token, user) => set({ token, user, isAuthenticated: true }),
      logout: () => set({ token: null, user: null, isAuthenticated: false }),
    }),
    { name: 'auth-storage' }
  )
);
```

---

## 路由配置

```typescript
// router/index.tsx
import { createBrowserRouter } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import AuthLayout from '@/layouts/AuthLayout';

const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'api-keys', element: <ApiKeyList /> },
      { path: 'plans', element: <PlanList /> },
      { path: 'orders', element: <OrderList /> },
      { path: 'settings', element: <Settings /> },
    ],
  },
  {
    path: '/auth',
    element: <AuthLayout />,
    children: [
      { path: 'login', element: <Login /> },
      { path: 'register', element: <Register /> },
    ],
  },
]);

export default router;
```

---

## 路由守卫

```typescript
// components/ProtectedRoute.tsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
```
