<template>
  <div class="space-y-6">
    <!-- 活动日志列表 -->
    <div v-if="logs && logs.length > 0" class="space-y-4">
      <div v-for="(log, index) in logs" :key="log.id" class="relative flex gap-x-4">
        <!-- 时间轴线 -->
        <div
          :class="[
            'absolute left-0 top-0 flex w-6 justify-center',
            index === logs.length - 1 ? 'h-6' : '-bottom-6'
          ]"
        >
          <div class="w-px bg-gray-200 dark:bg-gray-700"></div>
        </div>

        <!-- 图标 -->
        <div
          class="relative flex h-6 w-6 flex-none items-center justify-center bg-white dark:bg-gray-900"
        >
          <div :class="['h-1.5 w-1.5 rounded-full ring-1', getActivityColor(log.action)]"></div>
        </div>

        <!-- 内容 -->
        <div
          class="flex-auto rounded-lg bg-white p-3 shadow-sm ring-1 ring-inset ring-gray-200 dark:bg-gray-800 dark:ring-gray-700"
        >
          <div class="flex justify-between gap-x-4">
            <div class="flex-auto">
              <p class="text-sm font-semibold text-gray-900 dark:text-white">
                {{ getActionText(log.action) }}
              </p>

              <!-- 格式化的详情内容 -->
              <div v-if="log.details" class="mt-2">
                <component :is="renderDetails(log)" />
              </div>
            </div>
            <time class="flex-none text-xs text-gray-500 dark:text-gray-400">
              {{ formatDate(log.createdAt) }}
            </time>
          </div>

          <!-- IP 地址 -->
          <div
            v-if="log.ipAddress"
            class="mt-2 flex items-center gap-x-2 text-xs text-gray-500 dark:text-gray-400"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
              />
            </svg>
            <span class="font-mono">{{ log.ipAddress }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="rounded-lg bg-gray-50 p-12 text-center dark:bg-gray-900">
      <svg
        class="mx-auto h-12 w-12 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
        />
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">暂无活动记录</h3>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">该用户还没有任何活动日志</p>
    </div>
  </div>
</template>

<script setup>
import { h } from 'vue'

defineProps({
  logs: {
    type: Array,
    default: () => []
  }
})

const formatDate = (date) => {
  if (!date) return '-'
  const d = new Date(date)
  const now = new Date()
  const diff = now - d
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  if (days < 7) return `${days} 天前`
  return d.toLocaleDateString('zh-CN')
}

const getActionText = (action) => {
  const actionMap = {
    login: '用户登录',
    logout: '用户登出',
    create_api_key: '创建 API Key',
    delete_api_key: '删除 API Key',
    update_api_key: '更新 API Key',
    status_change: '状态变更',
    status_changed: '状态变更',
    role_change: '角色变更',
    role_changed: '角色变更',
    password_change: '修改密码',
    email_verify: '邮箱验证'
  }
  return actionMap[action] || action
}

const getActivityColor = (action) => {
  const colorMap = {
    login: 'bg-green-500 ring-green-500/20',
    logout: 'bg-gray-500 ring-gray-500/20',
    create_api_key: 'bg-blue-500 ring-blue-500/20',
    delete_api_key: 'bg-red-500 ring-red-500/20',
    update_api_key: 'bg-yellow-500 ring-yellow-500/20',
    status_change: 'bg-purple-500 ring-purple-500/20',
    status_changed: 'bg-purple-500 ring-purple-500/20',
    role_change: 'bg-orange-500 ring-orange-500/20',
    role_changed: 'bg-orange-500 ring-orange-500/20',
    password_change: 'bg-indigo-500 ring-indigo-500/20',
    email_verify: 'bg-teal-500 ring-teal-500/20'
  }
  return colorMap[action] || 'bg-gray-500 ring-gray-500/20'
}

// 解析 JSON 详情
const parseDetails = (details) => {
  if (!details) return null
  try {
    return typeof details === 'string' ? JSON.parse(details) : details
  } catch (e) {
    return { raw: details }
  }
}

// 获取状态文本
const getStatusText = (status) => {
  const statusMap = {
    active: '活跃',
    suspended: '已暂停',
    pending: '待验证',
    deleted: '已删除'
  }
  return statusMap[status] || status
}

// 获取角色文本
const getRoleText = (role) => {
  const roleMap = {
    user: '普通用户',
    admin: '管理员',
    super_admin: '超级管理员'
  }
  return roleMap[role] || role
}

// 渲染详情内容
const renderDetails = (log) => {
  const details = parseDetails(log.details)
  if (!details) return () => null

  const action = log.action

  // 状态变更
  if (action === 'status_change' || action === 'status_changed') {
    // 检查状态是否真的变化了
    const statusChanged = details.oldStatus !== details.newStatus

    if (!statusChanged) {
      // 状态没有变化，显示特殊消息
      return () =>
        h('div', { class: 'flex items-center gap-2 text-xs' }, [
          h('span', { class: 'text-gray-600 dark:text-gray-400' }, '由'),
          h('span', { class: 'text-gray-700 dark:text-gray-300' }, details.changedBy || '系统'),
          h('span', { class: 'text-gray-600 dark:text-gray-400' }, '尝试将状态设置为'),
          h(
            'span',
            {
              class:
                details.newStatus === 'active'
                  ? 'inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300'
                  : details.newStatus === 'suspended'
                    ? 'inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900 dark:text-red-300'
                    : 'inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            },
            getStatusText(details.newStatus)
          )
        ])
    }

    // 状态确实变化了
    return () =>
      h('div', { class: 'flex items-center gap-2 text-xs' }, [
        h('span', { class: 'text-gray-600 dark:text-gray-400' }, '由'),
        h('span', { class: 'text-gray-700 dark:text-gray-300' }, details.changedBy || '系统'),
        h('span', { class: 'text-gray-600 dark:text-gray-400' }, '将状态从'),
        h(
          'span',
          {
            class:
              'inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300'
          },
          getStatusText(details.oldStatus)
        ),
        h('span', { class: 'text-gray-600 dark:text-gray-400' }, '改为'),
        h(
          'span',
          {
            class:
              details.newStatus === 'active'
                ? 'inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300'
                : details.newStatus === 'suspended'
                  ? 'inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900 dark:text-red-300'
                  : 'inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300'
          },
          getStatusText(details.newStatus)
        )
      ])
  }

  // 角色变更
  if (action === 'role_change' || action === 'role_changed') {
    return () =>
      h('div', { class: 'flex items-center gap-2 text-xs' }, [
        h('span', { class: 'text-gray-600 dark:text-gray-400' }, '由'),
        h('span', { class: 'text-gray-700 dark:text-gray-300' }, details.changedBy || '系统'),
        h('span', { class: 'text-gray-600 dark:text-gray-400' }, '将角色从'),
        h(
          'span',
          {
            class:
              'inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300'
          },
          getRoleText(details.oldRole)
        ),
        h('span', { class: 'text-gray-600 dark:text-gray-400' }, '改为'),
        h(
          'span',
          {
            class:
              details.newRole === 'admin' || details.newRole === 'super_admin'
                ? 'inline-flex rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                : 'inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300'
          },
          getRoleText(details.newRole)
        )
      ])
  }

  // API Key 操作
  if (action === 'create_api_key' || action === 'delete_api_key' || action === 'update_api_key') {
    return () =>
      h('div', { class: 'text-xs' }, [
        details.keyName &&
          h('div', { class: 'flex items-center gap-2' }, [
            h('span', { class: 'text-gray-600 dark:text-gray-400' }, 'Key 名称:'),
            h(
              'span',
              { class: 'font-mono text-gray-900 dark:text-white' },
              details.keyName || details.name
            )
          ]),
        details.reason &&
          h('div', { class: 'mt-1 text-gray-600 dark:text-gray-400' }, `原因: ${details.reason}`)
      ])
  }

  // 登录/登出
  if (action === 'login' || action === 'logout') {
    return () =>
      h('div', { class: 'text-xs text-gray-600 dark:text-gray-400' }, [
        details.userAgent && h('div', {}, `浏览器: ${details.userAgent}`),
        details.location && h('div', { class: 'mt-1' }, `位置: ${details.location}`)
      ])
  }

  // 默认：显示所有字段
  return () =>
    h(
      'div',
      { class: 'space-y-1 text-xs' },
      Object.entries(details).map(([key, value]) =>
        h('div', { class: 'flex gap-2' }, [
          h('span', { class: 'font-medium text-gray-600 dark:text-gray-400' }, `${key}:`),
          h('span', { class: 'text-gray-900 dark:text-white' }, String(value))
        ])
      )
    )
}
</script>
