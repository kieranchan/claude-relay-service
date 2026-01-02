# 前端 UI 组件规范 (React + TypeScript)

## Prompt 指令

请使用以下技术栈创建一个 React 前端项目：

- **React 18** + TypeScript + 函数式组件
- **Vite** 构建工具
- **Ant Design 5.x** 组件库
- **Tailwind CSS** 样式
- **Zustand** 状态管理
- **React Router 6** 路由
- **Axios + React Query** 数据请求
- **Recharts** 图表库

---

## 核心页面组件清单

### 登录页面 (`LoginPage.tsx`)
- 居中卡片布局
- 邮箱输入框 + 密码输入框
- 登录按钮（加载状态）
- 注册链接 + 忘记密码链接
- 背景渐变或毛玻璃效果

### 仪表盘页面 (`DashboardPage.tsx`)
```
┌─────────────────────────────────────────────────┐
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐│
│  │今日用量  │ │本月费用  │ │API调用  │ │套餐状态  ││
│  │ 150K    │ │ ¥25.50  │ │ 1,234   │ │ Pro版   ││
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘│
│  ┌─────────────────────────────────────────────┐│
│  │          用量趋势折线图                      ││
│  └─────────────────────────────────────────────┘│
│  ┌──────────────────┐ ┌────────────────────────┐│
│  │ 模型分布饼图      │ │ 最近使用的 API Key     ││
│  └──────────────────┘ └────────────────────────┘│
└─────────────────────────────────────────────────┘
```

### API Key 列表页面 (`ApiKeyListPage.tsx`)
- 顶部：创建 Key 按钮
- 表格列：名称、状态、权限、限额、创建时间、操作
- 操作：复制 Key、启用/禁用、删除
- 空状态引导

### 套餐选择页面 (`PlansPage.tsx`)
- 三列套餐卡片布局（免费/专业/企业）
- 当前套餐高亮显示
- 功能对比列表
- 月付/年付切换
- 购买/升级按钮

---

## 通用组件

### StatsCard.tsx（统计卡片）
```tsx
import React from 'react';
import { Card } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';

interface StatsCardProps {
  title: string;
  value: string | number;
  trend?: number;
  icon?: React.ReactNode;
}

export const StatsCard: React.FC<StatsCardProps> = ({ title, value, trend, icon }) => {
  return (
    <Card className="rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-white border-0">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm opacity-80">{title}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
          {trend !== undefined && (
            <p className={`text-sm mt-2 ${trend > 0 ? 'text-green-300' : 'text-red-300'}`}>
              {trend > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              {Math.abs(trend)}% 较昨日
            </p>
          )}
        </div>
        {icon && <div className="text-4xl opacity-50">{icon}</div>}
      </div>
    </Card>
  );
};
```

### ApiKeyRow.tsx（Key 列表行）
```tsx
import React from 'react';
import { Table, Tag, Button, Dropdown, message } from 'antd';
import { MoreOutlined, CopyOutlined } from '@ant-design/icons';
import type { ApiKey } from '@/types/api';

interface ApiKeyRowProps {
  data: ApiKey[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export const ApiKeyTable: React.FC<ApiKeyRowProps> = ({ data, onToggle, onDelete }) => {
  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    message.success('已复制到剪贴板');
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: 'Key',
      dataIndex: 'keyPreview',
      key: 'keyPreview',
      render: (text: string) => (
        <span className="font-mono">
          {text}
          <Button type="link" icon={<CopyOutlined />} onClick={() => copyKey(text)} />
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'default'}>{active ? '启用' : '禁用'}</Tag>
      ),
    },
    { title: '权限', dataIndex: 'permissions', key: 'permissions' },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt' },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: ApiKey) => (
        <Dropdown
          menu={{
            items: [
              { key: 'toggle', label: record.isActive ? '禁用' : '启用' },
              { key: 'delete', label: '删除', danger: true },
            ],
            onClick: ({ key }) => {
              if (key === 'toggle') onToggle(record.id);
              if (key === 'delete') onDelete(record.id);
            },
          }}
        >
          <Button type="text" icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ];

  return <Table columns={columns} dataSource={data} rowKey="id" />;
};
```

### PlanCard.tsx（套餐卡片）
```tsx
import React from 'react';
import { Card, Button, Tag, List } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import type { Plan } from '@/types/plan';

interface PlanCardProps {
  plan: Plan;
  isCurrent: boolean;
  onSelect: (planId: string) => void;
}

export const PlanCard: React.FC<PlanCardProps> = ({ plan, isCurrent, onSelect }) => {
  return (
    <Card
      className={`relative rounded-2xl ${plan.isPopular ? 'border-2 border-blue-500 shadow-xl' : ''}`}
      hoverable
    >
      {plan.isPopular && (
        <Tag color="blue" className="absolute -top-3 left-1/2 -translate-x-1/2">
          最受欢迎
        </Tag>
      )}
      <h3 className="text-xl font-bold">{plan.name}</h3>
      <div className="text-4xl font-bold mt-4">
        ¥{plan.price}
        <span className="text-sm text-gray-500">/月</span>
      </div>
      <List
        className="mt-6"
        dataSource={plan.featureList}
        renderItem={(item) => (
          <List.Item>
            <CheckOutlined className="text-green-500 mr-2" />
            {item}
          </List.Item>
        )}
      />
      <Button
        type="primary"
        block
        className="mt-8"
        disabled={isCurrent}
        onClick={() => onSelect(plan.id)}
      >
        {isCurrent ? '当前套餐' : '选择套餐'}
      </Button>
    </Card>
  );
};
```

---

## 布局组件

### MainLayout.tsx
```tsx
import React from 'react';
import { Layout, Menu } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  KeyOutlined,
  ShoppingOutlined,
  BarChartOutlined,
  SettingOutlined,
} from '@ant-design/icons';

const { Sider, Content, Header } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/api-keys', icon: <KeyOutlined />, label: 'API Keys' },
  { key: '/plans', icon: <ShoppingOutlined />, label: '套餐' },
  { key: '/orders', icon: <BarChartOutlined />, label: '订单' },
  { key: '/settings', icon: <SettingOutlined />, label: '设置' },
];

export const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Layout className="min-h-screen">
      <Sider theme="light" className="shadow-md">
        <div className="h-16 flex items-center justify-center font-bold text-xl">
          AI Relay
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header className="bg-white shadow-sm px-6 flex items-center justify-end">
          {/* User avatar dropdown */}
        </Header>
        <Content className="p-6 bg-gray-50">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};
```

---

## 暗色主题支持

```tsx
// stores/themeStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeState {
  isDark: boolean;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      isDark: false,
      toggle: () => set((state) => {
        const newValue = !state.isDark;
        document.documentElement.classList.toggle('dark', newValue);
        return { isDark: newValue };
      }),
    }),
    { name: 'theme-storage' }
  )
);
```

---

## TypeScript 类型定义

```typescript
// types/api.ts
export interface ApiKey {
  id: string;
  name: string;
  keyPreview: string;
  isActive: boolean;
  permissions: string;
  dailyLimit: number;
  createdAt: string;
  lastUsedAt?: string;
}

// types/plan.ts
export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  billingCycle: 'monthly' | 'yearly';
  features: PlanFeatures;
  featureList: string[];
  isPopular: boolean;
}

// types/user.ts
export interface User {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  createdAt: string;
}
```

---

## 响应式断点

```css
/* Tailwind 默认断点 */
sm: 640px   /* 手机横屏 */
md: 768px   /* 平板 */
lg: 1024px  /* 笔记本 */
xl: 1280px  /* 桌面 */
2xl: 1536px /* 大屏 */
```
