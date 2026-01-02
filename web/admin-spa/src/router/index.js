import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'
import { APP_CONFIG } from '@/config/app'

// 路由懒加载
const LoginView = () => import('@/views/LoginView.vue')
const UserLoginView = () => import('@/views/UserLoginView.vue')
const UserDashboardView = () => import('@/views/UserDashboardView.vue')
const UserManagementView = () => import('@/views/UserManagementView.vue')
const MainLayout = () => import('@/components/layout/MainLayout.vue')
const DashboardView = () => import('@/views/DashboardView.vue')
const ApiKeysView = () => import('@/views/ApiKeysView.vue')
const ApiKeyUsageRecordsView = () => import('@/views/ApiKeyUsageRecordsView.vue')
const AccountsView = () => import('@/views/AccountsView.vue')
const AccountUsageRecordsView = () => import('@/views/AccountUsageRecordsView.vue')
const TutorialView = () => import('@/views/TutorialView.vue')
const SettingsView = () => import('@/views/SettingsView.vue')
const ApiStatsView = () => import('@/views/ApiStatsView.vue')
const EmailUsersView = () => import('@/views/EmailUsersView.vue')
const AuditLogsView = () => import('@/views/AuditLogsView.vue')
const NotificationsView = () => import('@/views/NotificationsView.vue')

const routes = [
  {
    path: '/',
    redirect: () => {
      const currentPath = window.location.pathname
      const basePath = APP_CONFIG.basePath.replace(/\/$/, '')
      if (currentPath === basePath || currentPath === basePath + '/') {
        return '/api-stats'
      }
      return '/api-stats'
    }
  },
  {
    path: '/login',
    name: 'Login',
    component: LoginView,
    meta: { requiresAuth: false }
  },
  {
    path: '/admin-login',
    redirect: '/login'
  },
  {
    path: '/user-login',
    name: 'UserLogin',
    component: UserLoginView,
    meta: { requiresAuth: false, userAuth: true }
  },
  {
    path: '/user-dashboard',
    name: 'UserDashboard',
    component: UserDashboardView,
    meta: { requiresUserAuth: true }
  },
  {
    path: '/api-stats',
    name: 'ApiStats',
    component: ApiStatsView,
    meta: { requiresAuth: false }
  },
  {
    path: '/dashboard',
    component: MainLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: DashboardView
      }
    ]
  },
  {
    path: '/api-keys',
    component: MainLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'ApiKeys',
        component: ApiKeysView
      }
    ]
  },
  {
    path: '/api-keys/:keyId/usage-records',
    component: MainLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'ApiKeyUsageRecords',
        component: ApiKeyUsageRecordsView
      }
    ]
  },
  {
    path: '/accounts',
    component: MainLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Accounts',
        component: AccountsView
      }
    ]
  },
  {
    path: '/accounts/:accountId/usage-records',
    component: MainLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'AccountUsageRecords',
        component: AccountUsageRecordsView
      }
    ]
  },
  {
    path: '/tutorial',
    component: MainLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Tutorial',
        component: TutorialView
      }
    ]
  },
  {
    path: '/settings',
    component: MainLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Settings',
        component: SettingsView
      }
    ]
  },
  {
    path: '/user-management',
    component: MainLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'UserManagement',
        component: UserManagementView
      }
    ]
  },
  {
    path: '/email-users',
    component: MainLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'EmailUsers',
        component: EmailUsersView
      }
    ]
  },
  {
    path: '/audit-logs',
    component: MainLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'AuditLogs',
        component: AuditLogsView
      }
    ]
  },
  {
    path: '/notifications',
    component: MainLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Notifications',
        component: NotificationsView
      }
    ]
  },
  // 捕获所有未匹配的路由
  {
    path: '/:pathMatch(.*)*',
    redirect: '/api-stats'
  }
]

const router = createRouter({
  history: createWebHistory(APP_CONFIG.basePath),
  routes
})

// 路由守卫
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  const userStore = useUserStore()

  console.log('路由导航:', {
    to: to.path,
    from: from.path,
    fullPath: to.fullPath,
    requiresAuth: to.meta.requiresAuth,
    requiresUserAuth: to.meta.requiresUserAuth,
    isAuthenticated: authStore.isAuthenticated,
    isUserAuthenticated: userStore.isAuthenticated
  })

  // 防止重定向循环：如果已经在目标路径，直接放行
  if (to.path === from.path && to.fullPath === from.fullPath) {
    return next()
  }

  // 检查用户认证状态
  if (to.meta.requiresUserAuth) {
    if (!userStore.isAuthenticated) {
      try {
        const isUserLoggedIn = await userStore.checkAuth()
        if (!isUserLoggedIn) {
          return next('/user-login')
        }
      } catch (error) {
        if (error.message && error.message.includes('disabled')) {
          const { showToast } = await import('@/utils/toast')
          showToast(error.message, 'error')
        }
        return next('/user-login')
      }
    }
    return next()
  }

  // API Stats 页面不需要认证，直接放行
  if (to.path === '/api-stats' || to.path.startsWith('/api-stats')) {
    next()
  } else if (to.path === '/user-login') {
    if (userStore.isAuthenticated) {
      next('/user-dashboard')
    } else {
      next()
    }
  } else if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/login')
  } else if (to.path === '/login' && authStore.isAuthenticated) {
    next('/dashboard')
  } else {
    next()
  }
})

export default router
