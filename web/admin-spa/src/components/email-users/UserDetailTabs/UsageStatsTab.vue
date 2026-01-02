<template>
  <div class="space-y-6">
    <!-- 成本统计卡片 -->
    <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div class="rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 p-6 text-white shadow-lg">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-blue-100">总成本</p>
            <p class="mt-2 text-3xl font-bold">${{ (stats?.totalCost || 0).toFixed(4) }}</p>
          </div>
          <svg
            class="h-12 w-12 text-blue-200"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
            />
          </svg>
        </div>
      </div>

      <div
        class="rounded-lg bg-gradient-to-br from-green-500 to-green-600 p-6 text-white shadow-lg"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-green-100">总请求数</p>
            <p class="mt-2 text-3xl font-bold">
              {{ (stats?.totalRequests || 0).toLocaleString() }}
            </p>
          </div>
          <svg
            class="h-12 w-12 text-green-200"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
            />
          </svg>
        </div>
      </div>
    </div>

    <!-- API Key 成本分布 -->
    <div
      v-if="stats?.apiKeyStats && stats.apiKeyStats.length > 0"
      class="rounded-lg bg-white p-6 shadow dark:bg-gray-800"
    >
      <h4 class="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">API Key 成本分布</h4>
      <div class="space-y-3">
        <div
          v-for="keyStat in stats.apiKeyStats"
          :key="keyStat.id"
          class="flex items-center justify-between"
        >
          <div class="flex items-center space-x-3">
            <div
              :class="['h-3 w-3 rounded-full', keyStat.isActive ? 'bg-green-500' : 'bg-gray-400']"
            ></div>
            <span class="text-sm text-gray-700 dark:text-gray-300">{{ keyStat.name }}</span>
          </div>
          <div class="flex items-center space-x-4">
            <span class="text-sm font-semibold text-gray-900 dark:text-white">
              ${{ (keyStat.cost || 0).toFixed(4) }}
            </span>
            <div class="h-2 w-32 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                class="h-full bg-blue-500"
                :style="{ width: `${getPercentage(keyStat.cost)}%` }"
              ></div>
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
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
        />
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">暂无使用数据</h3>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">该用户还没有产生任何使用记录</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  stats: {
    type: Object,
    default: () => ({})
  }
})

const maxCost = computed(() => {
  if (!props.stats?.apiKeyStats || props.stats.apiKeyStats.length === 0) return 0
  return Math.max(...props.stats.apiKeyStats.map((k) => k.cost || 0))
})

const getPercentage = (cost) => {
  if (maxCost.value === 0) return 0
  return ((cost || 0) / maxCost.value) * 100
}
</script>
