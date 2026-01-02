<template>
  <div class="animate-pulse space-y-6">
    <!-- 头部骨架 -->
    <div class="flex items-center space-x-4 px-6 pt-6">
      <div class="h-12 w-12 rounded-full bg-gray-200 dark:bg-gray-700"></div>
      <div class="space-y-2">
        <div class="h-5 w-40 rounded bg-gray-200 dark:bg-gray-700"></div>
        <div class="h-4 w-60 rounded bg-gray-200 dark:bg-gray-700"></div>
      </div>
    </div>

    <!-- Tab 导航骨架 -->
    <div class="border-b border-gray-200 px-6 dark:border-gray-700">
      <div class="flex space-x-8">
        <div class="h-10 w-20 border-b-2 border-gray-200 dark:border-gray-700"></div>
        <div class="h-10 w-20"></div>
        <div class="h-10 w-20"></div>
        <div class="h-10 w-20"></div>
        <div class="h-10 w-20"></div>
      </div>
    </div>

    <!-- 内容区域骨架 (模拟 BasicInfoTab) -->
    <div class="grid grid-cols-1 gap-6 px-6 pb-6 md:grid-cols-2">
      <!-- 左侧列 -->
      <div class="space-y-6">
        <!-- 卡片 1 -->
        <div class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <div class="mb-4 h-6 w-32 rounded bg-gray-200 dark:bg-gray-700"></div>
          <div class="space-y-3">
            <div class="flex justify-between">
              <div class="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700"></div>
              <div class="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700"></div>
            </div>
            <div class="flex justify-between">
              <div class="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700"></div>
              <div class="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700"></div>
            </div>
            <div class="flex justify-between">
              <div class="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700"></div>
              <div class="h-4 w-28 rounded bg-gray-200 dark:bg-gray-700"></div>
            </div>
          </div>
        </div>

        <!-- 卡片 2 -->
        <div class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <div class="mb-4 h-6 w-24 rounded bg-gray-200 dark:bg-gray-700"></div>
          <div class="space-y-3">
            <div class="flex justify-between">
              <div class="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700"></div>
              <div class="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧列 -->
      <div class="space-y-6">
        <!-- 卡片 3 -->
        <div class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <div class="mb-4 h-6 w-28 rounded bg-gray-200 dark:bg-gray-700"></div>
          <div class="space-y-3">
            <div class="flex justify-between">
              <div class="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700"></div>
              <div class="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700"></div>
            </div>
            <div class="flex justify-between">
              <div class="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700"></div>
              <div class="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// 纯展示组件，无需逻辑
</script>
