<template>
  <template v-for="item in items" :key="item.path">
    <div v-if="item.children?.length" class="console-menu-group">
      <button
        type="button"
        class="console-menu-link console-menu-parent"
        :aria-expanded="isOpen(item)"
        @click="toggle(item)"
      >
        <span>{{ item.label }}</span>
        <span aria-hidden="true" class="console-menu-chevron" :data-open="isOpen(item)">+</span>
      </button>
      <div v-show="isOpen(item)" class="console-menu-children">
        <router-link
          v-for="child in item.children"
          :key="child.path"
          :to="child.to ?? child.path"
          role="menuitem"
          class="console-menu-link console-menu-child"
          :aria-current="isCurrent(child.path) ? 'page' : undefined"
          @click="emit('select')"
        >
          {{ child.label }}
        </router-link>
      </div>
    </div>
    <router-link
      v-else
      :to="item.to ?? item.path"
      role="menuitem"
      class="console-menu-link"
      :id="stampIds ? item.domId : undefined"
      :data-tour="stampIds ? item.tour : undefined"
      :aria-current="isCurrent(item.path) ? 'page' : undefined"
      @click="emit('select')"
    >
      <span
        v-if="item.iconSvg"
        class="nav-svg-icon"
        v-html="sanitizeSvg(item.iconSvg)"
      />
      <span>{{ item.label }}</span>
    </router-link>
  </template>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { sanitizeSvg } from '@/utils/sanitize'
import type { ConsoleNavItem } from './consoleNav'

const props = withDefaults(defineProps<{
  items: ConsoleNavItem[]
  currentPath: string
  stampIds?: boolean
}>(), {
  stampIds: false,
})

const emit = defineEmits<{ select: [] }>()
const expanded = ref<Record<string, boolean>>({})

function isCurrent(path: string): boolean {
  return props.currentPath === path || props.currentPath.startsWith(`${path}/`)
}

function isOpen(item: ConsoleNavItem): boolean {
  const choice = expanded.value[item.path]
  if (choice !== undefined) return choice
  return item.children?.some((child) => props.currentPath === child.path) ?? false
}

function toggle(item: ConsoleNavItem) {
  expanded.value = { ...expanded.value, [item.path]: !isOpen(item) }
}
</script>
