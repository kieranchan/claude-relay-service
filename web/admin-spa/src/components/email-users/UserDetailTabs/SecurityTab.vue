<template>
  <div class="px-4 py-5 sm:p-0">
    <dl class="sm:divide-y sm:divide-gray-200 dark:sm:divide-gray-700">
      <!-- Risk Score -->
      <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">安全风险评分</dt>
        <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:col-span-2 sm:mt-0">
          <div class="flex items-center">
            <div class="mr-2 h-2.5 max-w-xs flex-1 rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                class="h-2.5 rounded-full"
                :class="getRiskBarColor(riskScore)"
                :style="{ width: `${Math.min(riskScore, 100)}%` }"
              ></div>
            </div>
            <span class="font-bold" :class="getRiskTextColor(riskScore)">
              {{ riskScore }}
            </span>
            <span class="ml-1 text-xs text-gray-500">/ 100</span>
          </div>
          <p class="mt-1 text-xs text-gray-500">分数越高代表风险越大</p>
        </dd>
      </div>

      <!-- Risk Factors -->
      <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">检测到的风险因素</dt>
        <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:col-span-2 sm:mt-0">
          <ul v-if="riskFactors.length > 0" class="list-disc space-y-1 pl-5">
            <li
              v-for="(factor, index) in riskFactors"
              :key="index"
              class="text-red-600 dark:text-red-400"
            >
              {{ factor.description }}
              <span class="text-xs text-gray-400">(+{{ factor.score }})</span>
            </li>
          </ul>
          <div v-else class="flex items-center text-green-600 dark:text-green-400">
            <svg class="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                d="M5 13l4 4L19 7"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
              ></path>
            </svg>
            未检测到明显风险
          </div>
        </dd>
      </div>

      <!-- Recent Failures -->
      <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">24小时内登录失败</dt>
        <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:col-span-2 sm:mt-0">
          <span :class="recentFailures > 0 ? 'font-bold text-orange-600 dark:text-orange-400' : ''">
            {{ recentFailures }}
          </span>
          次
        </dd>
      </div>

      <!-- Account Status -->
      <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">账户当前状态</dt>
        <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:col-span-2 sm:mt-0">
          {{ getStatusText(user.status) }}
        </dd>
      </div>
    </dl>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  user: {
    type: Object,
    required: true
  }
})

const riskScore = computed(() => props.user.security?.riskScore || 0)
const riskFactors = computed(() => props.user.security?.riskFactors || [])
const recentFailures = computed(() => props.user.security?.recentFailures || 0)

const getRiskBarColor = (score) => {
  if (score < 30) return 'bg-green-600'
  if (score < 70) return 'bg-yellow-500'
  return 'bg-red-600'
}

const getRiskTextColor = (score) => {
  if (score < 30) return 'text-green-600 dark:text-green-400'
  if (score < 70) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

const getStatusText = (status) => {
  const texts = { active: '活跃', pending: '待验证', suspended: '已暂停', deleted: '已删除' }
  return texts[status] || status
}
</script>
