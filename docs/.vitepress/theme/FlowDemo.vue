<script setup lang="ts">
/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 示例舞台：在浏览器里载入 examples/demos/<name>.ts 或 <name>.vue。.ts 示例导出 mount，挂到舞台上，卸载时调用它返回的清理函数；
// .vue 示例是一个组件，直接渲染在舞台里。舞台里的查看器按流程图定高度：在舞台宽度下以适合窗口的缩放显示整张图。

import type { XhFlowViewer } from '@xihan-flow/runtime'
import type { Component } from 'vue'
import { markRaw, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'

interface DemoModule {
  mount?: (host: HTMLElement) => () => void
  default?: Component
}

const props = defineProps<{ name: string }>()

/** 查看器适合窗口时四周留的边距（屏幕像素）。 */
const VIEWER_PADDING = 24

const demos = import.meta.glob<DemoModule>('../../examples/demos/*.{ts,vue}')
const stage = ref<HTMLElement>()
const component = shallowRef<Component>()
const missing = ref(false)
let dispose: (() => void) | undefined
let stopSizing: (() => void) | undefined
let unmounted = false

/** 舞台里每个查看器的高度取流程图在当前宽度下适合窗口（不放大）时的高度，流程定义或宽度变了重算。 */
async function sizeViewers(host: HTMLElement): Promise<() => void> {
  const { buildScene, createFlowRuntimeModel, createOrthogonalRouter } = await import('@xihan-flow/runtime')
  const measured = new WeakMap<XhFlowViewer, { schema: unknown, width: number }>()
  const size = (viewer: XhFlowViewer): void => {
    const width = viewer.clientWidth
    const last = measured.get(viewer)
    if (viewer.schema === undefined || width === 0 || (last?.schema === viewer.schema && last.width === width))
      return
    measured.set(viewer, { schema: viewer.schema, width })
    const { bounds } = buildScene(viewer.schema, createFlowRuntimeModel(viewer.extensions).nodeTypes, { route: viewer.router ?? createOrthogonalRouter() })
    if (bounds === undefined || bounds.width === 0)
      return
    const zoom = Math.min(1, (width - VIEWER_PADDING * 2) / bounds.width)
    const border = getComputedStyle(viewer).boxSizing === 'border-box' ? viewer.offsetHeight - viewer.clientHeight : 0
    viewer.style.blockSize = `${Math.ceil(bounds.height * zoom + VIEWER_PADDING * 2 + border)}px`
  }
  const sizeAll = (): void => host.querySelectorAll<XhFlowViewer>('xh-flow-viewer').forEach(size)
  // 查看器装上流程定义并适合窗口后派发 viewport-change，从这里接上后来加进舞台、换了流程定义的查看器
  const onViewport = (event: Event): void => {
    if ((event.target as Element).localName === 'xh-flow-viewer')
      size(event.target as XhFlowViewer)
  }
  host.addEventListener('viewport-change', onViewport)
  const observer = new ResizeObserver(sizeAll)
  observer.observe(host)
  sizeAll()
  return () => {
    host.removeEventListener('viewport-change', onViewport)
    observer.disconnect()
  }
}

onMounted(async () => {
  const load = demos[`../../examples/demos/${props.name}.ts`] ?? demos[`../../examples/demos/${props.name}.vue`]
  if (load === undefined) {
    missing.value = true
    return
  }
  const demo = await load()
  if (unmounted || stage.value === undefined)
    return
  const host = stage.value
  if (demo.mount !== undefined)
    dispose = demo.mount(host)
  else if (demo.default !== undefined)
    component.value = markRaw(demo.default)
  const stop = await sizeViewers(host)
  if (unmounted)
    stop()
  else
    stopSizing = stop
})

onBeforeUnmount(() => {
  unmounted = true
  stopSizing?.()
  dispose?.()
})
</script>

<template>
  <div class="flow-demo">
    <p v-if="missing" class="flow-demo__missing">
      找不到示例 {{ props.name }}
    </p>
    <div v-else ref="stage" class="flow-demo__stage">
      <component :is="component" v-if="component" />
    </div>
  </div>
</template>
