<template>
  <div class="mb-4 rounded-lg bg-white p-4 shadow dark:bg-gray-800">
    <div class="flex items-center justify-between">
      <!-- 左侧：操作按钮 -->
      <div class="flex items-center gap-2">
        <button
          class="inline-flex items-center rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="selectedCount === 0"
          @click="showConfirmDialog('activate')"
        >
          <svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
            />
          </svg>
          激活
        </button>

        <button
          class="inline-flex items-center rounded-md bg-yellow-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="selectedCount === 0"
          @click="showConfirmDialog('suspend')"
        >
          <svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
            />
          </svg>
          暂停
        </button>

        <button
          class="inline-flex items-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="selectedCount === 0"
          @click="showConfirmDialog('delete')"
        >
          <svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
            />
          </svg>
          删除
        </button>

        <button
          class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="selectedCount === 0"
          @click="handleExport"
        >
          <svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
            />
          </svg>
          导出
        </button>

        <button
          class="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="selectedCount === 0"
          @click="$emit('notify', selectedUserIds)"
        >
          <svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
            />
          </svg>
          发通知
        </button>

        <button
          v-if="selectedCount > 0"
          class="inline-flex items-center rounded-md bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          @click="$emit('clear-selection')"
        >
          <svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              d="M6 18L18 6M6 6l12 12"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
            />
          </svg>
          取消选择
        </button>
      </div>

      <!-- 右侧：选中信息 -->
      <div class="flex items-center gap-3">
        <span v-if="selectedCount > 0" class="text-sm font-medium text-gray-700 dark:text-gray-300">
          已选择 <span class="text-blue-600 dark:text-blue-400">{{ selectedCount }}</span> 个用户
        </span>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400"> 未选择用户 </span>
      </div>
    </div>

    <!-- 确认对话框 -->
    <ConfirmDialog
      v-model:visible="dialogVisible"
      :confirm-text="dialogConfirmText"
      :message="dialogMessage"
      :title="dialogTitle"
      :type="dialogType"
      @confirm="handleConfirm"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import ConfirmDialog from './ConfirmDialog.vue'

const props = defineProps({
  selectedCount: {
    type: Number,
    required: true
  },
  selectedUserIds: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['bulk-action', 'export', 'clear-selection', 'notify'])

const dialogVisible = ref(false)
const dialogType = ref('info')
const dialogTitle = ref('')
const dialogMessage = ref('')
const dialogConfirmText = ref('确定')
const pendingAction = ref(null)

const actionConfig = {
  activate: {
    type: 'info',
    title: '批量激活用户',
    confirmText: '激活'
  },
  suspend: {
    type: 'warning',
    title: '批量暂停用户',
    confirmText: '暂停'
  },
  delete: {
    type: 'danger',
    title: '批量删除用户',
    confirmText: '删除'
  }
}

const showConfirmDialog = (action) => {
  const config = actionConfig[action]
  pendingAction.value = action

  dialogType.value = config.type
  dialogTitle.value = config.title
  dialogConfirmText.value = config.confirmText

  if (action === 'delete') {
    dialogMessage.value = `<div class="space-y-2">
      <p class="font-semibold text-red-600 dark:text-red-400">⚠️ 警告：此操作将标记用户为已删除状态！</p>
      <p>确定要删除 <strong>${props.selectedCount}</strong> 个用户吗？</p>
    </div>`
  } else {
    const actionNames = {
      activate: '激活',
      suspend: '暂停'
    }
    dialogMessage.value = `确定要${actionNames[action]} <strong>${props.selectedCount}</strong> 个用户吗？`
  }

  dialogVisible.value = true
}

const handleConfirm = () => {
  if (pendingAction.value) {
    emit('bulk-action', { action: pendingAction.value, userIds: props.selectedUserIds })
    pendingAction.value = null
  }
}

const handleExport = () => {
  emit('export', { userIds: props.selectedUserIds })
}
</script>
