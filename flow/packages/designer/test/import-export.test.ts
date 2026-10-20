/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// @vitest-environment jsdom

import type { DesignerImportSource } from '@xihan-ui/designer-kit'
import type { FlowDesignerEventMap, FlowDesignerExporter, FlowDesignerExtension, FlowDesignerImporter, FlowImportResult, XhFlowDesigner } from '../src'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineFlowDesigner } from '../src'
import { mount, nodes, part, placeCanvas, sample, unmountAll } from './helpers'

defineFlowDesigner()

afterEach(() => {
  unmountAll()
  vi.restoreAllMocks()
})

/** 一段两个节点、一条连线（带一个拐点）的片段，包围盒 (0, 0)–(300, 40)。 */
const FRAGMENT: FlowImportResult = {
  nodes: [
    { id: 'a', type: 'task', x: 0, y: 0, width: 100, height: 40 },
    { id: 'b', type: 'end', x: 200, y: 0, width: 100, height: 40 },
  ],
  edges: [{ id: 'ab', source: { node: 'a' }, target: { node: 'b' }, vertices: [{ x: 150, y: 20 }] }],
}

function importer(id: string, accepts: (source: DesignerImportSource) => boolean, result: () => FlowImportResult | undefined | Promise<FlowImportResult | undefined>): FlowDesignerImporter {
  return { id, accepts, import: async () => result() }
}

function withImporters(...importers: FlowDesignerImporter[]): FlowDesignerExtension {
  return { id: 'host', importers }
}

/** 剪贴板或拖放的数据：按类型存取的文本加文件。 */
function transfer(texts: Readonly<Record<string, string>>, files: readonly File[] = []): DataTransfer {
  return {
    files,
    dropEffect: 'none',
    getData: (type: string) => texts[type] ?? '',
    setData: () => {},
  } as unknown as DataTransfer
}

function paste(data: DataTransfer): Event {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', { value: data })
  window.document.body.dispatchEvent(event)
  return event
}

function drag(designer: XhFlowDesigner, type: 'dragover' | 'drop', data: DataTransfer, x: number, y: number): Event {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, { dataTransfer: { value: data }, clientX: { value: x }, clientY: { value: y } })
  part(designer, 'viewport')[0]!.dispatchEvent(event)
  return event
}

function focusCanvas(designer: XhFlowDesigner): void {
  designer.querySelector<HTMLElement>('[data-flow-canvas]')!.focus()
}

function toolbarItems(designer: Element): string[] {
  return Array.from(designer.querySelectorAll<HTMLButtonElement>('[data-part="command-bar"] button[data-xh-part="item"]'), item => item.value)
}

/** 菜单栏「文件」菜单里的命令 id。 */
function fileMenuItems(designer: Element): string[] {
  const menubar = designer.querySelector<HTMLElement & { collection?: { value: string, items?: { value: string }[] }[] }>('xh-menubar')!
  return menubar.collection!.find(menu => menu.value === 'file')!.items!.map(item => item.value.slice('file/'.length))
}

/** 记下问过的来源，返回 accepts 的结果。 */
function record(asked: string[], id: string, source: DesignerImportSource, accepts: boolean): boolean {
  asked.push(`${id}:${source.mime}`)
  return accepts
}

const flush = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0))

/** 挂上 openFile() 弹出的文件框，选中给定的文件；accept 是最近一次弹出时文件框的 accept。 */
function chooseFile(file: File | undefined): { opened: () => number, accept: () => string | undefined } {
  let opened = 0
  let accept: string | undefined
  vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
    opened++
    accept = this.accept
    expect(this.type).toBe('file')
    Object.defineProperty(this, 'files', { value: file ? [file] : [] })
    this.dispatchEvent(new Event('change'))
  })
  return { opened: () => opened, accept: () => accept }
}

describe('导入', () => {
  it('没有导入器时：不能导入，工具栏与文件菜单里都没有打开文件，外部文本的粘贴与拖放都不接', async () => {
    const designer = await mount()
    expect(designer.canImport).toBe(false)
    expect(toolbarItems(designer)).not.toContain('open-file')
    expect(fileMenuItems(designer)).not.toContain('open-file')
    focusCanvas(designer)
    expect(paste(transfer({ 'text/plain': 'hello' })).defaultPrevented).toBe(false)
    expect(drag(designer, 'dragover', transfer({ 'text/plain': 'hello' }), 10, 10).defaultPrevented).toBe(false)
  })

  it('粘贴进来的外部内容交给第一个接下的导入器：片段放在视口中央、左上角吸附网格，换新 id、选中并记一步撤销', async () => {
    const asked: string[] = []
    const designer = await mount((d) => {
      d.extensions = [nodes, withImporters(
        importer('image', source => record(asked, 'image', source, false), () => undefined),
        importer('text', source => record(asked, 'text', source, source.mime === 'text/plain'), () => FRAGMENT),
      )]
    })
    placeCanvas(designer, 800, 600)
    designer.setViewport({ x: 0, y: 0, zoom: 1 })
    expect(designer.canImport).toBe(true)
    focusCanvas(designer)
    expect(paste(transfer({ 'text/html': '<b>x</b>', 'text/plain': 'x' })).defaultPrevented).toBe(true)
    expect(asked).toEqual(['image:text/html', 'text:text/html', 'image:text/plain', 'text:text/plain'])
    await flush()

    const pasted = designer.schema.nodes.slice(3)
    expect(pasted.map(node => node.type)).toEqual(['task', 'end'])
    expect(pasted.map(node => node.id)).not.toContain('a')
    // 包围盒 300 × 40 的中心落在视口中央 (400, 300)，左上角 (250, 280) 吸附到 16 的格子上
    expect(pasted.map(node => [node.x, node.y])).toEqual([[256, 288], [456, 288]])
    const edge = designer.schema.edges.at(-1)!
    expect([edge.source.node, edge.target.node]).toEqual(pasted.map(node => node.id))
    expect(edge.vertices).toEqual([{ x: 406, y: 308 }])
    expect(designer.getSelection()).toEqual({ nodes: pasted.map(node => node.id), edges: [edge.id] })
    expect(designer.undo()).toBe(true)
    expect(designer.schema).toEqual(sample())
  })

  it('流程自己的剪贴板内容照旧直接粘贴，不问导入器', async () => {
    const accepts = vi.fn(() => true)
    const designer = await mount(d => d.extensions = [nodes, withImporters(importer('any', accepts, () => FRAGMENT))])
    designer.select({ nodes: ['s'] })
    focusCanvas(designer)
    const data = transfer({})
    const store = new Map<string, string>()
    Object.assign(data, { getData: (type: string) => store.get(type) ?? '', setData: (type: string, value: string) => void store.set(type, value) })
    const copy = new Event('copy', { bubbles: true, cancelable: true })
    Object.defineProperty(copy, 'clipboardData', { value: data })
    window.document.body.dispatchEvent(copy)
    expect(paste(data).defaultPrevented).toBe(true)
    expect(accepts).not.toHaveBeenCalled()
    expect(designer.schema.nodes).toHaveLength(4)
  })

  it('导入整份流程定义：换掉当前定义并记一步撤销，清空选择', async () => {
    const replacement = { version: 1 as const, nodes: [{ id: 'only', type: 'start', x: 0, y: 0, width: 100, height: 40 }], edges: [], data: { name: 'imported' } }
    const designer = await mount(d => d.extensions = [nodes, withImporters(importer('doc', () => true, () => ({ document: replacement })))])
    designer.select({ nodes: ['t'] })
    const kinds: string[] = []
    designer.addEventListener('schema-change', event => kinds.push((event as FlowDesignerEventMap['schema-change']).detail.kind))
    focusCanvas(designer)
    paste(transfer({ 'text/plain': '<definitions/>' }))
    await flush()
    expect(designer.schema).toEqual(replacement)
    expect(designer.getSelection()).toEqual({ nodes: [], edges: [] })
    expect(kinds).toEqual(['execute'])
    expect(designer.undo()).toBe(true)
    expect(designer.schema).toEqual(sample())
  })

  it('导入器抛错、给出不合法的结构、重复的 id 或没登记的节点类型时派发 import-error，不放任何东西', async () => {
    const failure = new Error('bad file')
    const results: (() => FlowImportResult)[] = [
      () => { throw failure },
      () => ({ nodes: [{ id: 'x', type: 'task', x: 'a' }] } as unknown as FlowImportResult),
      () => ({ nodes: [{ id: 'x', type: 'missing', x: 0, y: 0, width: 10, height: 10 }] }),
      () => ({ document: { version: 1, nodes: [{ id: 'x', type: 'missing', x: 0, y: 0, width: 10, height: 10 }], edges: [] } }),
      () => ({ document: { version: 1, nodes: [{ id: 'x', type: 'task', x: 0, y: 0, width: 10, height: 10 }, { id: 'x', type: 'end', x: 0, y: 0, width: 10, height: 10 }], edges: [] } }),
    ]
    let next = 0
    const designer = await mount(d => d.extensions = [nodes, withImporters(importer('broken', () => true, () => results[next++]!()))])
    const errors: { importer?: string, source: DesignerImportSource, error: unknown }[] = []
    designer.addEventListener('import-error', event => errors.push((event as FlowDesignerEventMap['import-error']).detail))
    focusCanvas(designer)
    for (let round = 0; round < results.length; round++) {
      paste(transfer({ 'text/plain': 'x' }))
      await flush()
    }
    expect(errors.map(error => error.importer)).toEqual(['broken', 'broken', 'broken', 'broken', 'broken'])
    expect(errors[0]!.error).toBe(failure)
    expect(errors[0]!.source).toEqual({ kind: 'clipboard', mime: 'text/plain', text: 'x' })
    expect(errors.slice(1).every(error => error.error instanceof TypeError)).toBe(true)
    expect(designer.schema).toEqual(sample())
    expect(designer.canUndo).toBe(false)
  })

  it('拖进画布：有导入器时接受，文件先于文本交给导入器，片段落在指针处', async () => {
    const seen: DesignerImportSource[] = []
    const designer = await mount(d => d.extensions = [nodes, withImporters(importer('drop', source => seen.push(source) > 0, () => FRAGMENT))])
    placeCanvas(designer, 800, 600)
    designer.setViewport({ x: 0, y: 0, zoom: 1 })
    const file = new File(['<svg/>'], 'flow.svg', { type: 'image/svg+xml' })
    const data = transfer({ 'text/plain': 'x' }, [file])
    expect(drag(designer, 'dragover', data, 100, 100).defaultPrevented).toBe(true)
    expect(data.dropEffect).toBe('copy')
    expect(drag(designer, 'drop', data, 300, 100).defaultPrevented).toBe(true)
    expect(seen).toEqual([{ kind: 'drop', mime: 'image/svg+xml', name: 'flow.svg', file }])
    await flush()
    // 包围盒中心落在 (300, 100)：左上角 (150, 80) 吸附到 (144, 80)
    expect(designer.schema.nodes.slice(3).map(node => [node.x, node.y])).toEqual([[144, 80], [344, 80]])
  })

  it('只读时粘贴与拖放都不交给导入器', async () => {
    const accepts = vi.fn(() => true)
    const designer = await mount((d) => {
      d.extensions = [nodes, withImporters(importer('any', accepts, () => FRAGMENT))]
      d.readonly = true
    })
    focusCanvas(designer)
    expect(paste(transfer({ 'text/plain': 'x' })).defaultPrevented).toBe(false)
    expect(drag(designer, 'drop', transfer({ 'text/plain': 'x' }), 10, 10).defaultPrevented).toBe(false)
    expect(accepts).not.toHaveBeenCalled()
  })
})

describe('打开文件', () => {
  it('有导入器时工具栏最前多一组打开文件，文件菜单里保存后面也有；选中的文件交给导入器，片段放在视口中央', async () => {
    const seen: DesignerImportSource[] = []
    const designer = await mount(d => d.extensions = [nodes, withImporters(importer('file', source => seen.push(source) > 0 && source.kind === 'file', () => FRAGMENT))])
    expect(toolbarItems(designer)[0]).toBe('open-file')
    expect(fileMenuItems(designer).slice(0, 2)).toEqual(['save', 'open-file'])
    placeCanvas(designer, 800, 600)
    designer.setViewport({ x: 0, y: 0, zoom: 1 })
    const file = new File(['{}'], 'leave.json', { type: 'application/json' })
    const picker = chooseFile(file)
    designer.querySelector<HTMLButtonElement>('[data-part="command-bar"] button[value="open-file"]')!.click()
    expect(picker.opened()).toBe(1)
    expect(seen).toEqual([{ kind: 'file', mime: 'application/json', name: 'leave.json', file }])
    await flush()
    expect(designer.schema.nodes.slice(3).map(node => [node.x, node.y])).toEqual([[256, 288], [456, 288]])
  })

  it('文件框的 accept 是各导入器 fileTypes 按先后去重连起来的；都没写时不限类型', async () => {
    const json = { ...importer('json', () => false, () => undefined), fileTypes: ['.json', 'application/json'] }
    const bpmn = { ...importer('bpmn', () => false, () => undefined), fileTypes: ['.bpmn', '.json'] }
    const designer = await mount(d => d.extensions = [nodes, withImporters(json, importer('any', () => false, () => undefined), bpmn)])
    const picker = chooseFile(undefined)
    designer.openFile()
    expect(picker.accept()).toBe('.json,application/json,.bpmn')
    designer.extensions = [nodes, withImporters(importer('any', () => false, () => undefined))]
    designer.openFile()
    expect([picker.opened(), picker.accept()]).toEqual([2, ''])
  })

  it('没有导入器接下选中的文件时派发不带 importer 的 import-error', async () => {
    const designer = await mount(d => d.extensions = [nodes, withImporters(importer('json', source => source.mime === 'application/json', () => FRAGMENT))])
    const errors: { importer?: string, error: unknown }[] = []
    designer.addEventListener('import-error', event => errors.push((event as FlowDesignerEventMap['import-error']).detail))
    chooseFile(new File(['x'], 'notes.txt', { type: 'text/plain' }))
    designer.openFile()
    expect(errors).toHaveLength(1)
    expect(errors[0]!.importer).toBeUndefined()
    expect(errors[0]!.error).toBeInstanceOf(RangeError)
  })

  it('只读、没有导入器或没选文件时什么都不做', async () => {
    const plain = await mount()
    const picker = chooseFile(undefined)
    plain.openFile()
    expect(picker.opened()).toBe(0)

    const readonly = await mount((d) => {
      d.extensions = [nodes, withImporters(importer('any', () => true, () => FRAGMENT))]
      d.readonly = true
    })
    readonly.openFile()
    expect(picker.opened()).toBe(0)
    expect(readonly.querySelector<HTMLButtonElement>('[data-part="command-bar"] button[value="open-file"]')!.disabled).toBe(true)

    readonly.readonly = false
    readonly.openFile()
    expect(picker.opened()).toBe(1)
    await flush()
    expect(readonly.schema).toEqual(sample())
  })
})

describe('导出', () => {
  it('交给登记了这种格式的第一个导出器，带上设计器、文案与选项', async () => {
    const calls: unknown[] = []
    const exporter = (id: string, formats: string[]): FlowDesignerExporter => ({
      id,
      label: id,
      formats,
      export: async (format, context) => {
        calls.push([id, format, context.designer, context.translations.label, context.options])
        return `${id}:${format}`
      },
    })
    const designer = await mount(d => d.extensions = [nodes, { id: 'host', exporters: [exporter('json', ['json']), exporter('bpmn', ['bpmn', 'xml'])] }, { id: 'more', exporters: [exporter('xml2', ['xml'])] }])
    await expect(designer.export('xml', { pretty: true })).resolves.toBe('bpmn:xml')
    expect(calls).toEqual([['bpmn', 'xml', designer, 'Flow designer', { pretty: true }]])
    await expect(designer.export('json')).resolves.toBe('json:json')
    expect(calls.at(-1)).toEqual(['json', 'json', designer, 'Flow designer', {}])
  })

  it('没有导出器认这种格式时以 RangeError 拒绝', async () => {
    const designer = await mount()
    await expect(designer.export('bpmn')).rejects.toBeInstanceOf(RangeError)
  })

  it('内置的图片导出器出 svg：选中的节点按没选中的样子画，导出后选中标记还在', async () => {
    const designer = await mount()
    designer.select({ nodes: ['t'] })
    await designer.updateComplete
    const blob = await designer.export('svg', { padding: 0 }) as Blob
    expect(blob.type).toBe('image/svg+xml')
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.readAsText(blob)
    })
    expect(text).toContain('<text')
    expect(text).not.toContain('data-selected')
    expect(designer.querySelector('[data-part="node"][data-node-id="t"]')!.hasAttribute('data-selected')).toBe(true)
  })

  it('导出 PNG 与导出 SVG 一组，排在末组的面板之前；流程图是空的时不可用', async () => {
    const designer = await mount()
    expect(toolbarItems(designer).slice(-3)).toEqual(['export-png', 'export-svg', 'panels'])
    designer.schema = { version: 1, nodes: [], edges: [] }
    await designer.updateComplete
    expect(designer.querySelector<HTMLButtonElement>('[data-part="command-bar"] button[value="export-svg"]')!.disabled).toBe(true)
  })

  it('导出命令派发可取消的 export 事件：取消后不下载，没取消时存成 flow.svg', async () => {
    const designer = await mount()
    const downloads: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download)
    })
    const events: { format: string, blob: Blob }[] = []
    let cancel = true
    designer.addEventListener('export', (event) => {
      events.push((event as FlowDesignerEventMap['export']).detail)
      if (cancel)
        event.preventDefault()
    })
    const button = designer.querySelector<HTMLButtonElement>('[data-part="command-bar"] button[value="export-svg"]')!
    button.click()
    await vi.waitFor(() => expect(events).toHaveLength(1))
    expect(events[0]!.format).toBe('svg')
    expect(events[0]!.blob.type).toBe('image/svg+xml')
    expect(downloads).toEqual([])

    cancel = false
    button.click()
    await vi.waitFor(() => expect(downloads).toEqual(['flow.svg']))
  })
})
