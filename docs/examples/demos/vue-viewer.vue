<script setup lang="ts">
/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 在 Vue 里使用查看器：对象经 .prop 交给元素的属性，事件用 @ 监听；点一个节点把它标为已完成。

import type { FlowNodeStatus, FlowViewerEventMap } from '@xihan-flow/runtime'
import { defineFlowViewer } from '@xihan-flow/runtime'
import { ref } from 'vue'
import { extensions, schema } from '../schemas/approval'

defineFlowViewer()

const statuses = ref<Record<string, FlowNodeStatus>>({ start: 'completed', dept: 'running' })
const message = ref('点一个节点把它标为已完成')

function onNodeClick(event: Event): void {
  const { id } = (event as FlowViewerEventMap['node-click']).detail
  statuses.value = { ...statuses.value, [id]: 'completed' }
  message.value = `已把 ${id} 标为已完成`
}
</script>

<template>
  <p>{{ message }}</p>
  <xh-flow-viewer :extensions.prop="extensions" :schema.prop="schema" :statuses.prop="statuses" @node-click="onNodeClick" />
</template>
