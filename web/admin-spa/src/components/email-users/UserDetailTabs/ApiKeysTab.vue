<template>
  <div class="space-y-6">
    <!-- API Keys 统计 -->
    <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
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
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
              />
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">总 API Keys</p>
            <p class="text-2xl font-semibold text-gray-900 dark:text-white">
              {{ stats?.totalApiKeys || 0 }}
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
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
              />
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">活跃 Keys</p>
            <p class="text-2xl font-semibold text-gray-900 dark:text-white">
              {{ stats?.activeApiKeys || 0 }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- API Keys 列表 -->
    <div v-if="apiKeys && apiKeys.length > 0" class="space-y-4">
      <div
        v-for="key in apiKeys"
        :key="key.id"
        class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center">
              <h5 class="text-sm font-semibold text-gray-900 dark:text-white">{{ key.name }}</h5>
              <span
                :class="[
                  'ml-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                  key.isActive
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                ]"
              >
                {{ key.isActive ? '活跃' : '已禁用' }}
              </span>
            </div>
            <p v-if="key.description" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ key.description }}
            </p>
          </div>
        </div>

        <!-- Key 详细信息 -->
        <div class="mt-4 grid grid-cols-2 gap-4 text-xs">
          <div>
            <span class="text-gray-500 dark:text-gray-400">创建时间：</span>
            <span class="text-gray-900 dark:text-white">{{ formatDate(key.createdAt) }}</span>
          </div>
          <div>
            <span class="text-gray-500 dark:text-gray-400">最后使用：</span>
            <span class="text-gray-900 dark:text-white">{{
              key.lastUsedAt ? formatDate(key.lastUsedAt) : '从未使用'
            }}</span>
          </div>
          <div v-if="key.expiresAt">
            <span class="text-gray-500 dark:text-gray-400">过期时间：</span>
            <span class="text-gray-900 dark:text-white">{{ formatDate(key.expiresAt) }}</span>
          </div>
        </div>

        <!-- 成本限制 -->
        <div class="mt-4 space-y-2">
          <div class="flex items-center justify-between text-xs">
            <span class="text-gray-500 dark:text-gray-400">成本限制</span>
          </div>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div v-if="key.dailyCostLimit">
              <span class="text-gray-500 dark:text-gray-400">日限额：</span>
              <span class="font-medium text-gray-900 dark:text-white"
                >${{ key.dailyCostLimit.toFixed(2) }}</span
              >
            </div>
            <div v-if="key.weeklyCostLimit">
              <span class="text-gray-500 dark:text-gray-400">周限额：</span>
              <span class="font-medium text-gray-900 dark:text-white"
                >${{ key.weeklyCostLimit.toFixed(2) }}</span
              >
            </div>
            <div v-if="key.monthlyCostLimit">
              <span class="text-gray-500 dark:text-gray-400">月限额：</span>
              <span class="font-medium text-gray-900 dark:text-white"
                >${{ key.monthlyCostLimit.toFixed(2) }}</span
              >
            </div>
            <div v-if="key.totalCostLimit">
              <span class="text-gray-500 dark:text-gray-400">总限额：</span>
              <span class="font-medium text-gray-900 dark:text-white"
                >${{ key.totalCostLimit.toFixed(2) }}</span
              >
            </div>
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
          d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
        />
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">没有 API Keys</h3>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">该用户还没有创建任何 API Key</p>
    </div>
  </div>
</template>

<script setup>
defineProps({
  apiKeys: {
    type: Array,
    default: () => []
  },
  stats: {
    type: Object,
    default: () => ({})
  }
})

defineEmits(['refresh'])

const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('zh-CN')
}
</script>
