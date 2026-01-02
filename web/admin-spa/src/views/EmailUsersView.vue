<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto">
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">邮箱用户管理</h1>
        <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
          管理通过邮箱注册的用户及其 API Keys
        </p>
      </div>
      <div class="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
        <button
          class="bg-primary-600 hover:bg-primary-500 inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm"
          @click="loadUsers"
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

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg
                class="h-6 w-6 text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                />
              </svg>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">
                  总用户数
                </dt>
                <dd class="text-lg font-medium text-gray-900 dark:text-white">
                  {{ stats.totalUsers }}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg
                class="h-6 w-6 text-green-500"
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
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">
                  活跃用户
                </dt>
                <dd class="text-lg font-medium text-gray-900 dark:text-white">
                  {{ stats.activeUsers }}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg
                class="h-6 w-6 text-purple-500"
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
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">
                  API Keys
                </dt>
                <dd class="text-lg font-medium text-gray-900 dark:text-white">
                  {{ stats.totalApiKeys }}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg
                class="h-6 w-6 text-yellow-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                />
              </svg>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">
                  待验证
                </dt>
                <dd class="text-lg font-medium text-gray-900 dark:text-white">
                  {{ stats.pendingUsers }}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Search and Filters -->
    <div class="rounded-lg bg-white shadow dark:bg-gray-800">
      <div class="px-4 py-5 sm:p-6">
        <div class="sm:flex sm:items-center sm:justify-between">
          <div class="min-w-0 flex-1">
            <div class="relative rounded-md shadow-sm">
              <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <svg
                  class="h-5 w-5 text-gray-400"
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
              </div>
              <input
                v-model="searchQuery"
                class="focus:ring-primary-600 block w-full rounded-md border-0 py-2 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset dark:bg-gray-700 dark:text-white dark:ring-gray-600 sm:text-sm sm:leading-6"
                placeholder="搜索邮箱..."
                type="search"
                @input="debouncedSearch"
              />
            </div>
          </div>
          <div class="mt-4 flex space-x-4 sm:ml-4 sm:mt-0">
            <select
              v-model="statusFilter"
              class="focus:ring-primary-600 rounded-md border-0 py-2 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 dark:bg-gray-700 dark:text-white dark:ring-gray-600 sm:text-sm"
              @change="loadUsers"
            >
              <option value="">全部状态</option>
              <option value="active">活跃</option>
              <option value="pending">待验证</option>
              <option value="suspended">已暂停</option>
            </select>
            <select
              v-model="roleFilter"
              class="focus:ring-primary-600 rounded-md border-0 py-2 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 dark:bg-gray-700 dark:text-white dark:ring-gray-600 sm:text-sm"
              @change="loadUsers"
            >
              <option value="">全部角色</option>
              <option value="user">普通用户</option>
              <option value="admin">管理员</option>
              <option value="super_admin">超级管理员</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- Bulk Actions Toolbar -->
    <BulkActionsToolbar
      :selected-count="selectedUserIds.length"
      :selected-user-ids="selectedUserIds"
      @bulk-action="handleBulkAction"
      @clear-selection="clearSelection"
      @export="handleExport"
      @notify="handleNotify"
    />

    <!-- Users Table -->
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
            <th class="px-6 py-3">
              <input
                :checked="isAllSelected"
                class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                type="checkbox"
                @change="toggleSelectAll"
              />
            </th>
            <th
              class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300"
            >
              邮箱
            </th>
            <th
              class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300"
            >
              状态
            </th>
            <th
              class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300"
            >
              角色
            </th>
            <th
              class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300"
            >
              API Keys
            </th>
            <th
              class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300"
            >
              登录次数
            </th>
            <th
              class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300"
            >
              最后登录
            </th>
            <th
              class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300"
            >
              注册时间
            </th>
            <th
              class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300"
            >
              操作
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
          <tr v-for="user in users" :key="user.id" class="hover:bg-gray-50 dark:hover:bg-gray-700">
            <td class="whitespace-nowrap px-6 py-4">
              <input
                :checked="selectedUserIds.includes(user.id)"
                class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                type="checkbox"
                @change="toggleUserSelection(user.id)"
              />
            </td>
            <td class="whitespace-nowrap px-6 py-4">
              <div class="flex items-center">
                <div
                  class="bg-primary-100 dark:bg-primary-900 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                >
                  <span class="text-primary-600 dark:text-primary-300 text-sm font-medium">{{
                    user.email.charAt(0).toUpperCase()
                  }}</span>
                </div>
                <div class="ml-4">
                  <div class="text-sm font-medium text-gray-900 dark:text-white">
                    {{ user.email }}
                  </div>
                  <div class="text-sm text-gray-500 dark:text-gray-400">
                    {{ user.emailVerified ? '已验证' : '未验证' }}
                  </div>
                </div>
              </div>
            </td>
            <td class="whitespace-nowrap px-6 py-4">
              <span
                class="inline-flex rounded-full px-2 text-xs font-semibold leading-5"
                :class="getStatusClass(user.status)"
              >
                {{ getStatusText(user.status) }}
              </span>
            </td>
            <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
              {{ getRoleText(user.role) }}
            </td>
            <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
              {{ user.apiKeyCount }} 个
            </td>
            <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
              {{ user.loginCount || 0 }}
            </td>
            <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
              {{ formatDate(user.lastLoginAt) || '未登录' }}
            </td>
            <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
              {{ formatDate(user.createdAt) }}
            </td>
            <td class="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
              <div class="flex items-center justify-end gap-2">
                <!-- 查看按钮 -->
                <button
                  class="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40"
                  @click="viewUserDetails(user)"
                >
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                    />
                    <path
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                    />
                  </svg>
                  查看
                </button>

                <!-- 暂停/激活按钮 -->
                <button
                  :class="[
                    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    user.status === 'active'
                      ? 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40'
                      : 'bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40'
                  ]"
                  @click="toggleUserStatus(user)"
                >
                  <svg
                    v-if="user.status === 'active'"
                    class="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                    />
                  </svg>
                  <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                    />
                    <path
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                    />
                  </svg>
                  {{ user.status === 'active' ? '暂停' : '激活' }}
                </button>
              </div>
            </td>
          </tr>

          <!-- Empty State -->
          <tr v-if="!loading && users.length === 0">
            <td class="px-6 py-12 text-center" colspan="9">
              <svg
                class="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                />
              </svg>
              <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">没有找到用户</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{
                  searchQuery || statusFilter || roleFilter
                    ? '试试调整筛选条件'
                    : '系统中还没有邮箱用户'
                }}
              </p>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div
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
              <span class="font-medium">{{ pagination.page }}</span> 页， 共
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
                <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    clip-rule="evenodd"
                    d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                    fill-rule="evenodd"
                  />
                </svg>
              </button>
              <button
                class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                :disabled="pagination.page >= pagination.totalPages"
                @click="nextPage"
              >
                <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    clip-rule="evenodd"
                    d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                    fill-rule="evenodd"
                  />
                </svg>
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>

    <!-- User Details Modal -->
    <UserDetailModal
      v-model:visible="showUserDetail"
      :user-id="selectedUserId"
      @refresh="loadUsers"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { apiClient } from '@/config/api'
import { showToast } from '@/utils/toast'
import BulkActionsToolbar from '@/components/email-users/BulkActionsToolbar.vue'
import UserDetailModal from '@/components/email-users/UserDetailModal.vue'

const router = useRouter()

const users = ref([])
const loading = ref(true)
const searchQuery = ref('')
const statusFilter = ref('')
const roleFilter = ref('')
const showUserDetail = ref(false)
const selectedUserId = ref(null)
const pagination = ref({ page: 1, pageSize: 20, total: 0, totalPages: 1 })
const stats = ref({ totalUsers: 0, activeUsers: 0, pendingUsers: 0, totalApiKeys: 0 })

// 批量选择
const selectedUserIds = ref([])
const isAllSelected = computed(() => {
  return users.value.length > 0 && selectedUserIds.value.length === users.value.length
})

let searchTimeout = null

const debouncedSearch = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => loadUsers(), 300)
}

const loadUsers = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      ...(searchQuery.value && { search: searchQuery.value }),
      ...(statusFilter.value && { status: statusFilter.value }),
      ...(roleFilter.value && { role: roleFilter.value })
    }

    const data = await apiClient.get('/admin/email-users', { params })
    users.value = data.data.items
    pagination.value = data.data.pagination
  } catch (error) {
    showToast('加载用户列表失败', 'error')
    console.error(error)
  } finally {
    loading.value = false
  }
}

const loadStats = async () => {
  try {
    const data = await apiClient.get('/admin/email-users/stats/overview')
    stats.value = data.data
  } catch (error) {
    console.error('Failed to load stats:', error)
  }
}

const viewUserDetails = (user) => {
  selectedUserId.value = user.id
  showUserDetail.value = true
}

const toggleUserStatus = async (user) => {
  const newStatus = user.status === 'active' ? 'suspended' : 'active'
  try {
    await apiClient.patch(`/admin/email-users/${user.id}/status`, { status: newStatus })
    showToast(`用户状态已更新为 ${newStatus === 'active' ? '活跃' : '暂停'}`, 'success')
    loadUsers()
  } catch (error) {
    showToast('更新用户状态失败', 'error')
  }
}

const prevPage = () => {
  if (pagination.value.page > 1) {
    pagination.value.page--
    loadUsers()
  }
}

const nextPage = () => {
  if (pagination.value.page < pagination.value.totalPages) {
    pagination.value.page++
    loadUsers()
  }
}

const getStatusClass = (status) => {
  const classes = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    suspended: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    deleted: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  }
  return classes[status] || classes.pending
}

const getStatusText = (status) => {
  const texts = { active: '活跃', pending: '待验证', suspended: '已暂停', deleted: '已删除' }
  return texts[status] || status
}

const getRoleText = (role) => {
  const texts = { user: '普通用户', admin: '管理员', super_admin: '超级管理员' }
  return texts[role] || role
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

// 批量选择方法
const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedUserIds.value = []
  } else {
    selectedUserIds.value = users.value.map((u) => u.id)
  }
}

const toggleUserSelection = (userId) => {
  const index = selectedUserIds.value.indexOf(userId)
  if (index > -1) {
    selectedUserIds.value.splice(index, 1)
  } else {
    selectedUserIds.value.push(userId)
  }
}

const clearSelection = () => {
  selectedUserIds.value = []
}

// 批量操作处理
const handleBulkAction = async ({ action, userIds }) => {
  try {
    await apiClient.post('/admin/email-users/bulk-action', {
      userIds,
      action
    })

    const actionNames = {
      activate: '激活',
      suspend: '暂停',
      delete: '删除'
    }

    showToast(`批量${actionNames[action]}成功`, 'success')
    clearSelection()
    loadUsers()
    loadStats()
  } catch (error) {
    showToast('批量操作失败', 'error')
    console.error(error)
  }
}

// 批量通知跳转
const handleNotify = (userIds) => {
  router.push({
    path: '/notifications',
    query: {
      userIds: JSON.stringify(userIds)
    }
  })
}

// 导出功能
const handleExport = async ({ userIds }) => {
  try {
    const response = await apiClient.post(
      '/admin/email-users/export',
      {
        filters: userIds
          ? { userIds }
          : { status: statusFilter.value, role: roleFilter.value, search: searchQuery.value },
        fields: [
          'email',
          'displayName',
          'status',
          'role',
          'emailVerified',
          'loginCount',
          'lastLoginIp',
          'createdAt',
          'lastLoginAt'
        ]
      },
      {
        responseType: 'blob'
      }
    )

    // 创建下载链接
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `email-users-${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)

    showToast('导出成功', 'success')
    if (userIds) clearSelection()
  } catch (error) {
    showToast('导出失败', 'error')
    console.error(error)
  }
}

onMounted(() => {
  loadUsers()
  loadStats()
})
</script>
