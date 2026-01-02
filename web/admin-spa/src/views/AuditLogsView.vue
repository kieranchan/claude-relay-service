<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto">
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">审计日志</h1>
        <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">查看系统管理员的关键操作记录</p>
      </div>
      <div class="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
        <button
          class="bg-primary-600 hover:bg-primary-500 inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm"
          @click="loadLogs"
        >
          <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
            />
          </svg>
          刷新
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="rounded-lg bg-white shadow dark:bg-gray-800">
      <div class="px-4 py-5 sm:p-6">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-end">
          <!-- Action Filter -->
          <div class="flex-1">
            <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >操作类型</label
            >
            <el-input
              v-model="filters.action"
              clearable
              placeholder="例如: USER_UPDATE"
              @input="debouncedLoad"
            >
              <template #prefix>
                <svg
                  class="h-4 w-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                  />
                </svg>
              </template>
            </el-input>
          </div>

          <!-- Date Range Picker -->
          <div class="flex-1">
            <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >日期范围</label
            >
            <el-date-picker
              v-model="dateRange"
              class="!w-full"
              end-placeholder="结束日期"
              format="YYYY-MM-DD"
              range-separator="至"
              start-placeholder="开始日期"
              type="daterange"
              value-format="YYYY-MM-DD"
              @change="handleDateRangeChange"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Logs Table -->
    <div class="overflow-hidden bg-white shadow dark:bg-gray-800 sm:rounded-lg">
      <div v-if="loading" class="py-12 text-center">
        <svg class="text-primary-600 mx-auto h-8 w-8 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          ></circle>
          <path
            class="opacity-75"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            fill="currentColor"
          ></path>
        </svg>
        <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">加载中...</p>
      </div>

      <table v-else class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th
              class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300"
            >
              时间
            </th>
            <th
              class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300"
            >
              操作人
            </th>
            <th
              class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300"
            >
              操作类型
            </th>
            <th
              class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300"
            >
              目标用户
            </th>
            <th
              class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300"
            >
              IP 地址
            </th>
            <th
              class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300"
            >
              详情
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
          <tr v-for="log in logs" :key="log.id" class="hover:bg-gray-50 dark:hover:bg-gray-700">
            <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
              {{ formatDate(log.createdAt) }}
            </td>
            <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-white">
              {{ log.admin?.email || 'System' }}
            </td>
            <td class="whitespace-nowrap px-6 py-4">
              <span
                class="inline-flex rounded-full bg-blue-100 px-2 text-xs font-semibold leading-5 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
              >
                {{ log.action }}
              </span>
            </td>
            <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
              {{ log.targetUser?.email || '-' }}
            </td>
            <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
              {{ log.ipAddress || '-' }}
            </td>
            <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
              <button
                class="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300"
                @click="showDetails(log)"
              >
                查看
              </button>
            </td>
          </tr>
          <tr v-if="logs.length === 0">
            <td class="px-6 py-12 text-center" colspan="6">
              <p class="text-gray-500 dark:text-gray-400">暂无审计日志</p>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div
        v-if="pagination.total > 0"
        class="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800 sm:px-6"
      >
        <div class="flex flex-1 justify-between sm:hidden">
          <button
            class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            :disabled="pagination.page <= 1"
            @click="prevPage"
          >
            上一页
          </button>
          <button
            class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            :disabled="pagination.page >= pagination.totalPages"
            @click="nextPage"
          >
            下一页
          </button>
        </div>
        <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
          <div>
            <p class="text-sm text-gray-700 dark:text-gray-300">
              共 <span class="font-medium">{{ pagination.total }}</span> 条记录， 第
              <span class="font-medium">{{ pagination.page }}</span> /
              <span class="font-medium">{{ pagination.totalPages }}</span> 页
            </p>
          </div>
          <div>
            <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm">
              <button
                class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                :disabled="pagination.page <= 1"
                @click="prevPage"
              >
                上一页
              </button>
              <button
                class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                :disabled="pagination.page >= pagination.totalPages"
                @click="nextPage"
              >
                下一页
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>

    <!-- Details Modal -->
    <div
      v-if="selectedLog"
      aria-labelledby="modal-title"
      aria-modal="true"
      class="relative z-10"
      role="dialog"
    >
      <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
      <div class="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div
          class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0"
        >
          <div
            class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all dark:bg-gray-800 sm:my-8 sm:w-full sm:max-w-lg sm:p-6"
          >
            <div>
              <div class="mt-3 text-center sm:mt-5">
                <h3
                  id="modal-title"
                  class="text-base font-semibold leading-6 text-gray-900 dark:text-white"
                >
                  日志详情
                </h3>
                <div class="mt-2 text-left">
                  <div class="text-sm text-gray-500 dark:text-gray-400">
                    <pre class="overflow-auto rounded bg-gray-100 p-4 text-xs dark:bg-gray-900">{{
                      JSON.stringify(selectedLog.details, null, 2)
                    }}</pre>
                  </div>
                </div>
              </div>
            </div>
            <div class="mt-5 sm:mt-6">
              <button
                class="bg-primary-600 hover:bg-primary-500 focus-visible:outline-primary-600 inline-flex w-full justify-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                type="button"
                @click="selectedLog = null"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import { apiClient } from '@/config/api'
import { showToast } from '@/utils/toast'

const logs = ref([])
const loading = ref(false)
const pagination = ref({ page: 1, limit: 20, total: 0, totalPages: 1 })
const selectedLog = ref(null)

const filters = reactive({
  action: '',
  startDate: '',
  endDate: ''
})

const dateRange = ref(null)

const handleDateRangeChange = (val) => {
  if (val) {
    filters.startDate = val[0]
    filters.endDate = val[1]
  } else {
    filters.startDate = ''
    filters.endDate = ''
  }
  loadLogs()
}

let searchTimeout = null
const debouncedLoad = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(loadLogs, 500)
}

const loadLogs = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.value.page,
      limit: pagination.value.limit,
      ...filters
    }
    const response = await apiClient.get('/admin/audit-logs', { params })
    logs.value = response.data.logs
    pagination.value = {
      page: response.data.page,
      limit: response.data.limit,
      total: response.data.total,
      totalPages: response.data.totalPages
    }
  } catch (error) {
    console.error(error)
    showToast('加载审计日志失败', 'error')
  } finally {
    loading.value = false
  }
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

const showDetails = (log) => {
  selectedLog.value = log
}

const prevPage = () => {
  if (pagination.value.page > 1) {
    pagination.value.page--
    loadLogs()
  }
}

const nextPage = () => {
  if (pagination.value.page < pagination.value.totalPages) {
    pagination.value.page++
    loadLogs()
  }
}

onMounted(() => {
  loadLogs()
})
</script>
