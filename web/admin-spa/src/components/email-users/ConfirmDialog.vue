<template>
  <teleport to="body">
    <transition name="dialog-fade">
      <div
        v-if="visible"
        class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-gray-500 bg-opacity-75 transition-opacity"
        @click.self="handleCancel"
      >
        <div
          class="relative mx-4 w-full max-w-md transform overflow-hidden rounded-lg bg-white shadow-xl transition-all dark:bg-gray-800"
        >
          <!-- Icon -->
          <div class="p-6 pb-4">
            <div class="flex items-start">
              <div
                :class="[
                  'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full',
                  iconBgClass
                ]"
              >
                <svg
                  class="h-6 w-6"
                  :class="iconColorClass"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    v-if="type === 'warning'"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                  />
                  <path
                    v-else-if="type === 'danger'"
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                  />
                  <path
                    v-else
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                  />
                </svg>
              </div>
              <div class="ml-4 flex-1">
                <h3 class="text-lg font-medium text-gray-900 dark:text-white">
                  {{ title }}
                </h3>
                <div class="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  <p v-html="message"></p>
                </div>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="bg-gray-50 px-6 py-4 dark:bg-gray-700 sm:flex sm:flex-row-reverse">
            <button
              :class="[
                'inline-flex w-full justify-center rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm sm:ml-3 sm:w-auto',
                confirmButtonClass
              ]"
              type="button"
              @click="handleConfirm"
            >
              {{ confirmText }}
            </button>
            <button
              class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-600 dark:text-white dark:ring-gray-500 dark:hover:bg-gray-500 sm:mt-0 sm:w-auto"
              type="button"
              @click="handleCancel"
            >
              {{ cancelText }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    default: 'info', // 'info', 'warning', 'danger'
    validator: (value) => ['info', 'warning', 'danger'].includes(value)
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  confirmText: {
    type: String,
    default: '确定'
  },
  cancelText: {
    type: String,
    default: '取消'
  }
})

const emit = defineEmits(['confirm', 'cancel', 'update:visible'])

const iconBgClass = computed(() => {
  const classes = {
    info: 'bg-blue-100 dark:bg-blue-900',
    warning: 'bg-yellow-100 dark:bg-yellow-900',
    danger: 'bg-red-100 dark:bg-red-900'
  }
  return classes[props.type]
})

const iconColorClass = computed(() => {
  const classes = {
    info: 'text-blue-600 dark:text-blue-300',
    warning: 'text-yellow-600 dark:text-yellow-300',
    danger: 'text-red-600 dark:text-red-300'
  }
  return classes[props.type]
})

const confirmButtonClass = computed(() => {
  const classes = {
    info: 'bg-blue-600 hover:bg-blue-500',
    warning: 'bg-yellow-600 hover:bg-yellow-500',
    danger: 'bg-red-600 hover:bg-red-500'
  }
  return classes[props.type]
})

const handleConfirm = () => {
  emit('confirm')
  emit('update:visible', false)
}

const handleCancel = () => {
  emit('cancel')
  emit('update:visible', false)
}
</script>

<style scoped>
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.3s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-fade-enter-active .relative,
.dialog-fade-leave-active .relative {
  transition: transform 0.3s ease;
}

.dialog-fade-enter-from .relative {
  transform: scale(0.95);
}

.dialog-fade-leave-to .relative {
  transform: scale(0.95);
}
</style>
