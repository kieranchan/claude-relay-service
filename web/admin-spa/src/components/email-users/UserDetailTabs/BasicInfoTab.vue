<template>
  <div class="space-y-6">
    <!-- 用户信息卡片 -->
    <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
      <!-- 基本信息 -->
      <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
        <h4 class="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">基本信息</h4>
        <dl class="space-y-3">
          <div>
            <dt class="text-xs text-gray-500 dark:text-gray-400">邮箱</dt>
            <dd class="mt-1 flex items-center text-sm text-gray-900 dark:text-white">
              {{ user.email }}
              <span
                v-if="user.emailVerified"
                class="ml-2 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200"
              >
                <svg class="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    clip-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    fill-rule="evenodd"
                  />
                </svg>
                已验证
              </span>
            </dd>
          </div>
          <div v-if="user.displayName">
            <dt class="text-xs text-gray-500 dark:text-gray-400">显示名称</dt>
            <dd class="mt-1 text-sm text-gray-900 dark:text-white">{{ user.displayName }}</dd>
          </div>
          <div>
            <dt class="text-xs text-gray-500 dark:text-gray-400">注册来源</dt>
            <dd class="mt-1 text-sm text-gray-900 dark:text-white">
              {{ user.source === 'email' ? '邮箱注册' : user.source }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-gray-500 dark:text-gray-400">注册时间</dt>
            <dd class="mt-1 text-sm text-gray-900 dark:text-white">
              {{ formatDate(user.createdAt) }}
            </dd>
          </div>
        </dl>
      </div>

      <!-- 状态和角色 -->
      <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
        <h4 class="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">状态和权限</h4>
        <dl class="space-y-3">
          <div>
            <dt class="text-xs text-gray-500 dark:text-gray-400">账号状态</dt>
            <dd class="mt-1">
              <span :class="getStatusBadgeClass(user.status)">
                {{ getStatusText(user.status) }}
              </span>
            </dd>
          </div>
          <div>
            <dt class="text-xs text-gray-500 dark:text-gray-400">用户角色</dt>
            <dd class="mt-1">
              <span :class="getRoleBadgeClass(user.role)">
                {{ getRoleText(user.role) }}
              </span>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  user: {
    type: Object,
    required: true
  }
})

const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleString('zh-CN')
}

const getStatusText = (status) => {
  const statusMap = {
    active: '活跃',
    pending: '待验证',
    suspended: '已暂停',
    deleted: '已删除'
  }
  return statusMap[status] || status
}

const getStatusBadgeClass = (status) => {
  const baseClass = 'inline-flex rounded-full px-2 py-1 text-xs font-semibold'
  const statusClasses = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    suspended: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    deleted: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  }
  return `${baseClass} ${statusClasses[status] || statusClasses.pending}`
}

const getRoleText = (role) => {
  const roleMap = {
    user: '普通用户',
    admin: '管理员',
    super_admin: '超级管理员'
  }
  return roleMap[role] || role
}

const getRoleBadgeClass = (role) => {
  const baseClass = 'inline-flex rounded-full px-2 py-1 text-xs font-semibold'
  const roleClasses = {
    user: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    super_admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
  }
  return `${baseClass} ${roleClasses[role] || roleClasses.user}`
}
</script>
