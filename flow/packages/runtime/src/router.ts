/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 直角连线路由器：把 flow-core 的路由请求交给 @xihan-ui/viz 的直角路由，绕开全部节点。

import type { FlowEdgeRouter } from '@xihan-flow/core'
import { routeOrthogonal } from '@xihan-ui/viz/graph'

export interface OrthogonalRouterOptions {
  /** 与节点保持的距离，也是从端口引出的长度，缺省 16。 */
  readonly margin?: number
  /** 每个拐弯折合的长度，缺省 margin 的两倍。 */
  readonly bendCost?: number
}

/** 创建直角路由器；找不到绕开全部节点的通路时，返回不看障碍物的直角折线。 */
export function createOrthogonalRouter(options: OrthogonalRouterOptions = {}): FlowEdgeRouter {
  return ({ source, target, obstacles }) => routeOrthogonal({
    source: { point: [source.point.x, source.point.y], side: source.side },
    target: { point: [target.point.x, target.point.y], side: target.side },
    obstacles,
    margin: options.margin ?? 16,
    ...(options.bendCost === undefined ? {} : { bendCost: options.bendCost }),
  }).points.map(([x, y]) => ({ x, y }))
}
