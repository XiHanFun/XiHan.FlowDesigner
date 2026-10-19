/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 扩展往新手引导里加一步，在设置的「关于」页里写自己的版本。

import type { FlowDesignerExtension } from '@xihan-flow/designer'

// #region tour-steps
export const simulation: FlowDesignerExtension = {
  id: '@acme/flow-simulation',
  tourSteps: [{
    id: '@acme/flow-simulation.panel',
    target: { panel: 'simulation' },
    title: '模拟运行',
    description: '在这里按步模拟流程的走向。',
    order: 200,
  }],
  about: [{ label: '模拟运行', value: '1.0.0' }],
}
// #endregion tour-steps
