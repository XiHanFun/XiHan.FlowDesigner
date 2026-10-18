/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// @vitest-environment jsdom

import type { FlowDocument } from '@xihan-flow/core'
import type { FlowRuntimeExtension, XhFlowViewer } from '../src'
import { afterEach, describe, expect, it } from 'vitest'
import { defineFlowViewer, FLOW_VIEWER_TAG } from '../src'

defineFlowViewer()

const play = { name: 'play', viewBox: '0 0 24 24', nodes: [{ tag: 'path' as const, attrs: { d: 'M8 5v14l11-7z' } }] }

const nodes: FlowRuntimeExtension = {
  id: 'test',
  nodeTypes: [
    { type: 'start', label: '开始', icon: play, size: { width: 100, height: 40 }, ports: 'out' },
    { type: 'task', label: '任务', size: { width: 100, height: 40 }, ports: 'both' },
  ],
}

const document: FlowDocument = {
  version: 1,
  nodes: [
    { id: 's', type: 'start', x: 0, y: 0, width: 100, height: 40 },
    { id: 't', type: 'task', x: 200, y: 0, width: 100, height: 40, label: '审批' },
  ],
  edges: [{ id: 'st', source: { node: 's' }, target: { node: 't' }, label: '提交', style: { dashed: true } }],
}

const mounted: Element[] = []

afterEach(() => {
  for (const element of mounted.splice(0)) element.remove()
})

async function mount(schema: FlowDocument | null = document): Promise<XhFlowViewer> {
  const viewer = window.document.createElement(FLOW_VIEWER_TAG)
  viewer.extensions = [nodes]
  if (schema)
    viewer.schema = schema
  window.document.body.append(viewer)
  mounted.push(viewer)
  await viewer.updateComplete
  return viewer
}

async function parse(blob: Blob): Promise<SVGSVGElement> {
  const text = await new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.readAsText(blob)
  })
  return new DOMParser().parseFromString(text, 'image/svg+xml').documentElement as unknown as SVGSVGElement
}

describe('查看器导出图片', () => {
  it('svg：一份能单独打开的 SVG，范围是整张图加四周留白，节点、图标、连线与标签都画进去', async () => {
    const viewer = await mount()
    const blob = await viewer.export('svg', { padding: 10, background: 'rgb(255, 255, 255)' })
    expect(blob.type).toBe('image/svg+xml')
    const svg = await parse(blob)
    expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg')
    expect(svg.getElementsByTagName('parsererror')).toHaveLength(0)
    const [x, y, width, height] = svg.getAttribute('viewBox')!.split(' ').map(Number)
    expect([svg.getAttribute('width'), svg.getAttribute('height')]).toEqual([String(width), String(height)])
    expect(x).toBeLessThanOrEqual(-10)
    expect(y).toBeLessThanOrEqual(-10)
    expect(x! + width!).toBeGreaterThanOrEqual(310)

    const background = svg.firstElementChild!
    expect([background.localName, background.getAttribute('fill')]).toEqual(['rect', 'rgb(255, 255, 255)'])
    expect(Array.from(svg.querySelectorAll('text'), text => text.textContent)).toEqual(['提交', '开始', '审批'])
    expect(svg.querySelectorAll('path[d]').length).toBeGreaterThanOrEqual(2)
    const icon = svg.querySelector('svg')!
    expect(icon.getAttribute('viewBox')).toBe('0 0 24 24')
    expect(icon.querySelector('path')!.getAttribute('d')).toBe('M8 5v14l11-7z')
    expect(svg.querySelector('[class], [data-part], [style]')).toBeNull()
  })

  it('写 transparent 时不铺底色；画布与外层都透明时缺省也不铺', async () => {
    const viewer = await mount()
    const transparent = await parse(await viewer.export('svg', { background: 'transparent' }))
    expect(transparent.firstElementChild!.localName).not.toBe('rect')
    const auto = await parse(await viewer.export('svg'))
    expect(auto.firstElementChild!.localName).not.toBe('rect')
  })

  it('流程图是空的或格式不认得时以 RangeError 拒绝', async () => {
    const empty = await mount(null)
    await expect(empty.export('svg')).rejects.toBeInstanceOf(RangeError)
    const viewer = await mount()
    await expect(viewer.export('gif' as 'svg')).rejects.toBeInstanceOf(RangeError)
  })
})
