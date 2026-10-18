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
    expect([background.localName, background.getAttribute('fill')]).toEqual(['rect', '#ffffff'])
    expect(Array.from(svg.querySelectorAll('text'), text => text.textContent)).toEqual(['提交', '开始', '审批'])
    expect(svg.querySelectorAll('path[d]').length).toBeGreaterThanOrEqual(2)
    const icon = svg.querySelector('svg')!
    expect(icon.getAttribute('viewBox')).toBe('0 0 24 24')
    expect(icon.querySelector('path')!.getAttribute('d')).toBe('M8 5v14l11-7z')
    expect(svg.querySelector('[class], [data-part], [style]')).toBeNull()
  })

  it('颜色写成 sRGB 的 #rrggbb，自带的透明度写进透明度属性；画布的字体写在根上，与它相同的文字不再写', async () => {
    const viewer = await mount()
    const font = { fontFamily: 'serif', fontSize: '13px', fontWeight: '400' }
    Object.assign(viewer.querySelector<HTMLElement>('[data-part="viewport"]')!.style, font)
    const label = viewer.querySelector<HTMLElement>('[data-part="edge-label"]')!
    Object.assign(label.style, font, { color: 'rgb(255, 0, 0)', backgroundColor: 'rgba(10, 20, 30, 0.5)', border: '1px solid rgba(0, 0, 255, 0.25)' })
    const task = viewer.querySelector<HTMLElement>('[data-part="node"][data-node-id="t"]')!
    Object.assign(task.style, font, { fontStyle: 'italic', fontWeight: '600' })
    Object.assign(viewer.querySelector<HTMLElement>('[data-part="node"][data-node-id="s"] [data-part="node-label"]')!.style, font)
    const svg = await parse(await viewer.export('svg', { background: 'rgba(255, 255, 255, 0.8)' }))
    expect([svg.getAttribute('font-family'), svg.getAttribute('font-size'), svg.getAttribute('font-weight')]).toEqual(['serif', '13px', '400'])
    const background = svg.firstElementChild!
    expect([background.getAttribute('fill'), background.getAttribute('fill-opacity')]).toEqual(['#ffffff', '0.8'])
    const [submit, start, approve] = Array.from(svg.querySelectorAll('text'))
    expect([submit!.getAttribute('fill'), submit!.hasAttribute('fill-opacity')]).toEqual(['#ff0000', false])
    expect(['font-family', 'font-size', 'font-weight', 'font-style'].filter(name => start!.hasAttribute(name))).toEqual([])
    expect([approve!.getAttribute('font-style'), approve!.getAttribute('font-weight'), approve!.hasAttribute('font-family')]).toEqual(['italic', '600', false])
    const frame = submit!.previousElementSibling!
    expect([frame.getAttribute('fill'), frame.getAttribute('fill-opacity'), frame.getAttribute('stroke'), frame.getAttribute('stroke-opacity')])
      .toEqual(['#0a141e', '0.5', '#0000ff', '0.25'])
    expect(new XMLSerializer().serializeToString(svg)).not.toMatch(/rgba?\(/)
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
