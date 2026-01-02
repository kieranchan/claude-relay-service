<template>
  <teleport to="body">
    <transition name="modal-fade">
      <div
        v-if="visible"
        aria-labelledby="modal-title"
        aria-modal="true"
        class="fixed inset-0 z-50 overflow-y-auto"
        role="dialog"
      >
        <div
          class="flex min-h-screen items-end justify-center px-4 pb-20 pt-4 text-center sm:block sm:p-0"
        >
          <!-- 背景遮罩 -->
          <div
            class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
            @click="handleClose"
          ></div>

          <!-- 模态框内容 -->
          <div
            class="inline-block w-full transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all dark:bg-gray-800 sm:my-8 sm:max-w-4xl sm:align-middle"
          >
            <!-- 头部 -->
            <div
              class="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-800"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-4">
                  <!-- 用户头像 -->
                  <div
                    class="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-xl font-bold text-white"
                  >
                    {{ userInitial }}
                  </div>
                  <div>
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                      {{ userDetails?.displayName || userDetails?.email || '用户详情' }}
                    </h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      {{ userDetails?.email }}
                    </p>
                  </div>
                </div>
                <button
                  class="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 dark:hover:bg-gray-700"
                  @click="handleClose"
                >
                  <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M6 18L18 6M6 6l12 12"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Tab 导航 -->
            <div class="border-b border-gray-200 dark:border-gray-700">
              <nav aria-label="Tabs" class="-mb-px flex space-x-8 px-6">
                <button
                  v-for="tab in tabs"
                  :key="tab.id"
                  :class="[
                    'whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition-colors',
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  ]"
                  @click="activeTab = tab.id"
                >
                  <span class="mr-2">{{ tab.icon }}</span>
                  {{ tab.label }}
                </button>
              </nav>
            </div>

            <!-- Tab 内容 -->
            <div class="max-h-[60vh] overflow-y-auto bg-gray-50 p-6 dark:bg-gray-900">
              <!-- 加载状态 -->
              <div v-if="loading">
                <UserDetailSkeleton />
              </div>

              <!-- 错误状态 -->
              <div v-else-if="error" class="rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
                <div class="flex">
                  <svg
                    class="h-5 w-5 text-red-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                    />
                  </svg>
                  <div class="ml-3">
                    <h3 class="text-sm font-medium text-red-800 dark:text-red-200">加载失败</h3>
                    <p class="mt-1 text-sm text-red-700 dark:text-red-300">{{ error }}</p>
                    <button
                      class="mt-2 text-sm font-medium text-red-600 hover:text-red-500 dark:text-red-400"
                      @click="loadUserDetails"
                    >
                      重试
                    </button>
                  </div>
                </div>
              </div>

              <!-- Tab 内容区域 -->
              <div v-else-if="userDetails">
                <!-- 基本信息 Tab -->
                <BasicInfoTab v-if="activeTab === 'basic'" :user="userDetails" />

                <!-- 登录信息 Tab -->
                <LoginInfoTab v-if="activeTab === 'login'" :user="userDetails" />

                <!-- API Keys Tab -->
                <ApiKeysTab
                  v-if="activeTab === 'apikeys'"
                  :api-keys="userDetails.apiKeys"
                  :stats="userDetails.stats"
                  @refresh="loadUserDetails"
                />

                <!-- 使用统计 Tab -->
                <UsageStatsTab v-if="activeTab === 'stats'" :stats="userDetails.stats" />

                <!-- 安全风险 Tab -->
                <SecurityTab v-if="activeTab === 'security'" :user="userDetails" />

                <!-- 活动日志 Tab -->
                <ActivityLogTab
                  v-if="activeTab === 'activity'"
                  :logs="userDetails.recentActivity"
                />
              </div>
            </div>

            <!-- 底部操作栏 -->
            <div class="bg-gray-50 px-6 py-4 dark:bg-gray-800 sm:flex sm:flex-row-reverse">
              <button
                class="inline-flex w-full justify-center rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-gray-600 sm:w-auto"
                @click="handleClose"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { apiClient } from '@/config/api'
import BasicInfoTab from './UserDetailTabs/BasicInfoTab.vue'
import LoginInfoTab from './UserDetailTabs/LoginInfoTab.vue'
import ApiKeysTab from './UserDetailTabs/ApiKeysTab.vue'
import UsageStatsTab from './UserDetailTabs/UsageStatsTab.vue'
import ActivityLogTab from './UserDetailTabs/ActivityLogTab.vue'
import SecurityTab from './UserDetailTabs/SecurityTab.vue'
import UserDetailSkeleton from './UserDetailSkeleton.vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  userId: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['update:visible', 'refresh'])

const tabs = [
  { id: 'basic', label: '基本信息', icon: '📋' },
  { id: 'login', label: '登录信息', icon: '🔐' },
  { id: 'apikeys', label: 'API Keys', icon: '🔑' },
  { id: 'stats', label: '使用统计', icon: '📊' },
  { id: 'security', label: '安全风险', icon: '🛡️' },
  { id: 'activity', label: '活动日志', icon: '📝' }
]

const activeTab = ref('basic')
const loading = ref(false)
const error = ref(null)
const userDetails = ref(null)

const userInitial = computed(() => {
  if (!userDetails.value) return '?'
  const email = userDetails.value.email || ''
  return email.charAt(0).toUpperCase()
})

const loadUserDetails = async () => {
  if (!props.userId) return

  loading.value = true
  error.value = null

  try {
    const response = await apiClient.get(`/admin/email-users/${props.userId}`)
    userDetails.value = response.data
  } catch (err) {
    error.value = err.response?.data?.error || '加载用户详情失败'
    console.error('Failed to load user details:', err)
  } finally {
    loading.value = false
  }
}

const handleClose = () => {
  emit('update:visible', false)
  // 重置状态
  setTimeout(() => {
    activeTab.value = 'basic'
    userDetails.value = null
    error.value = null
  }, 300)
}

// 监听 visible 和 userId 变化
watch(
  () => [props.visible, props.userId],
  ([newVisible, newUserId]) => {
    if (newVisible && newUserId) {
      loadUserDetails()
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-active .inline-block,
.modal-fade-leave-active .inline-block {
  transition: transform 0.3s ease;
}

.modal-fade-enter-from .inline-block {
  transform: scale(0.95);
}

.modal-fade-leave-to .inline-block {
  transform: scale(0.95);
}
</style>
