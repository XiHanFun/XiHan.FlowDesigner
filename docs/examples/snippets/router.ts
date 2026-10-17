/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 连线路由：直角路由离节点远一些；或者换成两端直连的直线。

import type { FlowEdgeRouter } from '@xihan-flow/core'
import { createOrthogonalRouter } from '@xihan-flow/runtime'

export function useRouters(viewer: HTMLElementTagNameMap['xh-flow-viewer']): void {
  // #region orthogonal
  viewer.router = createOrthogonalRouter({ margin: 24 })
  // #endregion orthogonal

  // #region straight
  const straight: FlowEdgeRouter = ({ source, target }) => [source.point, target.point]
  viewer.router = straight
  // #endregion straight
}
