/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 设计器层的扩展：在运行时层之上加属性编辑器、命令、面板、导入器、导出器与装上时的回调；内置命令也写成一个扩展。

import type { FlowDocument, FlowEdge, FlowNode, FlowNodeType, FlowRuleContext } from '@xihan-flow/core'
import type { FlowDesignerTranslations, FlowImageExportOptions, FlowImageFormat, FlowRuntimeExtension, FlowRuntimeModel } from '@xihan-flow/runtime'
import type { DesignerCommand, DesignerExporter, DesignerImporter } from '@xihan-ui/designer-kit'
import type { PropertyEditorLayer, PropertyEditorTable } from '@xihan-ui/designer-kit/properties'
import type { DesignerCommandsTranslations, DesignerCommandTable, DesignerSettings, DesignerSettingsSection, DesignerShellExtension, XhDesignerFrameElement } from '@xihan-ui/designer-shell'
import type { XhFlowDesigner } from './flow-designer'
import type { FlowPropertyEditor } from './panels/properties'
import { createFlowRuntimeModel } from '@xihan-flow/runtime'
import { DesignerExtensionError, extensionCommands, extensionEditors } from '@xihan-ui/designer-kit'
import { collectSettingsSections, designerShellCommands } from '@xihan-ui/designer-shell'
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

/** 流程设计器层的扩展：运行时层的全部字段，加上属性编辑器、命令、面板、导入器、导出器与 setup。 */
export interface FlowDesignerExtension extends FlowRuntimeExtension, Omit<DesignerShellExtension<FlowDesignerContext, FlowPropertyEditor, FlowDocument, FlowRuleContext>, 'importers' | 'exporters'> {
  /** 导入器：粘贴、拖放与打开文件共用，按扩展顺序问 accepts，第一个接下的导入；id 不能与别的导入器重名。 */
  readonly importers?: readonly FlowDesignerImporter[]
  /** 导出器：export(format) 交给登记了这种格式的第一个；id 不能与别的导出器重名。 */
  readonly exporters?: readonly FlowDesignerExporter[]
}

/** 取值是字符串的文案键。 */
type TextKey = { [K in keyof FlowDesignerTranslations]: FlowDesignerTranslations[K] extends string ? K : never }[keyof FlowDesignerTranslations]

const text = (key: TextKey) => (context: FlowDesignerContext): string => context.translations[key]
const shared = (key: keyof DesignerCommandsTranslations) => (context: FlowDesignerContext): string => context.commandTranslations[key]
const editable = (test: (designer: XhFlowDesigner) => boolean) => ({ designer }: FlowDesignerContext): boolean => !designer.readonly && test(designer)
const selectedNodes = (designer: XhFlowDesigner): number => designer.getSelection().nodes.length

/** 选中的连线里有带手动拐点的。 */
function selectedVertices(designer: XhFlowDesigner): boolean {
  const selected = new Set(designer.getSelection().edges)
  return designer.schema.edges.some(edge => selected.has(edge.id) && edge.vertices !== undefined)
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
 * 内置命令：打开文件、撤销重做、剪贴板、选择、对齐分布、布局、缩放、导出图片，以及 designer-shell 内置的设置与帮助，各带图标。四款都有的通用命令取 designer-shell 的
 * 共用文案，流程专属的取设计器文案；会删掉内容的删除写 danger 语气。
 */
const BUILTIN_COMMANDS: readonly FlowDesignerCommand[] = [
  { id: 'open-file', label: text('openFile'), icon: FolderOpenIcon, enabled: editable(d => d.canImport), run: ({ designer }) => designer.openFile() },
  { id: 'undo', label: shared('undo'), icon: UndoIcon, shortcut: ['Mod', 'Z'], enabled: editable(d => d.canUndo), run: ({ designer }) => designer.undo() },
  { id: 'redo', label: shared('redo'), icon: RedoIcon, shortcut: ['Mod', 'Shift', 'Z'], enabled: editable(d => d.canRedo), run: ({ designer }) => designer.redo() },
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
    icons: { panels: PanelLeftIcon, settings: SettingsIcon, help: CircleHelpIcon },
  }),
]

/** 设计器的内置扩展：内置命令与图片导出器。节点类型、连线属性等 core 层的内置部分在 FLOW_CORE_EXTENSION 里。 */
export const FLOW_DESIGNER_EXTENSION: FlowDesignerExtension = {
  id: '@xihan-flow/designer',
  commands: BUILTIN_COMMANDS,
  exporters: [IMAGE_EXPORTER],
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

/** 右键菜单落在哪类对象上。 */
export type FlowMenuSubject = 'node' | 'edge' | 'blank'

/** 右键菜单的缺省排列：节点菜单在选中两个以上时加对齐，三个以上时加分布。 */
export function flowMenuLayout(subject: FlowMenuSubject, selectedNodes: number): string[][] {
  if (subject === 'edge')
    return [['delete', 'clear-vertices']]
  if (subject === 'blank')
    return [['paste', 'select-all'], ['auto-layout', 'zoom-to-fit']]
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

/** 合出设计器用的模型；editors 是垫在各扩展之下的内建编辑器。任何一处重名都抛 DesignerExtensionError。 */
export function createFlowDesignerModel(extensions: readonly FlowDesignerExtension[], editors?: PropertyEditorLayer<FlowPropertyEditor>): FlowDesignerModel {
  const list = [FLOW_DESIGNER_EXTENSION, ...extensions]
  const runtime = createFlowRuntimeModel(list)
  const all = runtime.extensions as readonly FlowDesignerExtension[]
  return {
    list,
    extensions: all,
    runtime,
    commands: withQuickInsert(extensionCommands(all), runtime.nodeTypes.types, all),
    editors: extensionEditors<FlowPropertyEditor>(editors, all),
    importers: all.flatMap(extension => extension.importers ?? []),
    exporters: all.flatMap(extension => extension.exporters ?? []),
    // 设计器自己的「画布」分区占着 flow，扩展的分区与它、与内建的 general 或彼此重名都抛错
    settings: collectSettingsSections([{ id: FLOW_DESIGNER_EXTENSION.id, settings: [{ id: FLOW_SETTINGS_SECTION, label: FLOW_SETTINGS_SECTION, items: [] }] }, ...all]).slice(1),
  }
}
