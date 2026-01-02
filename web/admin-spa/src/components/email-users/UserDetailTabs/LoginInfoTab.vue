<template>
  <div class="space-y-6">
    <!-- 登录统计卡片 -->
    <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
      <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <svg
              class="h-8 w-8 text-blue-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
              />
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">登录次数</p>
            <p class="text-2xl font-semibold text-gray-900 dark:text-white">
              {{ user.loginCount || 0 }}
            </p>
          </div>
        </div>
      </div>

      <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <svg
              class="h-8 w-8 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
              />
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">最后登录</p>
            <p class="text-sm font-semibold text-gray-900 dark:text-white">
              {{ formatDate(user.lastLoginAt) }}
            </p>
          </div>
        </div>
      </div>

      <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <svg
              class="h-8 w-8 text-purple-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
              />
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">最后登录 IP</p>
            <p class="font-mono text-sm font-semibold text-gray-900 dark:text-white">
              {{ user.lastLoginIp || '未知' }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- IP 信息详情 -->
    <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
      <h4 class="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">IP 地址信息</h4>
      <dl class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <dt class="text-xs text-gray-500 dark:text-gray-400">注册 IP</dt>
          <dd class="mt-1 font-mono text-sm text-gray-900 dark:text-white">
            {{ user.registerIp || '未记录' }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-gray-500 dark:text-gray-400">最后登录 IP</dt>
          <dd class="mt-1 font-mono text-sm text-gray-900 dark:text-white">
            {{ user.lastLoginIp || '未记录' }}
          </dd>
        </div>
      </dl>
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
  if (!date) return '从未登录'
  return new Date(date).toLocaleString('zh-CN')
}
</script>
