/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 设计器层的扩展：在运行时层之上加属性编辑器、命令、面板、导入器、导出器与装上时的回调；内置命令也写成一个扩展。

import type { FlowDocument, FlowEdge, FlowNode, FlowNodeType, FlowOperation, FlowPoint, FlowRuleContext } from '@xihan-flow/core'
import type { FlowDesignerTranslations, FlowImageExportOptions, FlowImageFormat, FlowRuntimeExtension, FlowRuntimeModel, FlowTourStepKey } from '@xihan-flow/runtime'
import type { DesignerCommand, DesignerExporter, DesignerImporter, History } from '@xihan-ui/designer-kit'
import type { PropertyEditorLayer, PropertyEditorTable } from '@xihan-ui/designer-kit/properties'
import type { DesignerCommandsTranslations, DesignerCommandTable, DesignerHistoryConfirm, DesignerHistoryTranslations, DesignerOutlineNode, DesignerPaletteSource, DesignerSettings, DesignerSettingsSection, DesignerShellExtension, DesignerTourStep, DesignerTourTarget, XhDesignerFrameElement } from '@xihan-ui/designer-shell'
import type { XhFlowDesigner } from './flow-designer'
import type { FlowPropertyEditor } from './panels/properties'
import { createFlowRuntimeModel, DEFAULT_FLOW_DESIGNER_TRANSLATIONS } from '@xihan-flow/runtime'
import { DesignerExtensionError, extensionCommands, extensionEditors, snapshotHistory } from '@xihan-ui/designer-kit'
import { collectPaletteSources, collectSettingsSections, collectTourSteps, createHistoryPanel, createOutlinePanel, designerHistoryCommands, designerPanelCommands, designerShellCommands } from '@xihan-ui/designer-shell'
import {
  AlignObjectsBottomIcon,
  AlignObjectsCenterIcon,
  AlignObjectsLeftIcon,
  AlignObjectsMiddleIcon,
  AlignObjectsRightIcon,
  AlignObjectsTopIcon,
  CircleHelpIcon,
  ClipboardIcon,
  CopyIcon,
  CopyPlusIcon,
  DistributeHorizontalIcon,
  DistributeVerticalIcon,
  EraserIcon,
  FileCodeIcon,
  FileImageIcon,
  FolderOpenIcon,
  HistoryIcon,
  ListTreeIcon,
  MaximizeIcon,
  PanelLeftIcon,
  RedoIcon,
  ScissorsIcon,
  SettingsIcon,
  SquareDashedIcon,
  TrashIcon,
  UndoIcon,
  WorkflowIcon,
  ZoomInIcon,
  ZoomOutIcon,
  ZoomResetIcon,
} from '@xihan-ui/icons'
import { resolveXhConfig } from '@xihan-ui/web-components'
import { FLOW_SETTINGS_SECTION } from './settings'

/** 命令、面板与扩展装上时拿到的上下文。 */
export interface FlowDesignerContext {
  /** 这台设计器。 */
  readonly designer: XhFlowDesigner
  /** 此刻生效的设计器文案。 */
  readonly translations: FlowDesignerTranslations
  /** 此刻生效的四款共用的命令文案（designer-shell 语言包的 xh-designer-commands 一桶）。 */
  readonly commandTranslations: DesignerCommandsTranslations
  /**
   * 此刻生效的设置，键是「分区 id.条目 id」：设计器自己的「画布」与各扩展分区里的条目写了用写的、没写取缺省值，
   * 基础分区（general.*）只有宿主或用户写了的键。
   */
  readonly settings: DesignerSettings
  /** 设计器的外框：面板的开关经它；外框还没建出来时为 undefined。 */
  readonly frame: XhDesignerFrameElement | undefined
}

/** 设计器的命令。 */
export type FlowDesignerCommand = DesignerCommand<FlowDesignerContext>

/** 导入的片段：一组节点与连线，整体挪到落点后按粘贴的规则换新 id 放进流程定义，选中它们并记一步撤销。 */
export interface FlowImportFragment {
  readonly nodes: readonly FlowNode[]
  /** 两端都在 nodes 里的连线；别的连线丢弃。 */
  readonly edges?: readonly FlowEdge[]
}

/** 导入的整份流程定义：换掉当前定义并记一步撤销，视口随后适配。 */
export interface FlowImportDocument {
  readonly document: FlowDocument
}

/** 导入的结果：一个片段，或一整份流程定义。 */
export type FlowImportResult = FlowImportFragment | FlowImportDocument

/** 导入器：把粘贴、拖放或打开的文件换成片段或整份流程定义；返回 undefined 即什么都不放。 */
export type FlowDesignerImporter = DesignerImporter<FlowDesignerContext, FlowImportResult | undefined>

/** 导出时交给导出器的上下文：设计器的上下文，加上调用 export() 时给的选项。 */
export interface FlowExportContext extends FlowDesignerContext {
  readonly options: Readonly<Record<string, unknown>>
}

/** 导出器：把当前流程定义换成文件。 */
export type FlowDesignerExporter = DesignerExporter<FlowExportContext>

/** 物料来源：往物料面板里加的几组；条目被激活时 at 没有，拖到画布上放下时 at 是松手处的世界坐标。 */
export type FlowPaletteSource = DesignerPaletteSource<FlowDesignerContext, FlowPoint>

/** 流程设计器层的扩展：运行时层的全部字段，加上属性编辑器、命令、面板、物料来源、导入器、导出器与 setup。 */
export interface FlowDesignerExtension extends FlowRuntimeExtension, Omit<DesignerShellExtension<FlowDesignerContext, FlowPropertyEditor, FlowDocument, FlowRuleContext, FlowPoint>, 'importers' | 'exporters'> {
  /** 导入器：粘贴、拖放与打开文件共用，按扩展顺序问 accepts，第一个接下的导入；id 不能与别的导入器重名。 */
  readonly importers?: readonly FlowDesignerImporter[]
  /** 导出器：export(format) 交给登记了这种格式的第一个；id 不能与别的导出器重名。 */
  readonly exporters?: readonly FlowDesignerExporter[]
}

/** 取值是字符串的文案键。 */
type TextKey = { [K in keyof FlowDesignerTranslations]: FlowDesignerTranslations[K] extends string ? K : never }[keyof FlowDesignerTranslations]

/** 共用命令文案里取值是字符串的键。 */
type SharedTextKey = { [K in keyof DesignerCommandsTranslations]: DesignerCommandsTranslations[K] extends string ? K : never }[keyof DesignerCommandsTranslations]

const text = (key: TextKey) => (context: FlowDesignerContext): string => context.translations[key]
const shared = (key: SharedTextKey) => (context: FlowDesignerContext): string => context.commandTranslations[key]
const editable = (test: (designer: XhFlowDesigner) => boolean) => ({ designer }: FlowDesignerContext): boolean => !designer.readonly && test(designer)
const selectedNodes = (designer: XhFlowDesigner): number => designer.getSelection().nodes.length

/** 选中的连线里有带手动拐点的。 */
function selectedVertices(designer: XhFlowDesigner): boolean {
  const selected = new Set(designer.getSelection().edges)
  return designer.schema.edges.some(edge => selected.has(edge.id) && edge.vertices !== undefined)
}

/** 内置命令与内置面板要用、又不公开的设计器能力：历史栈、历史记录的文案与确认框。 */
export interface FlowDesignerInternals {
  readonly history: () => History<FlowDocument, FlowOperation>
  readonly historyTranslations: () => DesignerHistoryTranslations
  readonly confirm: (options: DesignerHistoryConfirm) => Promise<boolean>
  /** 流程结构面板的树：节点为行，从它出去的连线列在下面。 */
  readonly outline: () => readonly DesignerOutlineNode[]
  /** 在画布上标出一个节点或一条连线，undefined 撤掉。 */
  readonly highlight: (target: FlowOutlineTarget | undefined) => void
}

/** 流程结构里一行对应的对象。 */
export interface FlowOutlineTarget {
  readonly kind: 'node' | 'edge'
  readonly id: string
}

/** 流程结构里一行的 id：节点与连线的 id 各成一套，前面带上种类。 */
export function flowOutlineRowId(target: FlowOutlineTarget): string {
  return `${target.kind}:${target.id}`
}

/** 行 id 换回对象；不是这样写的 id 为 undefined。 */
export function flowOutlineTarget(row: string): FlowOutlineTarget | undefined {
  const at = row.indexOf(':')
  const kind = row.slice(0, at)
  return at > 0 && (kind === 'node' || kind === 'edge') ? { kind, id: row.slice(at + 1) } : undefined
}

/** 设计器 → 它不公开的能力；设计器建出时登记，内置的历史命令与历史面板经它取。 */
export const DESIGNER_INTERNALS = new WeakMap<XhFlowDesigner, FlowDesignerInternals>()

function internalsOf(designer: XhFlowDesigner): FlowDesignerInternals {
  const internals = DESIGNER_INTERNALS.get(designer)
  if (!internals)
    throw new Error('[flow-designer] this designer has no internals registered')
  return internals
}

/** 设计器 → 把它画面上的流程图导出成图片；设计器建出时登记，内置的图片导出器经它取图。 */
export const IMAGE_RENDERERS = new WeakMap<XhFlowDesigner, (format: FlowImageFormat, options: FlowImageExportOptions) => Promise<Blob>>()

/** 内置的图片导出器：svg 与 png，选项见 FlowImageExportOptions。 */
const IMAGE_EXPORTER: FlowDesignerExporter = {
  id: '@xihan-flow/designer.image',
  label: context => context.translations.exportImage,
  formats: ['svg', 'png'],
  export: (format, context) => {
    const render = IMAGE_RENDERERS.get(context.designer)
    if (!render)
      return Promise.reject(new RangeError('[flow-designer] this designer cannot render images'))
    return render(format as FlowImageFormat, context.options as FlowImageExportOptions)
  },
}

/** 导出命令：导出图片后派发可取消的 export 事件，没被取消就存成 flow.<格式> 下载。 */
async function saveImage(designer: XhFlowDesigner, format: FlowImageFormat): Promise<void> {
  const blob = await designer.export(format) as Blob
  const event = new CustomEvent('export', { detail: { format, blob }, bubbles: true, composed: true, cancelable: true })
  if (!designer.dispatchEvent(event))
    return
  const doc = designer.ownerDocument
  const url = URL.createObjectURL(blob)
  const link = doc.createElement('a')
  link.href = url
  link.download = `flow.${format}`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** 内置命令 help 打开的帮助页：流程文档站的设计器一页。 */
export const FLOW_DESIGNER_HELP_URL = 'https://flow.docs.xihanfun.com/guide/designer'

/**
 * 设计器登记的面板与画布浮动件的 id：宿主写 defaultLayout、settingsPolicy（layout.panels.<面板 id>）时用它，不手写字符串。
 * 各有一条开关命令 panel:<面板 id>。
 */
export const FLOW_PANELS = { palette: 'palette', outline: 'outline', properties: 'properties', issues: 'issues', minimap: 'minimap', history: 'history' } as const

/** 外框上直接登记的面板与画布浮动件；流程结构、历史这类内置扩展的面板，开关命令随扩展面板一起生成。 */
const FRAME_PANELS = [FLOW_PANELS.palette, FLOW_PANELS.properties, FLOW_PANELS.issues, FLOW_PANELS.minimap]

/**
 * 内置命令：打开文件、撤销重做、剪贴板、选择、对齐分布、布局、缩放、导出图片，以及 designer-shell 内置的面板、设置、帮助、
 * 开始引导与编辑 JSON，各带图标；
 * 每块面板另有一条开关命令。四款都有的通用命令取 designer-shell 的共用文案，流程专属的取设计器文案；会删掉内容的删除写 danger 语气。
 */
const BUILTIN_COMMANDS: readonly FlowDesignerCommand[] = [
  { id: 'open-file', label: text('openFile'), icon: FolderOpenIcon, enabled: editable(d => d.canImport), run: ({ designer }) => designer.openFile() },
  // 撤销、重做与清空历史用 designer-shell 的四款共用命令：只读时不可用，清空先弹确认框，做完经外框播报
  ...designerHistoryCommands<FlowDesignerContext>({
    history: ({ designer }) => internalsOf(designer).history(),
    disabled: ({ designer }) => designer.readonly === true,
    translations: context => context.commandTranslations,
    historyTranslations: ({ designer }) => internalsOf(designer).historyTranslations(),
    confirm: ({ designer }, options) => internalsOf(designer).confirm(options),
    announce: (context, message) => context.frame?.announce(message),
    icons: { undo: UndoIcon, redo: RedoIcon, clearHistory: EraserIcon },
  }),
  { id: 'cut', label: shared('cut'), icon: ScissorsIcon, enabled: editable(d => selectedNodes(d) > 0), run: ({ designer }) => designer.cut() },
  { id: 'copy', label: shared('copy'), icon: CopyIcon, enabled: ({ designer }) => selectedNodes(designer) > 0, run: ({ designer }) => designer.copy() },
  { id: 'paste', label: shared('paste'), icon: ClipboardIcon, enabled: editable(d => d.canPaste), run: ({ designer }) => designer.paste() },
  { id: 'duplicate', label: shared('duplicate'), icon: CopyPlusIcon, shortcut: ['Mod', 'D'], enabled: editable(d => selectedNodes(d) > 0), run: ({ designer }) => designer.duplicate() },
  {
    id: 'delete',
    label: shared('delete'),
    icon: TrashIcon,
    tone: 'danger',
    shortcut: ['Delete'],
    enabled: editable(d => selectedNodes(d) + d.getSelection().edges.length > 0),
    run: ({ designer }) => designer.deleteSelection(),
  },
  {
    id: 'select-all',
    label: shared('selectAll'),
    icon: SquareDashedIcon,
    shortcut: ['Mod', 'A'],
    enabled: ({ designer }) => designer.schema.nodes.length > 0,
    run: ({ designer }) => designer.select({ nodes: designer.schema.nodes.map(node => node.id), edges: designer.schema.edges.map(edge => edge.id) }),
  },
  { id: 'align-left', label: shared('alignLeft'), icon: AlignObjectsLeftIcon, enabled: editable(d => selectedNodes(d) >= 2), run: ({ designer }) => designer.align('left') },
  { id: 'align-center', label: shared('alignCenter'), icon: AlignObjectsCenterIcon, enabled: editable(d => selectedNodes(d) >= 2), run: ({ designer }) => designer.align('center-vertical') },
  { id: 'align-right', label: shared('alignRight'), icon: AlignObjectsRightIcon, enabled: editable(d => selectedNodes(d) >= 2), run: ({ designer }) => designer.align('right') },
  { id: 'align-top', label: shared('alignTop'), icon: AlignObjectsTopIcon, enabled: editable(d => selectedNodes(d) >= 2), run: ({ designer }) => designer.align('top') },
  { id: 'align-middle', label: shared('alignMiddle'), icon: AlignObjectsMiddleIcon, enabled: editable(d => selectedNodes(d) >= 2), run: ({ designer }) => designer.align('center-horizontal') },
  { id: 'align-bottom', label: shared('alignBottom'), icon: AlignObjectsBottomIcon, enabled: editable(d => selectedNodes(d) >= 2), run: ({ designer }) => designer.align('bottom') },
  { id: 'distribute-horizontal', label: shared('distributeHorizontal'), icon: DistributeHorizontalIcon, enabled: editable(d => selectedNodes(d) >= 3), run: ({ designer }) => designer.distribute('horizontal') },
  { id: 'distribute-vertical', label: shared('distributeVertical'), icon: DistributeVerticalIcon, enabled: editable(d => selectedNodes(d) >= 3), run: ({ designer }) => designer.distribute('vertical') },
  {
    id: 'align-menu',
    label: text('alignMenu'),
    icon: AlignObjectsLeftIcon,
    enabled: editable(d => selectedNodes(d) >= 2),
    menu: () => ['align-left', 'align-center', 'align-right', 'align-top', 'align-middle', 'align-bottom', 'separator', 'distribute-horizontal', 'distribute-vertical'],
  },
  { id: 'auto-layout', label: text('autoLayout'), icon: WorkflowIcon, enabled: editable(d => d.schema.nodes.length > 0), run: ({ designer }) => designer.autoLayout() },
  {
    id: 'clear-vertices',
    label: text('clearVertices'),
    icon: EraserIcon,
    enabled: editable(selectedVertices),
    run: ({ designer }) => {
      const selected = new Set(designer.getSelection().edges)
      designer.execute(designer.schema.edges
        .filter(edge => selected.has(edge.id) && edge.vertices !== undefined)
        .map(edge => ({ type: 'updateEdge', id: edge.id, patch: { vertices: null } })))
    },
  },
  { id: 'zoom-out', label: shared('zoomOut'), icon: ZoomOutIcon, shortcut: ['-'], run: ({ designer }) => designer.zoomOut() },
  { id: 'zoom-in', label: shared('zoomIn'), icon: ZoomInIcon, shortcut: ['+'], run: ({ designer }) => designer.zoomIn() },
  { id: 'zoom-to-fit', label: shared('zoomToFit'), icon: MaximizeIcon, shortcut: ['0'], run: ({ designer }) => designer.zoomToFit() },
  { id: 'zoom-to-actual', label: shared('zoomToActual'), icon: ZoomResetIcon, run: ({ designer }) => designer.zoomToActual() },
  { id: 'export-png', label: text('exportPng'), icon: FileImageIcon, enabled: ({ designer }) => designer.schema.nodes.length > 0, run: ({ designer }) => void saveImage(designer, 'png') },
  { id: 'export-svg', label: text('exportSvg'), icon: FileCodeIcon, enabled: ({ designer }) => designer.schema.nodes.length > 0, run: ({ designer }) => void saveImage(designer, 'svg') },
  ...designerShellCommands<FlowDesignerContext>({
    translations: context => context.commandTranslations,
    frame: context => context.frame,
    openSettings: ({ designer }) => designer.openSettings(),
    helpUrl: () => FLOW_DESIGNER_HELP_URL,
    startTour: ({ designer }) => designer.startTour(),
    openJsonEditor: ({ designer }) => designer.openJsonEditor(),
    icons: { panels: PanelLeftIcon, settings: SettingsIcon, help: CircleHelpIcon, editJson: FileCodeIcon },
  }),
  ...designerPanelCommands<FlowDesignerContext>({ panels: FRAME_PANELS, frame: context => context.frame }),
]

/** 一组行 id 换成设计器的选择。 */
function selectionOf(rows: readonly string[]): { nodes: string[], edges: string[] } {
  const targets = rows.flatMap(row => flowOutlineTarget(row) ?? [])
  return { nodes: targets.filter(target => target.kind === 'node').map(target => target.id), edges: targets.filter(target => target.kind === 'edge').map(target => target.id) }
}

/** 画布上此刻的选择换成流程结构的行 id。 */
function outlineSelection(designer: XhFlowDesigner): string[] {
  const { nodes, edges } = designer.getSelection()
  return [...nodes.map(id => flowOutlineRowId({ kind: 'node', id })), ...edges.map(id => flowOutlineRowId({ kind: 'edge', id }))]
}

/**
 * 流程结构面板：节点为行，从它出去的连线列在下面、缺省收起，没有名称的写「种类名 · id」。面板交来的整份选中换成画布的选择
 * （节点与连线可以一起选，空数组全部取消），只显露新选上的第一行；悬停时在画布上标出，删除走设计器的删除。
 * 缺省停在左栏物料下面，标题与帮助换成流程的说法。行不能挪。
 */
const OUTLINE_PANEL = createOutlinePanel<FlowDesignerContext>({
  nodes: ({ designer }) => internalsOf(designer).outline(),
  selection: ({ designer }) => outlineSelection(designer),
  select: ({ designer }, rows) => {
    const before = new Set(outlineSelection(designer))
    designer.select(selectionOf(rows))
    const first = flowOutlineTarget(rows.find(row => !before.has(row)) ?? '')
    if (first?.kind === 'node')
      designer.revealNode(first.id)
    else if (first?.kind === 'edge')
      designer.revealEdge(first.id)
  },
  highlight: ({ designer }, row) => internalsOf(designer).highlight(row === null ? undefined : flowOutlineTarget(row)),
  remove: ({ designer }, rows) => {
    if (designer.readonly === true)
      return
    designer.select(selectionOf(rows))
    designer.deleteSelection()
  },
}, {
  region: { icon: ListTreeIcon },
  readonly: ({ designer }) => designer.readonly === true,
  translations: () => (resolveXhConfig(null).translations?.['xh-flow-designer']?.outline ?? DEFAULT_FLOW_DESIGNER_TRANSLATIONS.outline),
})

/** 历史记录面板：列出撤销历史，选一步就跳过去；缺省停在右栏属性下面、缺省隐藏，面板头是清空历史。 */
const HISTORY_PANEL = createHistoryPanel<FlowDesignerContext>({
  snapshot: ({ designer }) => snapshotHistory(internalsOf(designer).history()),
  goTo: ({ designer }, position) => {
    if (designer.readonly !== true)
      internalsOf(designer).history().goTo(position)
  },
  announce: (context, message) => context.frame?.announce(message),
}, { region: { icon: HistoryIcon }, readonly: ({ designer }) => designer.readonly === true })

function tourStep(key: FlowTourStepKey, target: DesignerTourTarget, order: number): DesignerTourStep<FlowDesignerContext> {
  return {
    id: `flow.${key}`,
    target,
    order,
    title: ({ translations }) => translations.tourSteps[key].title,
    description: ({ translations }) => translations.tourSteps[key].description,
  }
}

/** 新手引导里流程自己的几步，排在通用步骤之后：顶栏的插入钮、连线（指向第一个端口）与自动布局。目标看不见的那步由零件跳过。 */
export const FLOW_TOUR_STEPS: readonly DesignerTourStep<FlowDesignerContext>[] = [
  tourStep('insert', { region: 'header' }, 100),
  tourStep('connect', { selector: '[data-part="port"]' }, 110),
  tourStep('autoLayout', { command: 'auto-layout' }, 120),
]

/** 设计器的内置扩展：内置命令、图片导出器、流程结构与历史记录两块面板、引导步骤。节点类型、连线属性等 core 层的内置部分在 FLOW_CORE_EXTENSION 里。 */
export const FLOW_DESIGNER_EXTENSION: FlowDesignerExtension = {
  id: '@xihan-flow/designer',
  commands: BUILTIN_COMMANDS,
  exporters: [IMAGE_EXPORTER],
  panels: [OUTLINE_PANEL, HISTORY_PANEL],
  tourSteps: FLOW_TOUR_STEPS,
}

/** 命令表并上扩展面板的开关命令 panel:<区名>；扩展自己登记了同名命令时抛 DesignerExtensionError。 */
function withPanelCommands(commands: DesignerCommandTable<FlowDesignerContext>, extensions: readonly FlowDesignerExtension[]): DesignerCommandTable<FlowDesignerContext> {
  const panels = extensions.flatMap(extension => (extension.panels ?? []).map(panel => panel.region.name))
  if (panels.length === 0)
    return commands
  const table = new Map(commands)
  for (const command of designerPanelCommands<FlowDesignerContext>({ panels, frame: context => context.frame })) {
    if (table.has(command.id)) {
      const owner = extensions.find(extension => extension.commands?.some(item => item.id === command.id))?.id ?? FLOW_DESIGNER_EXTENSION.id
      throw new DesignerExtensionError('command', command.id, [FLOW_DESIGNER_EXTENSION.id, owner])
    }
    table.set(command.id, command)
  }
  return table
}

/** 命令表并上顶栏的插入命令；扩展自己登记了同名命令时抛 DesignerExtensionError。 */
function withQuickInsert(commands: DesignerCommandTable<FlowDesignerContext>, nodeTypes: readonly FlowNodeType[], extensions: readonly FlowDesignerExtension[]): DesignerCommandTable<FlowDesignerContext> {
  const table = new Map(commands)
  for (const command of quickInsertCommands(nodeTypes)) {
    if (table.has(command.id)) {
      const owner = extensions.find(extension => extension.commands?.some(item => item.id === command.id))?.id ?? FLOW_DESIGNER_EXTENSION.id
      throw new DesignerExtensionError('command', command.id, [FLOW_DESIGNER_EXTENSION.id, owner])
    }
    table.set(command.id, command)
  }
  return table
}

/**
 * 工具栏的缺省排列；commandLayout 没写 toolbar 时用它，再把 placement 含 toolbar 的扩展命令追加成一组。
 * 有导入器时前面再加一组打开文件，见 flowToolbarLayout。
 */
export const FLOW_TOOLBAR_LAYOUT: readonly (readonly string[])[] = [
  ['undo', 'redo'],
  ['delete', 'duplicate'],
  ['align-left', 'align-center', 'align-right', 'align-top', 'align-middle', 'align-bottom', 'distribute-horizontal', 'distribute-vertical', 'auto-layout'],
  ['zoom-out', 'zoom-in', 'zoom-to-fit', 'zoom-to-actual'],
  ['export-png', 'export-svg'],
  ['panels', 'settings', 'help'],
]

/** 工具栏此刻的缺省排列：有导入器时在 FLOW_TOOLBAR_LAYOUT 前面多一组打开文件。 */
export function flowToolbarLayout(hasImporters: boolean): (readonly string[])[] {
  return hasImporters ? [['open-file'], ...FLOW_TOOLBAR_LAYOUT] : [...FLOW_TOOLBAR_LAYOUT]
}

/** 选中工具条落在哪类选中上：一个节点，或几个节点。只选了连线时没有选中工具条。 */
export type FlowSelectionSubject = 'node' | 'nodes'

/**
 * 选中工具条（命令落点 selection:<主体>）的缺省排列：都有创建副本、复制与删除；几个节点时前面多一个对齐与分布菜单
 * （align-menu，单条对齐命令照样能经 commandLayout 排上来）。
 */
export function flowSelectionLayout(subject: FlowSelectionSubject): string[][] {
  const common = ['duplicate', 'copy', 'delete']
  return subject === 'nodes' ? [['align-menu'], common] : [common]
}

/** 右键菜单落在哪类对象上。 */
export type FlowMenuSubject = 'node' | 'edge' | 'blank'

/** 右键菜单的缺省排列：节点菜单在选中两个以上时加对齐，三个以上时加分布；空白处的末尾是编辑 JSON。 */
export function flowMenuLayout(subject: FlowMenuSubject, selectedNodes: number): string[][] {
  if (subject === 'edge')
    return [['delete', 'clear-vertices']]
  if (subject === 'blank')
    return [['paste', 'select-all'], ['auto-layout', 'zoom-to-fit'], ['edit-json']]
  const groups = [['cut', 'copy', 'duplicate', 'delete']]
  if (selectedNodes >= 2)
    groups.push(['align-left', 'align-center', 'align-right', 'align-top', 'align-middle', 'align-bottom'])
  if (selectedNodes >= 3)
    groups.at(-1)!.push('distribute-horizontal', 'distribute-vertical')
  return groups
}

/** 一组设计器扩展合出的东西：交给 core 函数的列表、运行时模型、命令表、属性编辑器表、导入器与导出器。 */
export interface FlowDesignerModel {
  /** 设计器内置扩展在前、传入的在后；校验与编辑器都拿这一份。 */
  readonly list: readonly FlowDesignerExtension[]
  /** 再加上 core 层内置扩展的全部扩展，面板与命令按它的顺序。 */
  readonly extensions: readonly FlowDesignerExtension[]
  /** 运行时模型：节点类型、属性与节点渲染。 */
  readonly runtime: FlowRuntimeModel
  /** 命令 id → 命令，内置在前。 */
  readonly commands: DesignerCommandTable<FlowDesignerContext>
  /** 各扩展登记的属性编辑器叠成的一张表。 */
  readonly editors: PropertyEditorTable<FlowPropertyEditor>
  /** 各扩展的导入器，按扩展顺序。 */
  readonly importers: readonly FlowDesignerImporter[]
  /** 各扩展的导出器，按扩展顺序。 */
  readonly exporters: readonly FlowDesignerExporter[]
  /** 各扩展登记的设置分区，按扩展顺序。 */
  readonly settings: readonly DesignerSettingsSection[]
  /** 新手引导里设计器与各扩展的步骤，按登记顺序；designer-shell 的通用步骤由零件自带。 */
  readonly tourSteps: readonly DesignerTourStep<FlowDesignerContext>[]
  /** 各扩展的物料来源，按 order 排。 */
  readonly paletteSources: readonly FlowPaletteSource[]
}

/**
 * 顶栏的插入快捷钮：节点类型给了 quickInsert 就有一条，按它从小到大排；id 是 insert:<类型>，钮上图标下面写显示名，
 * 名字是「添加…」。只读时、或这种节点已到 maxCount 时不可用。
 */
function quickInsertCommands(nodeTypes: readonly FlowNodeType[]): FlowDesignerCommand[] {
  return nodeTypes
    .filter(type => type.quickInsert !== undefined)
    .sort((a, b) => a.quickInsert! - b.quickInsert!)
    .map((type): FlowDesignerCommand => {
      const name = type.label ?? type.type
      return {
        id: `insert:${type.type}`,
        label: ({ translations }) => translations.insertNode(name),
        shortLabel: name,
        ...(type.icon ? { icon: type.icon } : {}),
        placement: ['header'],
        enabled: ({ designer }) => !designer.readonly && (type.maxCount === undefined || designer.schema.nodes.filter(node => node.type === type.type).length < type.maxCount),
        run: ({ designer }) => void designer.addNode(type.type),
      }
    })
}

/** 合出设计器用的模型；editors 是垫在各扩展之下的内建编辑器。任何一处重名（含引导步骤 id 重名或用了 shell. 前缀、物料来源 id 重名）都抛 DesignerExtensionError。 */
export function createFlowDesignerModel(extensions: readonly FlowDesignerExtension[], editors?: PropertyEditorLayer<FlowPropertyEditor>): FlowDesignerModel {
  const list = [FLOW_DESIGNER_EXTENSION, ...extensions]
  const runtime = createFlowRuntimeModel(list)
  const all = runtime.extensions as readonly FlowDesignerExtension[]
  return {
    list,
    extensions: all,
    runtime,
    commands: withPanelCommands(withQuickInsert(extensionCommands(all), runtime.nodeTypes.types, all), all),
    editors: extensionEditors<FlowPropertyEditor>(editors, all),
    importers: all.flatMap(extension => extension.importers ?? []),
    exporters: all.flatMap(extension => extension.exporters ?? []),
    // 设计器自己的「画布」分区占着 flow，扩展的分区与它、与内建的 general 或彼此重名都抛错
    settings: collectSettingsSections([{ id: FLOW_DESIGNER_EXTENSION.id, settings: [{ id: FLOW_SETTINGS_SECTION, label: FLOW_SETTINGS_SECTION, items: [] }] }, ...all]).slice(1),
    tourSteps: collectTourSteps(all),
    paletteSources: collectPaletteSources(all),
  }
}
