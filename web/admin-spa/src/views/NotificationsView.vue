<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto">
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">通知中心</h1>
        <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">向用户发送系统通知或营销邮件</p>
      </div>
    </div>

    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <!-- Top Row: Send Target & Template Library side-by-side -->
      <div class="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <!-- Target Selection -->
        <div class="bg-white shadow dark:bg-gray-800 sm:rounded-lg">
          <div class="px-4 py-5 sm:p-6">
            <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
              发送目标
            </h3>
            <div class="mt-4 space-y-4">
              <div
                v-if="preSelectedCount > 0"
                class="mb-4 flex items-center rounded-lg bg-blue-50 p-4 text-sm text-blue-800 dark:bg-gray-800 dark:text-blue-400"
                role="alert"
              >
                <svg
                  aria-hidden="true"
                  class="mr-3 inline h-4 w-4 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3H8a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z"
                  />
                </svg>
                <span class="sr-only">Info</span>
                <div>
                  已从用户列表选择了
                  <span class="font-bold">{{ preSelectedCount }}</span> 位用户作为发送目标
                </div>
                <button
                  class="-mx-1.5 -my-1.5 ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 p-1.5 text-blue-500 hover:bg-blue-200 focus:ring-2 focus:ring-blue-400 dark:bg-gray-800 dark:text-blue-400 dark:hover:bg-gray-700"
                  @click="clearPreSelection"
                >
                  <span class="sr-only">Close</span>
                  <svg
                    aria-hidden="true"
                    class="h-3 w-3"
                    fill="none"
                    viewBox="0 0 14 14"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"
                      stroke="currentColor"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                    />
                  </svg>
                </button>
              </div>

              <div v-else>
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  选择目标群体
                </label>
                <select
                  v-model="targetFilter"
                  class="focus:border-primary-500 focus:ring-primary-500 mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
                >
                  <option value="all">所有用户</option>
                  <option value="active">活跃用户 (Status: Active)</option>
                  <option value="suspended">暂停用户 (Status: Suspended)</option>
                  <option value="pending">待验证用户 (Status: Pending)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- Template Library -->
        <div
          class="border border-gray-100 bg-gradient-to-br from-white to-gray-50 shadow-lg transition-all duration-300 hover:shadow-xl dark:border-gray-700 dark:from-gray-800 dark:to-gray-900 sm:rounded-xl"
        >
          <div class="px-6 py-6 sm:p-8">
            <div class="mb-5 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div
                  class="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-md"
                >
                  <i class="fas fa-layer-group text-lg text-white"></i>
                </div>
                <h3 class="text-lg font-bold text-gray-900 dark:text-white">模板库</h3>
              </div>
              <div class="flex items-center gap-2">
                <button
                  v-if="templates.length > 0"
                  class="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-all duration-200 hover:bg-gray-200 hover:shadow-md dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                  @click="showManageTemplatesModal = true"
                >
                  <i class="fas fa-cog"></i>
                  <span>管理</span>
                </button>
                <button
                  v-if="form.subject || form.content"
                  class="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-all duration-200 hover:scale-105 hover:shadow-lg"
                  @click="showSaveTemplateModal = true"
                >
                  <i class="fas fa-save"></i>
                  <span>保存为模板</span>
                </button>
              </div>
            </div>
            <div class="relative">
              <el-select
                v-model="selectedTemplateId"
                class="w-full"
                clearable
                filterable
                placeholder="🔍 搜索或选择模板快速填充内容..."
                size="large"
                @change="applyTemplate"
              >
                <el-option v-for="tpl in templates" :key="tpl.id" :label="tpl.name" :value="tpl.id">
                  <div class="flex items-center justify-between py-1">
                    <div class="flex items-center gap-2">
                      <i class="fas fa-file-alt text-blue-500"></i>
                      <span class="font-medium">{{ tpl.name }}</span>
                    </div>
                    <el-tag effect="light" size="small" :type="getCategoryTagType(tpl.category)">
                      {{ getCategoryLabel(tpl.category) }}
                    </el-tag>
                  </div>
                </el-option>
              </el-select>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Row: Content Editor & Preview side-by-side -->
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <!-- Content Editor -->
        <div class="bg-white shadow dark:bg-gray-800 sm:rounded-lg">
          <div class="px-4 py-5 sm:p-6">
            <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
              邮件内容
            </h3>
            <div class="mt-4 space-y-4">
              <div>
                <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  <i class="fas fa-heading mr-1 text-blue-500"></i>主题
                </label>
                <input
                  v-model="form.subject"
                  class="block w-full rounded-lg border-gray-300 shadow-sm transition-all focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  placeholder="请输入邮件主题"
                  type="text"
                  @input="updatePreview"
                />
              </div>

              <div>
                <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  <i class="fas fa-file-alt mr-1 text-green-500"></i>正文 (HTML)
                </label>
                <textarea
                  v-model="form.content"
                  class="block w-full rounded-lg border-gray-300 font-mono shadow-sm transition-all focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
                  placeholder="请输入邮件内容..."
                  rows="14"
                  @input="updatePreview"
                ></textarea>
                <div class="mt-3 flex flex-wrap gap-2">
                  <button
                    class="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-all hover:from-blue-100 hover:to-purple-100 dark:from-blue-900 dark:to-purple-900 dark:text-blue-300"
                    @click="insertVariable('{{displayName}}')"
                  >
                    <i class="fas fa-user text-xs"></i>
                    <span>用户名</span>
                  </button>
                  <button
                    class="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-all hover:from-blue-100 hover:to-purple-100 dark:from-blue-900 dark:to-purple-900 dark:text-blue-300"
                    @click="insertVariable('{{email}}')"
                  >
                    <i class="fas fa-envelope text-xs"></i>
                    <span>邮箱</span>
                  </button>
                </div>
              </div>
            </div>
            <div class="mt-6 flex items-center justify-end">
              <button
                class="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-2.5 text-sm font-medium text-white shadow-md transition-all duration-200 hover:scale-105 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="loading || !canSend"
                @click="confirmSend"
              >
                <svg
                  v-if="loading"
                  class="h-4 w-4 animate-spin text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
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
                <i v-else class="fas fa-paper-plane"></i>
                <span>发送通知</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Real-time Preview -->
        <div
          class="border border-gray-100 bg-gradient-to-br from-white to-gray-50 shadow-lg dark:border-gray-700 dark:from-gray-800 dark:to-gray-900 sm:rounded-xl"
        >
          <div class="px-6 py-6">
            <div class="mb-5 flex items-center gap-3">
              <div
                class="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 shadow-md"
              >
                <i class="fas fa-eye text-lg text-white"></i>
              </div>
              <div class="flex-1">
                <h3 class="text-lg font-bold text-gray-900 dark:text-white">实时预览</h3>
                <p class="text-xs text-gray-500">使用测试数据渲染变量</p>
              </div>
            </div>
            <div class="space-y-4">
              <div
                v-if="form.subject"
                class="rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 p-4 dark:from-blue-900/20 dark:to-purple-900/20"
              >
                <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                  <i class="fas fa-heading mr-1 text-xs"></i>主题
                </label>
                <p class="text-base font-semibold text-gray-900 dark:text-white">
                  {{ form.subject }}
                </p>
              </div>
              <div
                class="min-h-[400px] rounded-lg border-2 border-dashed border-gray-200 p-4 dark:border-gray-700"
              >
                <label class="mb-3 block text-xs font-medium text-gray-500 dark:text-gray-400">
                  <i class="fas fa-file-alt mr-1 text-xs"></i>正文内容
                </label>
                <div
                  class="prose prose-sm dark:prose-invert max-w-none"
                  v-html="previewContent"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Save as Template Modal -->
  <el-dialog v-model="showSaveTemplateModal" title="保存为模板" width="400px">
    <div class="space-y-4">
      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          模板名称
        </label>
        <el-input v-model="newTemplateName" placeholder="例如: 欢迎邮件" />
      </div>
      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">分类</label>
        <el-select v-model="newTemplateCategory" class="w-full">
          <el-option label="通用" value="general" />
          <el-option label="营销" value="marketing" />
          <el-option label="系统通知" value="system" />
          <el-option label="警告提醒" value="alert" />
        </el-select>
      </div>
    </div>
    <template #footer>
      <el-button @click="showSaveTemplateModal = false">取消</el-button>
      <el-button type="primary" @click="saveAsTemplate">保存模板</el-button>
    </template>
  </el-dialog>

  <!-- Manage Templates Modal -->
  <el-dialog
    v-model="showManageTemplatesModal"
    :close-on-click-modal="false"
    title=""
    width="800px"
  >
    <template #header>
      <div class="flex items-center gap-3">
        <div
          class="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 shadow-md"
        >
          <i class="fas fa-layer-group text-white"></i>
        </div>
        <div>
          <h3 class="text-lg font-bold text-gray-900 dark:text-white">模板管理</h3>
          <p class="text-xs text-gray-500">共 {{ templates.length }} 个模板</p>
        </div>
      </div>
    </template>
    <div class="max-h-[500px] overflow-y-auto">
      <el-table :data="templates" :empty-text="'暂无模板'" stripe style="width: 100%">
        <el-table-column label="模板名称" width="180">
          <template #default="{ row }">
            <div class="flex items-center gap-2">
              <i class="fas fa-file-alt text-blue-500"></i>
              <span class="font-medium">{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="主题" prop="subject" show-overflow-tooltip width="200" />
        <el-table-column label="分类" width="120">
          <template #default="{ row }">
            <el-tag effect="dark" size="small" :type="getCategoryTagType(row.category)">
              {{ getCategoryLabel(row.category) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column align="center" fixed="right" label="操作" width="140">
          <template #default="{ row }">
            <div class="flex items-center justify-center gap-2">
              <el-tooltip content="预览" placement="top">
                <el-button circle size="small" type="primary" @click="previewTemplate(row)">
                  <i class="fas fa-eye"></i>
                </el-button>
              </el-tooltip>
              <el-tooltip content="编辑" placement="top">
                <el-button circle size="small" type="warning" @click="editTemplate(row)">
                  <i class="fas fa-edit"></i>
                </el-button>
              </el-tooltip>
              <el-popconfirm
                cancel-button-text="取消"
                confirm-button-text="删除"
                title="确认删除此模板吗？"
                @confirm="deleteTemplate(row.id)"
              >
                <template #reference>
                  <el-tooltip content="删除" placement="top">
                    <el-button circle size="small" type="danger">
                      <i class="fas fa-trash"></i>
                    </el-button>
                  </el-tooltip>
                </template>
              </el-popconfirm>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <template #footer>
      <el-button @click="showManageTemplatesModal = false">关闭</el-button>
    </template>
  </el-dialog>

  <!-- Preview Template Modal -->
  <el-dialog v-model="showPreviewTemplateModal" title="模板预览" width="600px">
    <div v-if="previewingTemplate" class="space-y-4">
      <div>
        <label class="text-sm font-medium text-gray-500">主题</label>
        <p class="mt-1 text-gray-900 dark:text-white">{{ previewingTemplate.subject }}</p>
      </div>
      <div>
        <label class="text-sm font-medium text-gray-500">内容</label>
        <div
          class="prose dark:prose-invert mt-1 max-w-none rounded border bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900"
          v-html="previewingTemplate.content"
        ></div>
      </div>
    </div>
    <template #footer>
      <el-button @click="showPreviewTemplateModal = false">关闭</el-button>
      <el-button type="primary" @click="usePreviewedTemplate">使用此模板</el-button>
    </template>
  </el-dialog>

  <!-- Edit Template Modal -->
  <el-dialog v-model="showEditTemplateModal" title="编辑模板" width="500px">
    <div v-if="editingTemplate" class="space-y-4">
      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >模板名称</label
        >
        <el-input v-model="editingTemplate.name" />
      </div>
      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">分类</label>
        <el-select v-model="editingTemplate.category" class="w-full">
          <el-option label="通用" value="general" />
          <el-option label="营销" value="marketing" />
          <el-option label="系统通知" value="system" />
          <el-option label="警告提醒" value="alert" />
        </el-select>
      </div>
      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">主题</label>
        <el-input v-model="editingTemplate.subject" />
      </div>
      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">内容</label>
        <el-input v-model="editingTemplate.content" :rows="6" type="textarea" />
      </div>
    </div>
    <template #footer>
      <el-button @click="showEditTemplateModal = false">取消</el-button>
      <el-button type="primary" @click="updateTemplate">保存修改</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiClient } from '@/config/api'
import { showToast } from '@/utils/toast'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const targetFilter = ref('all')
const preSelectedUserIds = ref([])
const previewContent = ref('<p class="text-gray-400">输入内容以查看预览...</p>')

const form = ref({
  subject: '',
  content: ''
})

// Template related state
const templates = ref([])
const selectedTemplateId = ref(null)
const showSaveTemplateModal = ref(false)
const newTemplateName = ref('')
const newTemplateCategory = ref('general')

// Template management state
const showManageTemplatesModal = ref(false)
const showPreviewTemplateModal = ref(false)
const showEditTemplateModal = ref(false)
const previewingTemplate = ref(null)
const editingTemplate = ref(null)

const preSelectedCount = computed(() => preSelectedUserIds.value.length)

// Load templates and check for pre-selected users
onMounted(async () => {
  // Load templates
  try {
    const response = await apiClient.get('/admin/notification-templates')
    templates.value = response.data || []
  } catch (e) {
    console.error('Failed to load templates', e)
  }

  // Check for pre-selected users from query
  if (route.query.userIds) {
    try {
      const ids = JSON.parse(route.query.userIds)
      if (Array.isArray(ids) && ids.length > 0) {
        preSelectedUserIds.value = ids
      }
    } catch (e) {
      console.error('Failed to parse userIds from query', e)
    }
  }
})

// Apply selected template
const applyTemplate = (templateId) => {
  if (!templateId) {
    return
  }
  const tpl = templates.value.find((t) => t.id === templateId)
  if (tpl) {
    form.value.subject = tpl.subject
    form.value.content = tpl.content
  }
}

// Save current content as template
const saveAsTemplate = async () => {
  if (!newTemplateName.value.trim()) {
    showToast('请输入模板名称', 'error')
    return
  }
  try {
    await apiClient.post('/admin/notification-templates', {
      name: newTemplateName.value,
      subject: form.value.subject,
      content: form.value.content,
      category: newTemplateCategory.value
    })
    showToast('模板保存成功', 'success')
    showSaveTemplateModal.value = false
    newTemplateName.value = ''
    await reloadTemplates()
  } catch (e) {
    showToast('保存模板失败', 'error')
  }
}

// Helper function to reload templates (avoid duplicate code)
const reloadTemplates = async () => {
  try {
    const response = await apiClient.get('/admin/notification-templates')
    templates.value = response.data || []
  } catch (e) {
    console.error('Failed to reload templates', e)
  }
}
// Template management functions
const getCategoryLabel = (category) => {
  const labels = { general: '通用', marketing: '营销', system: '系统', alert: '警告' }
  return labels[category] || category
}

const getCategoryTagType = (category) => {
  const types = { general: '', marketing: 'success', system: 'info', alert: 'warning' }
  return types[category] || ''
}

const previewTemplate = (tpl) => {
  previewingTemplate.value = { ...tpl }
  showPreviewTemplateModal.value = true
}

const usePreviewedTemplate = () => {
  if (previewingTemplate.value) {
    form.value.subject = previewingTemplate.value.subject
    form.value.content = previewingTemplate.value.content
    selectedTemplateId.value = previewingTemplate.value.id
    showPreviewTemplateModal.value = false
    showManageTemplatesModal.value = false
    showToast('模板已应用', 'success')
  }
}

const editTemplate = (tpl) => {
  editingTemplate.value = { ...tpl }
  showEditTemplateModal.value = true
}

const updateTemplate = async () => {
  if (!editingTemplate.value) return
  try {
    await apiClient.put(`/admin/notification-templates/${editingTemplate.value.id}`, {
      name: editingTemplate.value.name,
      subject: editingTemplate.value.subject,
      content: editingTemplate.value.content,
      category: editingTemplate.value.category
    })
    showToast('模板更新成功', 'success')
    showEditTemplateModal.value = false
    await reloadTemplates()
  } catch (e) {
    showToast('更新模板失败', 'error')
  }
}

const deleteTemplate = async (id) => {
  try {
    await apiClient.delete(`/admin/notification-templates/${id}`)
    showToast('模板删除成功', 'success')
    await reloadTemplates()
  } catch (e) {
    showToast('删除模板失败', 'error')
  }
}
const canSend = computed(() => {
  return form.value.subject.trim() && form.value.content.trim()
})

const clearPreSelection = () => {
  preSelectedUserIds.value = []
  // Remove query param
  router.replace({ query: {} })
}

const insertVariable = (variable) => {
  form.value.content += variable
}

const preview = async () => {
  if (!form.value.content) return

  try {
    const response = await apiClient.post('/admin/notifications/preview', {
      content: form.value.content,
      sampleData: {
        displayName: '张三',
        email: 'zhangsan@example.com',
        status: 'active'
      }
    })
    previewContent.value = response.data.preview
  } catch (error) {
    showToast('预览失败', 'error')
  }
}

// Real-time preview with debounce
let previewTimer = null
const updatePreview = () => {
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = setTimeout(async () => {
    if (!form.value.content) {
      previewContent.value = '<p class="text-gray-400">输入内容以查看预览...</p>'
      return
    }
    await preview()
  }, 500)
}

const confirmSend = async () => {
  if (!confirm('确定要发送此通知吗？此操作不可撤销。')) return

  loading.value = true
  try {
    const payload = {
      subject: form.value.subject,
      content: form.value.content
    }

    if (preSelectedUserIds.value.length > 0) {
      payload.userIds = preSelectedUserIds.value
    } else {
      // Map frontend filter to backend filter
      if (targetFilter.value === 'all') {
        payload.filter = 'all'
      } else {
        payload.filter = { status: targetFilter.value }
      }
    }

    const response = await apiClient.post('/admin/notifications/send', payload)

    const { success, failed } = response.data.data
    showToast(`发送完成: 成功 ${success}, 失败 ${failed}`, 'success')

    // Reset form
    form.value.subject = ''
    form.value.content = ''
    previewContent.value = ''
  } catch (error) {
    showToast(error.response?.data?.error || '发送失败', 'error')
  } finally {
    loading.value = false
  }
}
</script>
