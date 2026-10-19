/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// <xh-flow-designer>：流程设计器。顶部工具栏、左侧物料面板、中间画布（右下角浮着小地图）、右侧属性面板与底部问题列表；
// 画布上点选、Shift 点选追加、
// 拖动节点（吸附网格与对齐线，一次拖动记一步撤销）、Shift 拖空白框选、拖空白平移、从端口拖出连线，
// 选中一条连线后拖端点改连、拖拐点挪动、拖线段中点加拐点、双击拐点删掉它，
// 物料拖进画布新建节点；Ctrl / ⌘ + 滚轮缩放，键盘删除、撤销重做、复制粘贴与微移。
// 右键节点、连线或空白处弹出内置菜单，宿主取消对应的 *-contextmenu 事件即不弹。
// 节点类型、节点渲染、属性编辑器、命令、面板、导入器与导出器都从 extensions 来，内置命令也是一个扩展；工具栏与菜单的排列可由 commandLayout 改写。
// 粘贴、拖进画布的外部内容与 openFile() 选的文件交给扩展的导入器，export() 交给扩展的导出器；openJsonEditor() 编辑整份流程定义的 JSON。
// 设置对话框（openSettings()）里是基础、布局、工具栏、设计器自己的「画布」、各扩展的分区与帮助、快捷键、关于三页，值经 settings
// 与 settings-change 交给宿主。第一次铺好画布后自动开始新手引导（autoTour 关掉，startTour() 随时重新开始）。
// 面板用 @xihan-ui/web-components 的元素，defineFlowDesigner() 会一并注册它们。

import type {
  FlowConnectionProblem,
  FlowDocument,
  FlowEdgeEnd,
  FlowEdgeRouter,
  FlowEndpoint,
  FlowIssue,
  FlowNode,
  FlowOperation,
  FlowPoint,
  FlowRect,
  FlowValidateOptions,
} from '@xihan-flow/core'
import type { FlowDesignerTranslations, FlowImageExportOptions, FlowImageFormat, FlowScene, FlowSceneEdge, FlowSceneNode } from '@xihan-flow/runtime'
import type { JsonValue } from '@xihan-ui/core/json'
import type { VisualEnvironmentStorageError } from '@xihan-ui/core/visual-environment'
import type { AlignMode, DesignerImportSource, DistributeAxis, ExecuteOptions, ExtensionHost, Viewport } from '@xihan-ui/designer-kit'
import type { PropertyEditorLayer, PropertySwatchOption } from '@xihan-ui/designer-kit/properties'
import type {
  CommandToolbar,
  DesignerCommandLayout,
  DesignerCommandsTranslations,
  DesignerFrameEventMap,
  DesignerFrameRegion,
  DesignerHistoryTranslations,
  DesignerIssueItem,
  DesignerJsonEditorEventMap,
  DesignerLayout,
  DesignerLayoutPolicy,
  DesignerOutlineNode,
  DesignerPaletteDragPayload,
  DesignerPanelHost,
  DesignerSettings,
  DesignerSettingsEventMap,
  DesignerSettingsHost,
  DesignerSettingsPolicy,
  DesignerSettingsSection,
  DesignerSnapOptions,
  DesignerStatusItem,
  DesignerTransformEventMap,
  DropOver,
  PanRequestDetail,
} from '@xihan-ui/designer-shell'
import type { PointerSession } from '@xihan-ui/pointer'
import type { KeyedChildren, PropertyValues } from '@xihan-ui/web-components/authoring'
import type { DialogService } from '@xihan-ui/web-components/services'
import type { FlowAutoLayoutOptions, FlowClipboard, FlowEditor, FlowSelection } from './editor'
import type { FlowDesignerContext, FlowDesignerExtension, FlowDesignerImporter, FlowDesignerModel, FlowImportFragment, FlowMenuSubject, FlowOutlineTarget, FlowSelectionSubject } from './extensions'
import type { FlowPropertyEditor } from './panels/properties'
import { getPortPosition, portAllows, readDocument, validateDocument } from '@xihan-flow/core'
import { XIHAN_WORKFLOW_START_VARIABLES } from '@xihan-flow/core/presets/xihan-workflow'
import { buildScene, createOrthogonalRouter, DEFAULT_FLOW_DESIGNER_TRANSLATIONS, defaultNodeRenderer, exportFlowImage } from '@xihan-flow/runtime'
import { detectKbdPlatform } from '@xihan-ui/core/hotkey'
import {
  centerOn,
  commandForShortcut,
  createExtensionHost,
  DEFAULT_VIEWPORT,
  expandRect,
  findImporter,
  fitRect,
  HISTORY_NUDGE_MERGE_WITHIN,
  hitTest,
  importerAccept,
  nudgeDelta,
  nudgeMergeKey,
  panBy,
  revealRect,
  screenToWorld,
  selectInMarquee,
  snapPointToGrid,
  unionRects,
  wheelZoomFactor,
  zoomBy,
} from '@xihan-ui/designer-kit'
import {
  applyToolbarCustomization,
  arrangeCommands,
  createCommandToolbar,
  createDesignerSettingsHost,
  createPanelHost,
  createStatusItem,
  defineDesignerShellElement,
  DESIGNER_COMMANDS_EN_US,
  DESIGNER_COMMON_KEYS,
  DESIGNER_FRAME_REGIONS,
  DESIGNER_HISTORY_EN_US,
  DESIGNER_SETTING_KEYS,
  DESIGNER_SHELL_COMMANDS,
  DESIGNER_TOUR_DONE_KEY,
  designerLayoutPolicy,
  importSources,
  registerDropTarget,
  renderCommandMenu,
  resolveSettings,
  resolveTourSteps,
  runCommand,
  shortcutSettingsSource,
  toolbarCustomizationOf,
  toolbarDisplayOf,
  toolbarSettingsSource,
  toolbarVisibleOf,
  tourDoneOf,
  XhDesignerFrameElement,
  XhDesignerIssuesElement,
  XhDesignerJsonEditorElement,
  XhDesignerMinimapElement,
  XhDesignerPaletteElement,
  XhDesignerPropertiesElement,
  XhDesignerSettingsElement,
  XhDesignerTourElement,
  XhDesignerTransformElement,
} from '@xihan-ui/designer-shell'
import { CircleAlertIcon, LayoutGridIcon, MapIcon, SlidersHorizontalIcon } from '@xihan-ui/icons'
import { createPointerSession, resolveSessionDoc, shouldActivate, wheelPixels } from '@xihan-ui/pointer'
import {
  BOOLEAN_CONVERTER,
  createGeneratedElement,
  emitEvent,
  GEN_ATTR,
  reconcile,
  registerElement,
  SVG_NS,
  XhConfigController,
  XhReactiveElement,
} from '@xihan-ui/web-components/authoring'
import { defineXhElement, XhCheckboxElement, XhContextMenuElement, XhFieldArrayElement, XhIconElement, XhToolbarElement } from '@xihan-ui/web-components/define'
import { createDialogService } from '@xihan-ui/web-components/services'
import { encodeFlowClipboard, readFlowClipboard, readFlowFragment, writeFlowClipboard } from './clipboard'
import { createFlowEditor } from './editor'
import { createFlowDesignerModel, DESIGNER_INTERNALS, FLOW_DESIGNER_EXTENSION, flowMenuLayout, flowSelectionLayout, flowToolbarLayout, IMAGE_RENDERERS } from './extensions'
import { describeFlowOperations, identitiesIn, nodesLabel } from './history-labels'
import { ContextMenuPanel } from './panels/context-menu'
import { flowIssueItems, IssuesPanel } from './panels/issues'
import { MinimapPanel } from './panels/minimap'
import { paletteNodeType, PalettePanel } from './panels/palette'
import { PropertiesPanel } from './panels/properties'
import { FLOW_SETTING_KEYS, flowSettingsSection } from './settings'
import { startVariablesEditor } from './start-variables'
import { FLOW_VERSION } from './version'

/** 设计器的标签名。 */
export const FLOW_DESIGNER_TAG = 'xh-flow-designer'

/** schema-change 的种类：执行操作、撤销、重做，或宿主装载了新定义。 */
export type FlowSchemaChangeKind = 'execute' | 'undo' | 'redo' | 'load'

/** 设计器派发的事件；x / y 为浏览器视口坐标。 */
export interface FlowDesignerEventMap {
  /** 流程定义变了：带新定义、这次的操作与种类；拖动等成组的修改在结束时合成一次派发，装载新定义时 operations 为空。 */
  'schema-change': CustomEvent<{ schema: FlowDocument, operations: readonly FlowOperation[], kind: FlowSchemaChangeKind }>
  /** 选中的节点与连线变了。 */
  'selection-change': CustomEvent<FlowSelection>
  /** 有没有未保存的修改变了。 */
  'dirty-change': CustomEvent<{ dirty: boolean }>
  /** 流程定义、扩展或校验选项变了之后重新校验，带全部问题。 */
  'issues-change': CustomEvent<{ issues: readonly FlowIssue[] }>
  /** 拖出或改连的连线违反连接约束，没有连上；带两端与全部问题。 */
  'connect-reject': CustomEvent<{ source: FlowEndpoint, target: FlowEndpoint, problems: readonly FlowConnectionProblem[] }>
  /** 双击了节点。 */
  'node-dblclick': CustomEvent<{ id: string }>
  /** 在节点上打开右键菜单，节点没被选中时先选中它；可以取消，取消后内置菜单与浏览器的右键菜单都不出现。 */
  'node-contextmenu': CustomEvent<{ id: string, x: number, y: number }>
  /** 在连线上打开右键菜单，连线没被选中时先选中它；可以取消。 */
  'edge-contextmenu': CustomEvent<{ id: string, x: number, y: number }>
  /** 在画布空白处打开右键菜单；可以取消。 */
  'blank-contextmenu': CustomEvent<{ x: number, y: number }>
  /** 视口变了：缩放、平移、适配与 setViewport 都会派发。 */
  'viewport-change': CustomEvent<{ viewport: Viewport }>
  /**
   * 导入没有成功：导入器抛了错，或给出的节点、连线或流程定义不合法、用了没登记的节点类型，importer 是导入器的 id；
   * openFile() 选的文件没有导入器接下时也派发，此时没有 importer。
   */
  'import-error': CustomEvent<{ importer?: string, source: DesignerImportSource, error: unknown }>
  /**
   * 工具栏的导出命令导出了图片，带格式与文件；可以取消，取消后设计器不自己下载，宿主拿 blob 自己存。
   * 没被取消时存成 flow.png 或 flow.svg 下载。
   */
  'export': CustomEvent<{ format: FlowImageFormat, blob: Blob }>
  /** 画布有焦点时按了 Ctrl / ⌘ + S；设计器不自己保存。 */
  'save': CustomEvent<Record<string, never>>
  /**
   * 在设置对话框里改了一条设置，或在外框上挪了面板（键是 layout.panels，值是整份布局）：设计器已换成
   * 新的 settings 并生效（主题、主题色、吸附与自动布局的选项、面板布局）；value 为 undefined 表示删掉这个键、回到缺省值。
   * 宿主存起来，下次赋回 settings。
   */
  'settings-change': CustomEvent<{ key: string, value: JsonValue | undefined, settings: DesignerSettings }>
  /** 读写 settingsStorageKey 指的本机存储失败（内容不是对象、无痕窗口、配额满）；设置留在内存里。 */
  'settings-storage-error': CustomEvent<VisualEnvironmentStorageError>
}

const LAYOUT_DIRECTIONS: readonly unknown[] = ['TB', 'BT', 'LR', 'RL']

const EMPTY_SCHEMA: FlowDocument = { version: 1, nodes: [], edges: [] }
const NO_EXTENSIONS: readonly FlowDesignerExtension[] = []
const ZOOM_STEP = 1.2
const PAN_STEP = 48
const FIT_PADDING = 24
/** 没给落点的新节点在视口中央被占时往右下错开的一步（世界坐标）。 */
const CASCADE_STEP = 24
/** 找空位最多错开几步，再找不到就放在最后一处。 */
const CASCADE_LIMIT = 256
const EDGE_LAYER_MARGIN = 32
/** 端口命中的屏幕距离（像素）。 */
const PORT_HIT_DISTANCE = 12
/** 连线控制柄。 */
const HANDLE_SELECTOR = '[data-part="edge-handle"], [data-part="vertex-handle"], [data-part="segment-handle"]'
/** 画布有焦点时接管的剪贴板事件。 */
const CLIPBOARD_EVENTS = ['copy', 'cut', 'paste'] as const

interface Layers {
  readonly frame: XhDesignerFrameElement
  readonly canvas: HTMLElement
  readonly root: HTMLElement
  readonly world: HTMLElement
  readonly edges: SVGSVGElement
  readonly labels: HTMLElement
  readonly nodes: HTMLElement
  readonly ports: HTMLElement
  readonly handles: HTMLElement
  readonly overlay: SVGSVGElement
  readonly dropPreview: HTMLElement
  readonly transform: XhDesignerTransformElement
  /** 工具栏区里的容器，放命令工具栏。 */
  readonly toolbar: HTMLElement
  readonly commandBar: CommandToolbar<FlowDesignerContext>
  /** 顶栏中段的插入快捷钮：有 header 位置的命令时才放进外框。 */
  readonly headerBar: CommandToolbar<FlowDesignerContext>
  /** 选中节点时浮在选中框上的选中工具条：可编辑、有选中的节点、排列不空时放进变换覆盖层。 */
  readonly selectionBar: CommandToolbar<FlowDesignerContext>
  readonly palette: PalettePanel
  readonly properties: PropertiesPanel
  readonly issues: IssuesPanel
  readonly minimap: MinimapPanel
  readonly menu: ContextMenuPanel
  /** 扩展登记的面板。 */
  readonly panels: DesignerPanelHost<FlowDesignerContext>
  /** 设置对话框。 */
  readonly settings: XhDesignerSettingsElement
  /** 新手引导。 */
  readonly tour: XhDesignerTourElement
  /** 编辑整份流程定义的 JSON 对话框。 */
  readonly jsonEditor: XhDesignerJsonEditorElement
  /** 状态栏左段：选中对象的信息。 */
  readonly selectionStatus: DesignerStatusItem
  /** 状态栏右段：缩放，点了回到 100%。 */
  readonly zoomStatus: DesignerStatusItem
}

interface Gesture {
  readonly kind: 'pan' | 'connect' | 'vertex'
  readonly session: PointerSession
  active: boolean
}

interface ConnectPreview {
  readonly from: FlowPoint
  readonly to: FlowPoint
  readonly valid: boolean | undefined
}

/** 流程设计器 <xh-flow-designer>：在画布上编辑流程定义。 */
export class XhFlowDesigner extends XhReactiveElement {
  static override properties = {
    readonly: { converter: BOOLEAN_CONVERTER },
    autoTour: { converter: BOOLEAN_CONVERTER, attribute: 'auto-tour' },
    grid: { attribute: false },
    defaultLayout: { attribute: false },
    paletteGroupOrder: { attribute: false },
    paletteGroupLabels: { attribute: false },
    propertyGroupOrder: { attribute: false },
    propertyGroupLabels: { attribute: false },
    commandLayout: { attribute: false },
    validateOptions: { attribute: false },
    router: { attribute: false },
    settings: { attribute: false },
    settingsPolicy: { attribute: false },
    settingsStorageKey: { attribute: 'settings-storage-key', converter: { fromAttribute: (value: string | null) => value ?? undefined } },
    brands: { attribute: false },
    registerBrand: { attribute: false },
    translations: { attribute: false },
  }

  /**
   * 只读：可以选择与浏览，不能修改；缺省 false。同名 attribute 三态：不写为缺省，写 "false" 为 false，
   * 其余写法（空串、"true" 等）为 true。
   */
  declare readonly: boolean | undefined
  /**
   * 设计器第一次显示出来、画布铺好之后自动开始新手引导，缺省开；藏着时不开始；设置里记过 help.tourDone（走完、跳过或关上过一次）时不再自动开始。
   * 写 false 关掉，start-tour 命令、帮助页的「开始引导」与 startTour() 照样能开始。同名 attribute auto-tour，写 "false" 是关。
   */
  declare autoTour: boolean | undefined
  /** 拖动与新建节点时吸附的网格边长，false 不吸附网格；缺省 16。 */
  declare grid: number | false
  /**
   * 面板布局的缺省：设置里还没有 layout.panels 时用它，「恢复默认布局」也回到它；不给按各面板登记的位置，全部显示。
   * 用户挪了面板、改了显隐或大小，整份布局写进设置的 layout.panels（DESIGNER_SETTING_KEYS.layout）并派发 settings-change。
   */
  declare defaultLayout: DesignerLayout | undefined
  /** 物料面板里先列出的类别及其顺序，其余类别按登记顺序排在后面。 */
  declare paletteGroupOrder: readonly string[] | undefined
  /** 物料面板的类别标题，缺省直接显示 category。 */
  declare paletteGroupLabels: Readonly<Record<string, string>> | undefined
  /** 属性面板里先列出的分组及其顺序，其余分组按首次出现的顺序排在后面。 */
  declare propertyGroupOrder: readonly string[] | undefined
  /** 属性面板的分组标题，缺省直接显示分组 id。 */
  declare propertyGroupLabels: Readonly<Record<string, string>> | undefined
  /**
   * 工具栏与各右键菜单的命令排列：toolbar、menu:node、menu:edge、menu:blank → 若干组命令 id。
   * 写了某个位置就只显示列出的命令；没写的位置用内置排列，再把 placement 含它的扩展命令追加成一组。
   */
  declare commandLayout: DesignerCommandLayout | undefined
  /** 校验选项：按问题码覆盖严重程度，扩展规则的问题码也认。 */
  declare validateOptions: Omit<FlowValidateOptions, 'extensions'> | undefined
  /** 连线路由器，缺省为直角路由。 */
  declare router: FlowEdgeRouter | undefined
  /**
   * 设置的值：扁平的键值，键是「分区 id.条目 id」，如 general.theme、flow.snap；没写的键取条目的缺省值。
   * 赋值即生效；用户在设置对话框里改了以后设计器换成新的一份并派发 settings-change。
   */
  declare settings: DesignerSettings | undefined
  /** 宿主对设置条目的管控：键是条目键或分区 id，hidden 不显示，locked 只读、说明换成「由所在系统管理」。 */
  declare settingsPolicy: DesignerSettingsPolicy | undefined
  /**
   * 设置存在根所在窗口 localStorage 的哪个键下：给了，连上文档时若没赋 settings 就从这里读，用户改了设置就写回去，
   * 标了 secret 的条目不存；读写失败派发 settings-storage-error。不给就不读写。同名 attribute settings-storage-key。
   */
  declare settingsStorageKey: string | undefined
  /** 设置里主题色的预设：value 是品牌 id（写成设计器根上的 data-brand），color 是色板格子的颜色。不给且没给 registerBrand 时没有主题色这一项。 */
  declare brands: readonly PropertySwatchOption[] | undefined
  /** 注册自定义主题色，形状与 @xihan-ui/tokens 的 registerBrand 相同；给了才许在设置里自定义主题色。 */
  declare registerBrand: ((id: string, color: string) => () => void) | undefined
  /** 元素自己的文案，压在全局配置之上。 */
  declare translations: Partial<FlowDesignerTranslations> | undefined

  readonly #config = new XhConfigController(this)
  #frameRegionsKey = ''
  #frameRegionList: readonly DesignerFrameRegion[] = DESIGNER_FRAME_REGIONS
  #frameRegionsModel: FlowDesignerModel | undefined
  #layoutPolicyKey = ''
  #layoutPolicy: DesignerLayoutPolicy | undefined
  readonly #keys: KeyedChildren = new WeakMap()
  #extensions: readonly FlowDesignerExtension[] | undefined
  /** 设计器内建、垫在各扩展之下的属性编辑器。 */
  readonly #builtinEditors: PropertyEditorLayer<FlowPropertyEditor> = {
    byControl: { [XIHAN_WORKFLOW_START_VARIABLES]: startVariablesEditor({ ownerDocument: () => this.ownerDocument, translations: () => this.#translations() }) },
  }

  #model: FlowDesignerModel = createFlowDesignerModel(NO_EXTENSIONS, this.#builtinEditors)
  /** 历史说明现取的文案与流程模型。 */
  readonly #labelSource = {
    translations: () => this.#translations(),
    model: () => this.#editor.model,
  }

  readonly #editor: FlowEditor = createFlowEditor({
    document: EMPTY_SCHEMA,
    extensions: this.#model.list,
    describe: (operations, before) => describeFlowOperations(operations, before, this.#labelSource),
  })

  readonly #host: ExtensionHost<FlowDesignerExtension> = createExtensionHost<FlowDesignerExtension, FlowDesignerContext>({
    builtins: [FLOW_DESIGNER_EXTENSION],
    context: () => this.#context(),
  })

  #platform: 'mac' | 'other' | undefined
  #layers: Layers | undefined
  #defaultRouter: FlowEdgeRouter | undefined
  #scene: FlowScene | undefined
  #sceneStale = true
  #viewport: Viewport = DEFAULT_VIEWPORT
  #autoFit = true
  #fitPending = true
  #gesture: Gesture | undefined
  #preview: ConnectPreview | undefined
  /** 框选开始前的选择（追加框选时保留）与框选是否已越过激活距离。 */
  #marqueeBase: readonly string[] = []
  #marqueeStarted = false
  #dropPreview: FlowRect | undefined
  #transactionOperations: FlowOperation[] = []
  #dirty = false
  #issuesScheduled = false
  #issues: readonly FlowIssue[] = []
  /** 节点 id → 落在它上面的问题里最严重的那一级。 */
  #issueLevels = new Map<string, 'error' | 'warning'>()
  #resizeObserver: ResizeObserver | undefined
  #settingsHost: DesignerSettingsHost | undefined
  #settingsHostOptions: readonly unknown[] = []
  #settingsSectionsKey = ''
  #settingsSectionList: readonly DesignerSettingsSection[] = []
  #settingsDialogKey = ''
  /** 此刻生效的设置：各分区没写的条目取了缺省值。 */
  #resolvedSettings: DesignerSettings = {}
  /** 交给设置对话框「工具栏」页的数据，内容没变不重设。 */
  #toolbarSourceKey = ''
  /** 交给引导的步骤与设置对话框帮助、快捷键、关于三页的数据，内容没变不重设。 */
  #tourStepsKey = ''
  #helpKey = ''
  /** 看过要不要自动开始引导了（每个元素只看一次）。 */
  #tourChecked = false
  /** 清空历史前的确认框服务：第一次要弹时建，元素移出文档时释放。 */
  #dialogs: DialogService | undefined
  /** 流程结构面板悬停的那一行在画布上标出的对象。 */
  #highlight: FlowOutlineTarget | undefined
  /** 流程结构的树：定义、文案或模型换了才重排。 */
  #outlineCache: { readonly document: FlowDocument, readonly t: FlowDesignerTranslations, readonly model: unknown, readonly nodes: readonly DesignerOutlineNode[] } | undefined

  constructor() {
    super()
    IMAGE_RENDERERS.set(this, (format, options) => this.#renderImage(format, options))
    DESIGNER_INTERNALS.set(this, {
      history: () => this.#editor.history,
      historyTranslations: () => this.#config.translations<DesignerHistoryTranslations>('xh-designer-history', DESIGNER_HISTORY_EN_US),
      confirm: (options) => {
        this.#dialogs ??= createDialogService()
        return this.#dialogs.confirm(options)
      },
      outline: () => this.#outline(),
      highlight: (target) => {
        if (target?.kind === this.#highlight?.kind && target?.id === this.#highlight?.id)
          return
        this.#highlight = target
        this.requestUpdate()
      },
    })
    this.grid = 16
    this.#editor.subscribe((change) => {
      if (change.kind === 'selection') {
        // 选中换了，接着的微移与属性修改另起一步
        this.#editor.seal()
        this.requestUpdate()
        emitEvent(this, 'selection-change', change.selection)
        return
      }
      if (change.cause === 'save') {
        this.#syncDirty()
        return
      }
      this.#sceneStale = true
      this.requestUpdate()
      if (change.cause === 'execute' && this.#editor.history.inTransaction) {
        this.#transactionOperations.push(...change.operations)
        return
      }
      if (change.cause === 'rollback') {
        this.#transactionOperations = []
        return
      }
      if (change.cause === 'commit') {
        const operations = this.#transactionOperations
        this.#transactionOperations = []
        if (operations.length > 0)
          this.#emitSchemaChange(operations, 'execute')
      }
      else if (change.cause === 'reset') {
        this.#emitSchemaChange([], 'load')
      }
      else if (change.cause === 'execute' || change.cause === 'undo' || change.cause === 'redo') {
        this.#emitSchemaChange(change.operations, change.cause)
      }
      this.#syncDirty()
      this.#scheduleIssues()
    })
  }

  /** 流程定义。赋值时装载、清空撤销历史并重新自动适配（赋回当前这一份不重新装载）；读取时得到当前定义。 */
  get schema(): FlowDocument {
    return this.#editor.document
  }

  set schema(value: FlowDocument) {
    if (value === this.#editor.document)
      return
    this.#startAutoFit()
    this.#editor.load(value)
  }

  /**
   * 扩展：节点类型、节点渲染、属性编辑器、命令、面板、导入器与导出器都从这里来，内置扩展自动排在最前。
   * 赋值时当场合并查重，冲突抛 DesignerExtensionError、什么都不变；各扩展的 setup 在元素连上文档时调用、断开时清理。
   * 同一个扩展对象换了引用当作卸下再装上，宿主要保持引用稳定。
   */
  get extensions(): readonly FlowDesignerExtension[] | undefined {
    return this.#extensions
  }

  set extensions(value: readonly FlowDesignerExtension[] | undefined) {
    if (value === this.#extensions)
      return
    const model = createFlowDesignerModel(value ?? NO_EXTENSIONS, this.#builtinEditors)
    this.#ensureLayers().panels.assign(model.extensions, this.#context())
    if (this.isConnected)
      this.#host.assign(value ?? NO_EXTENSIONS)
    const old = this.#extensions
    this.#extensions = value
    this.#model = model
    this.#editor.setExtensions(model.list)
    this.#sceneStale = true
    this.#scheduleIssues()
    this.requestUpdate('extensions', old)
  }

  /** 有可以撤销的一步。 */
  get canUndo(): boolean {
    return this.#editor.history.canUndo
  }

  /** 有可以重做的一步。 */
  get canRedo(): boolean {
    return this.#editor.history.canRedo
  }

  /** 剪贴板里有内容，paste() 能贴出东西。 */
  get canPaste(): boolean {
    return this.#editor.hasClipboard
  }

  /** 装了导入器：粘贴与拖进画布的外部内容、openFile() 选的文件都交给它们。 */
  get canImport(): boolean {
    return this.#model.importers.length > 0
  }

  /** 有未保存的修改。 */
  get dirty(): boolean {
    return this.#editor.history.dirty
  }

  override connectedCallback(): void {
    super.connectedCallback()
    const layers = this.#ensureLayers()
    for (const type of CLIPBOARD_EVENTS)
      this.ownerDocument.addEventListener(type, this.#onClipboard)
    if (typeof ResizeObserver !== 'undefined') {
      this.#resizeObserver ??= new ResizeObserver(() => this.#onResize())
      this.#resizeObserver.observe(layers.root)
    }
    this.#host.assign(this.#extensions ?? NO_EXTENSIONS)
    this.requestUpdate()
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#settingsHost?.dispose()
    this.#settingsHost = undefined
    this.#dialogs?.dispose()
    this.#dialogs = undefined
    for (const type of CLIPBOARD_EVENTS)
      this.ownerDocument.removeEventListener(type, this.#onClipboard)
    this.#resizeObserver?.disconnect()
    this.#cancelGesture()
    this.#host.dispose()
  }

  protected override update(changed: PropertyValues): void {
    super.update(changed)
    const layers = this.#ensureLayers()
    const t = this.#translations()
    this.#syncSettings(layers, t, changed)
    layers.menu.trigger.setAttribute('aria-label', t.label)
    if (changed.has('router'))
      this.#sceneStale = true
    if (changed.has('validateOptions'))
      this.#scheduleIssues()
    if (this.readonly)
      this.setAttribute('data-readonly', '')
    else
      this.removeAttribute('data-readonly')
    if (this.#sceneStale || !this.#scene) {
      this.#scene = buildScene(this.#editor.document, this.#editor.model.nodeTypes, { route: this.#route() })
      this.#sceneStale = false
    }
    const selection = this.#editor.selection
    this.#renderEdges(layers, new Set(selection.edges))
    this.#renderLabels(layers)
    this.#renderNodes(layers, new Set(selection.nodes))
    this.#renderPorts(layers)
    this.#renderHandles(layers)
    this.#renderOverlay(layers)
    this.#syncTransform(layers)
    this.#renderPanels(layers, t)
    this.#syncHelp(layers, t)
    if (!this.#fitIfPending())
      this.#applyViewport(false)
    this.#checkTour()
  }

  /** 画布第一次有了尺寸（铺好、显示出来）之后，看要不要自动开始新手引导；每个元素只看一次，藏着时不算，同一页里别的引导开着时不开始。 */
  #checkTour(): void {
    if (this.#tourChecked || this.#size() === undefined)
      return
    this.#tourChecked = true
    if (this.autoTour === false || tourDoneOf(this.settings))
      return
    void this.updateComplete.then(() => {
      if (this.isConnected && this.autoTour !== false && !tourDoneOf(this.settings))
        this.#layers?.tour.start()
    })
  }

  /**
   * 新手引导的步骤与设置对话框的帮助、快捷键、关于三页，按此刻的语言与命令表现算，内容没变不重设：
   * 帮助页是几段操作说明与「开始引导」「帮助」两颗钮；快捷键表从命令表生成，另加不是命令的几个键，「通用」里
   * 去掉流程没有的空格拖画布与选中工具条，方向键与 Esc 两行按流程的做法改写说明；关于页是流程设计器的版本与许可证，
   * 后面接扩展给的几行。
   */
  #syncHelp(layers: Layers, t: FlowDesignerTranslations): void {
    const context = this.#context()
    const model = this.#model
    const steps = resolveTourSteps(model.tourSteps, context)
    const stepsKey = JSON.stringify(steps)
    if (stepsKey !== this.#tourStepsKey) {
      this.#tourStepsKey = stepsKey
      layers.tour.steps = steps
    }
    const shared = context.commandTranslations
    const help = {
      notes: t.helpNotes,
      actions: [{ command: DESIGNER_SHELL_COMMANDS.startTour, label: shared.startTour }, { command: DESIGNER_SHELL_COMMANDS.help, label: shared.help }],
    }
    const shortcuts = shortcutSettingsSource(model.commands, context, {
      extensionCommands: (this.#extensions ?? NO_EXTENSIONS).flatMap(extension => (extension.commands ?? []).map(command => command.id)),
      commonKeys: DESIGNER_COMMON_KEYS
        .filter(key => key.id !== 'pan')
        .map(key => key.id === 'nudge' ? { ...key, label: t.shortcutNudge } : key.id === 'cancel' ? { ...key, label: t.shortcutCancel } : key),
      keys: [
        { label: shared.copy, keys: [['Mod', 'C']] },
        { label: shared.cut, keys: [['Mod', 'X']] },
        { label: shared.paste, keys: [['Mod', 'V']] },
        { label: shared.delete, keys: [['Backspace']] },
        { label: t.shortcutContextMenu, keys: [['Shift', 'F10'], ['ContextMenu']] },
        { label: t.shortcutSave, keys: [['Mod', 'S']] },
      ],
    })
    const about = { product: t.label, version: FLOW_VERSION, license: 'MIT', rows: model.list.flatMap(extension => extension.about ?? []) }
    const helpKey = JSON.stringify([help, shortcuts, about])
    if (helpKey !== this.#helpKey) {
      this.#helpKey = helpKey
      layers.settings.help = help
      layers.settings.shortcuts = shortcuts
      layers.settings.about = about
    }
  }

  /** 设置对话框帮助页里的钮：关上对话框，再跑那条命令（开始引导、打开帮助）。 */
  readonly #onSettingsCommand = (event: Event): void => {
    event.stopPropagation()
    const { command } = (event as DesignerSettingsEventMap['settings-command']).detail
    this.#ensureLayers().settings.open = false
    runCommand(this.#model.commands, command, this.#context())
  }

  /** 引导收起了（走完、跳过或关上）：设置里记下 help.tourDone，之后不再自动开始。 */
  readonly #onTourEnd = (): void => {
    if (tourDoneOf(this.settings))
      return
    const key = DESIGNER_TOUR_DONE_KEY
    this.#commitSettings({ key, value: true, settings: { ...this.settings, [key]: true } })
  }

  /** 执行一组操作并记为一步撤销；返回新的定义。 */
  execute(operations: readonly FlowOperation[], options?: ExecuteOptions): FlowDocument {
    return this.#editor.execute(operations, options)
  }

  /** 撤销一步；没有可撤销的返回 false。 */
  undo(): boolean {
    return this.#editor.undo()
  }

  /** 重做一步；没有可重做的返回 false。 */
  redo(): boolean {
    return this.#editor.redo()
  }

  /** 把当前状态记为已保存。 */
  markSaved(): void {
    this.#editor.history.markSaved()
  }

  /** 新建节点并选中：at 是节点中心的世界坐标，缺省放在视口中央（中央被占时往右下错开）；位置吸附网格。 */
  addNode(type: string, at?: FlowPoint): FlowNode {
    const nodeType = this.#editor.model.nodeTypes.get(type)
    if (!nodeType)
      throw new Error(`[flow-designer] node type "${type}" is not registered`)
    const topLeft = at
      ? this.#snapToGrid({ x: at.x - nodeType.size.width / 2, y: at.y - nodeType.size.height / 2 })
      : this.#cascadePlace(nodeType.size)
    return this.#editor.addNode(type, topLeft)
  }

  /** 换成选中这些节点与连线，没写的一类清空。 */
  select(selection: Partial<FlowSelection>): void {
    this.#editor.select(selection)
  }

  /** 当前选中的节点与连线。 */
  getSelection(): FlowSelection {
    return this.#editor.selection
  }

  /** 删除选中的节点（连带相连的连线）与连线；只读或没有选中时返回 false。 */
  deleteSelection(): boolean {
    return !this.readonly && this.#editor.deleteSelection()
  }

  /** 复制选中的节点与两端都被选中的连线，同时写进系统剪贴板；没有选中节点时返回 undefined。 */
  copy(): FlowClipboard | undefined {
    const copied = this.#editor.copy()
    if (copied)
      this.#writeSystemClipboard(copied)
    return copied
  }

  /** 复制选中内容后删除选中的节点与连线，同时写进系统剪贴板；只读或没有选中节点时返回 undefined。 */
  cut(): FlowClipboard | undefined {
    if (this.readonly)
      return undefined
    const copied = this.#editor.cut()
    if (copied)
      this.#writeSystemClipboard(copied)
    return copied
  }

  /**
   * 粘贴并选中粘贴出的对象，返回它们；每次比上一次多偏移一格网格（不吸附网格时 24）。
   * 缺省用设计器剪贴板里的内容，给了 clipboard 时它成为剪贴板内容；给了 at（世界坐标）时内容整体的中心放到那里、
   * 左上角吸附网格，不累加偏移。只读或剪贴板是空的时什么都不做，返回空选择。
   */
  paste(clipboard?: FlowClipboard, options: { readonly at?: FlowPoint } = {}): FlowSelection {
    if (this.readonly)
      return { nodes: [], edges: [] }
    const at = options.at
    if (at === undefined)
      return this.#editor.paste(clipboard, { offset: this.#gridStep() })
    const bounds = unionRects((clipboard ?? this.#editor.clipboard)?.nodes ?? [])
    if (!bounds)
      return { nodes: [], edges: [] }
    return this.#editor.paste(clipboard, { at: this.#snapToGrid({ x: at.x - bounds.width / 2, y: at.y - bounds.height / 2 }) })
  }

  /** 执行一条命令（内置的或扩展的）：命令存在、此刻可用才执行，返回是否执行了；给扩展与宿主替用户操作设计器用。 */
  runCommand(id: string): boolean {
    return runCommand(this.#model.commands, id, this.#context())
  }

  /**
   * 弹出选择文件的对话框，选中的文件交给导入器：按扩展顺序问 accepts，第一个接下的导入；
   * 导入的片段放在视口中央，整份流程定义换掉当前定义。没有导入器接下时派发 import-error。只读或没有导入器时什么都不做。
   */
  openFile(): void {
    if (this.readonly || !this.canImport)
      return
    const input = this.ownerDocument.createElement('input')
    input.type = 'file'
    input.accept = importerAccept(this.#model.importers)
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file)
        return
      const source: DesignerImportSource = { kind: 'file', mime: file.type, name: file.name, file }
      if (!this.#import([source], this.#viewportCenter()))
        emitEvent(this, 'import-error', { source, error: new RangeError(`[flow-designer] no importer accepts "${file.name}"`) })
    }, { once: true })
    input.click()
  }

  /** 导出成文件：交给登记了这种格式的第一个导出器，options 原样交给它；没有导出器认这种格式时返回以 RangeError 拒绝的 Promise。 */
  export(format: string, options: Readonly<Record<string, unknown>> = {}): Promise<Blob | string> {
    const exporter = this.#model.exporters.find(item => item.formats.includes(format))
    if (!exporter)
      return Promise.reject(new RangeError(`[flow-designer] no exporter for "${format}"`))
    return exporter.export(format, { ...this.#context(), options })
  }

  /** 复制选中内容并立即粘贴，偏移一格网格，不改动剪贴板；只读时什么都不做，返回空选择。 */
  duplicate(): FlowSelection {
    return this.readonly ? { nodes: [], edges: [] } : this.#editor.duplicate({ offset: this.#gridStep() })
  }

  /** 对齐选中的节点；少于两个或只读时什么都不做。 */
  align(mode: AlignMode): void {
    if (!this.readonly)
      this.#editor.align(mode)
  }

  /** 等距分布选中的节点；少于三个或只读时什么都不做。 */
  distribute(axis: DistributeAxis): void {
    if (!this.readonly)
      this.#editor.distribute(axis)
  }

  /**
   * 按连线方向分层排布全部节点，左上角保持在原处，并清除连线的手动拐点；记为一步，只读时什么都不做。
   * 没给的方向与间距取设置里「画布」分区的值。
   */
  autoLayout(options?: FlowAutoLayoutOptions): void {
    if (this.readonly)
      return
    const settings = this.#resolvedSettings
    const direction = settings[FLOW_SETTING_KEYS.layoutDirection]
    const label = (): string => this.#translations().autoLayout
    const nodeGap = settings[FLOW_SETTING_KEYS.nodeGap]
    const layerGap = settings[FLOW_SETTING_KEYS.layerGap]
    this.#editor.autoLayout({
      ...(LAYOUT_DIRECTIONS.includes(direction) ? { direction: direction as FlowAutoLayoutOptions['direction'] } : {}),
      ...(typeof nodeGap === 'number' ? { nodeGap } : {}),
      ...(typeof layerGap === 'number' ? { layerGap } : {}),
      label,
      ...options,
    })
  }

  /** 打开设置对话框，给了分区 id 就显示那一页：基础是 general，设计器自己的「画布」是 flow。 */
  openSettings(section?: string): void {
    this.#ensureLayers().settings.show(section)
  }

  /** 从头开始新手引导：通用步骤加流程与扩展的步骤，同一页里别的引导开着时先收起它；没有能走的步骤时返回 false。 */
  startTour(): boolean {
    return this.#ensureLayers().tour.start({ force: true })
  }

  /**
   * 打开编辑整份流程定义 JSON 的对话框：写出当前定义，边改边按读入检查与校验报问题；没有错误时「应用」整份换上，
   * 记一步撤销。只读时只能看、不能应用。
   */
  openJsonEditor(): void {
    const dialog = this.#ensureLayers().jsonEditor
    dialog.value = this.#editor.document as unknown as JsonValue
    dialog.validate = value => this.#jsonIssues(value)
    dialog.readonly = this.readonly === true
    dialog.show()
  }

  /** JSON 编辑框里的一份定义：先读入检查，读得了再按当前扩展与校验选项校验；问题的文字与问题列表的一致。 */
  #jsonIssues(value: JsonValue): DesignerIssueItem[] {
    const t = this.#translations()
    const model = this.#editor.model
    const read = readDocument(value)
    if (!read.ok)
      return flowIssueItems(read.issues, EMPTY_SCHEMA, model, t)
    return flowIssueItems(validateDocument(read.document, { ...this.validateOptions, extensions: this.#model.list }), read.document, model, t)
  }

  /** JSON 编辑框里按了「应用」：读入后整份换上，记一步撤销。 */
  readonly #onJsonApply = (event: Event): void => {
    event.stopPropagation()
    if (this.readonly)
      return
    const read = readDocument((event as DesignerJsonEditorEventMap['json-apply']).detail.value)
    if (read.ok)
      this.#applyDocument(read.document)
  }

  /** 按当前扩展与校验选项校验定义。 */
  validate(): FlowIssue[] {
    return this.#editor.validate(this.validateOptions)
  }

  /** 当前视口。 */
  getViewport(): Viewport {
    return this.#viewport
  }

  /** 视口中央的世界坐标；画布还没有尺寸时是原点。 */
  getViewportCenter(): FlowPoint {
    return this.#viewportCenter()
  }

  /** 设置视口；此后尺寸变化不再自动适配。 */
  setViewport(viewport: Viewport): void {
    this.#stopAutoFit()
    this.#moveTo(viewport)
  }

  /** 缩放并平移到让整张图落在视口中央，小图不放大到 100% 以上；此后尺寸变化时重新适配，直到设置视口或在画布上按下指针。 */
  zoomToFit(): void {
    this.#startAutoFit()
    this.#fitIfPending()
  }

  /** 以视口中心放大一档。 */
  zoomIn(): void {
    this.#zoomAtCenter(ZOOM_STEP)
  }

  /** 以视口中心缩小一档。 */
  zoomOut(): void {
    this.#zoomAtCenter(1 / ZOOM_STEP)
  }

  /** 缩放到 100% 并把整张图居中。 */
  zoomToActual(): void {
    const bounds = this.#scene?.bounds
    const size = this.#size()
    if (!size)
      return
    const center = bounds ? { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 } : { x: 0, y: 0 }
    this.setViewport(centerOn({ x: 0, y: 0, zoom: 1 }, center, size))
  }

  /** 把节点居中显示。 */
  scrollToNode(id: string): void {
    const rect = this.#nodeRect(id)
    const size = this.#size()
    if (rect && size)
      this.setViewport(centerOn(this.#viewport, { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }, size))
  }

  /** 节点没整个落在视口内时把它居中，已在视口内则不动。 */
  revealNode(id: string): void {
    const rect = this.#nodeRect(id)
    const size = this.#size()
    if (!rect || !size)
      return
    const next = revealRect(this.#viewport, rect, size, FIT_PADDING)
    if (next !== this.#viewport)
      this.setViewport(next)
  }

  /** 连线没整条落在视口内时把它移进来，已在视口内则不动。 */
  revealEdge(id: string): void {
    const points = this.#scene?.edges.find(edge => edge.id === id)?.points ?? []
    const rect = unionRects(points.map(point => ({ x: point.x, y: point.y, width: 0, height: 0 })))
    const size = this.#size()
    if (!rect || !size)
      return
    const next = revealRect(this.#viewport, rect, size, FIT_PADDING)
    if (next !== this.#viewport)
      this.setViewport(next)
  }

  /**
   * 流程结构的树：节点按定义里的先后，各带从它出去的连线（缺省收起）；没有名称的节点与连线写「种类名 · id」，节点的副文本是
   * 种类名，连线的副文本是「→ 去向」，业务数据里有条件文字（data.condition）时写成「条件 → 去向」。出发节点不在定义里的连线排在最后。
   */
  #outline(): readonly DesignerOutlineNode[] {
    const document = this.#editor.document
    const t = this.#translations()
    const model = this.#editor.model
    const cache = this.#outlineCache
    if (cache?.document === document && cache.t === t && cache.model === model)
      return cache.nodes
    const kind = (type: string): string => model.nodeTypes.get(type)?.label ?? type
    const nodeName = (node: FlowNode): string => node.label ?? `${kind(node.type)} · ${node.id}`
    const byId = new Map(document.nodes.map(node => [node.id, node]))
    const edgeRow = (edge: FlowDocument['edges'][number]): DesignerOutlineNode => {
      const target = byId.get(edge.target.node)
      const condition = edge.data?.condition
      const to = `→ ${target === undefined ? edge.target.node : nodeName(target)}`
      const description = typeof condition === 'string' && condition.trim() !== '' ? `${condition.trim()} ${to}` : to
      return { id: `edge:${edge.id}`, label: edge.label ?? `${t.edge} · ${edge.id}`, description, movable: false }
    }
    const outgoing = new Map<string, FlowDocument['edges'][number][]>()
    for (const edge of document.edges)
      outgoing.set(edge.source.node, [...outgoing.get(edge.source.node) ?? [], edge])
    const nodes: DesignerOutlineNode[] = document.nodes.map((node) => {
      const icon = model.nodeTypes.get(node.type)?.icon
      const edges = outgoing.get(node.id) ?? []
      return {
        id: `node:${node.id}`,
        label: nodeName(node),
        ...(node.label === undefined ? {} : { description: kind(node.type) }),
        ...(icon === undefined ? {} : { icon }),
        movable: false,
        ...(edges.length === 0 ? {} : { expanded: false, children: edges.map(edgeRow) }),
      }
    })
    const orphans = document.edges.filter(edge => !byId.has(edge.source.node)).map(edgeRow)
    const tree = [...nodes, ...orphans]
    this.#outlineCache = { document, t, model, nodes: tree }
    return tree
  }

  /**
   * 选中问题所在的节点或连线并显露它；问题落在属性上时把焦点交给属性面板里的那个字段。
   * 流程定义级属性的问题不带 target：清空选择，属性面板换成流程定义后聚焦那个字段。
   */
  #locate(issue: FlowIssue): void {
    const target = issue.target
    if (!target && issue.path.length > 0 && this.#editor.model.documentProperties.length > 0) {
      this.#editor.clearSelection()
      this.#focusProperty(issue.path)
      return
    }
    if (target?.kind === 'node') {
      this.#editor.select({ nodes: [target.id] })
      this.revealNode(target.id)
    }
    else if (target?.kind === 'edge') {
      this.#editor.select({ edges: [target.id] })
      this.revealEdge(target.id)
    }
    if (!target || issue.path.length <= 2)
      return
    this.#focusProperty(issue.path.slice(2))
  }

  /** 等属性面板更新后把焦点交给 path（相对对象）的字段。 */
  #focusProperty(path: readonly (string | number)[]): void {
    const properties = this.#ensureLayers().properties
    void this.updateComplete
      .then(() => properties.element.updateComplete)
      .then(() => properties.focusField(path))
  }

  /** 把画面上的流程图画成图片：选中的节点与连线按没选中的样子画，内置的图片导出器经它取图。 */
  async #renderImage(format: FlowImageFormat, options: FlowImageExportOptions): Promise<Blob> {
    if (format !== 'svg' && format !== 'png')
      throw new RangeError(`[flow-designer] no image format "${String(format)}"`)
    await this.updateComplete
    const scene = this.#scene
    if (!scene)
      throw new RangeError('[flow-designer] 流程图是空的，没有可导出的内容')
    const layers = this.#ensureLayers()
    const selected = Array.from(layers.world.querySelectorAll('[data-selected]'))
    for (const element of selected)
      element.removeAttribute('data-selected')
    try {
      // 独立的 SVG 在 exportFlowImage 里同步画好，之后才栅格化，选中标记随即放回
      return exportFlowImage({
        scene,
        canvas: layers.root,
        edges: layers.edges,
        node: id => childWith(layers.nodes, 'nodeId', id),
        label: id => childWith(layers.labels, 'edgeId', id),
        zoom: this.#viewport.zoom,
      }, format, options)
    }
    finally {
      for (const element of selected)
        element.setAttribute('data-selected', '')
    }
  }

  /** 交给命令、面板与扩展 setup 的上下文。 */
  #context(): FlowDesignerContext {
    return { designer: this, translations: this.#translations(), commandTranslations: this.#commandTranslations(), settings: this.#resolvedSettings, frame: this.#layers?.frame }
  }

  #kbdPlatform(): 'mac' | 'other' {
    this.#platform ??= detectKbdPlatform()
    return this.#platform
  }

  /** 按对象换上右键菜单的条目；条目的可用状态取此刻设计器的状态。 */
  #prepareMenu(menu: ContextMenuPanel, subject: FlowMenuSubject): void {
    const { commands } = this.#model
    const groups = arrangeCommands(`menu:${subject}`, commands, flowMenuLayout(subject, this.#editor.selection.nodes.length), this.commandLayout)
    renderCommandMenu(menu.content, groups, commands, this.#context(), { platform: this.#kbdPlatform() })
  }

  /** 浏览器视口坐标换成画布的世界坐标。 */
  clientToWorld(clientX: number, clientY: number): FlowPoint {
    const box = this.#ensureLayers().root.getBoundingClientRect()
    return screenToWorld(this.#viewport, { x: clientX - box.left, y: clientY - box.top })
  }

  #emitSchemaChange(operations: readonly FlowOperation[], kind: FlowSchemaChangeKind): void {
    emitEvent(this, 'schema-change', { schema: this.#editor.document, operations, kind })
  }

  #syncDirty(): void {
    const dirty = this.#editor.history.dirty
    if (dirty === this.#dirty)
      return
    this.#dirty = dirty
    emitEvent(this, 'dirty-change', { dirty })
  }

  #scheduleIssues(): void {
    if (this.#issuesScheduled)
      return
    this.#issuesScheduled = true
    queueMicrotask(() => {
      this.#issuesScheduled = false
      this.#issues = this.validate()
      this.#issueLevels = new Map()
      for (const issue of this.#issues) {
        if (issue.target?.kind === 'node' && this.#issueLevels.get(issue.target.id) !== 'error')
          this.#issueLevels.set(issue.target.id, issue.severity === 'warning' ? 'warning' : 'error')
      }
      this.requestUpdate()
      emitEvent(this, 'issues-change', { issues: this.#issues })
    })
  }

  #route(): FlowEdgeRouter {
    if (this.router)
      return this.router
    this.#defaultRouter ??= createOrthogonalRouter()
    return this.#defaultRouter
  }

  #gridStep(): number {
    return this.grid === false || !(this.grid > 0) ? 24 : this.grid
  }

  #snapToGrid(point: FlowPoint): FlowPoint {
    return this.grid === false || !(this.grid > 0) ? point : snapPointToGrid(point, this.grid)
  }

  #ensureLayers(): Layers {
    if (this.#layers?.frame.parentElement === this)
      return this.#layers
    const doc = this.ownerDocument
    const canvas = createGeneratedElement(doc, 'div')
    canvas.dataset.part = 'canvas'
    const root = createGeneratedElement(doc, 'div')
    root.dataset.part = 'viewport'
    const world = createGeneratedElement(doc, 'div')
    world.dataset.part = 'world'
    const edges = svgLayer(doc, 'edges')
    const labels = createGeneratedElement(doc, 'div')
    labels.dataset.part = 'labels'
    const nodes = createGeneratedElement(doc, 'div')
    nodes.dataset.part = 'nodes'
    const ports = createGeneratedElement(doc, 'div')
    ports.dataset.part = 'ports'
    const handles = createGeneratedElement(doc, 'div')
    handles.dataset.part = 'handles'
    const overlay = svgLayer(doc, 'overlay')
    const dropPreview = createGeneratedElement(doc, 'div')
    dropPreview.dataset.part = 'drop-preview'
    dropPreview.hidden = true
    world.append(edges, labels, nodes, ports, handles, overlay, dropPreview)
    const transform = createGeneratedElement(doc, 'xh-designer-transform', { 'data-part': 'transform' })
    transform.getSnap = this.#getSnap
    transform.addEventListener('transform', this.#onTransform)
    transform.addEventListener('marquee', this.#onMarquee)
    root.append(world, transform)
    const minimap = new MinimapPanel({
      ownerDocument: doc,
      scene: () => this.#scene,
      viewport: () => this.#viewport,
      canvasSize: () => this.#size(),
      centerAt: (point) => {
        const size = this.#size()
        if (size)
          this.setViewport(centerOn(this.#viewport, point, size))
      },
    })
    const menu = new ContextMenuPanel(doc, root, id => runCommand(this.#model.commands, id, this.#context()))
    menu.trigger.addEventListener('keydown', this.#onKeyDown)
    canvas.append(menu.element)
    const commandBar = createCommandToolbar<FlowDesignerContext>(doc)
    const headerBar = createCommandToolbar<FlowDesignerContext>(doc, { display: 'stacked' })
    headerBar.element.slot = 'header-center'
    const selectionBar = createCommandToolbar<FlowDesignerContext>(doc)
    selectionBar.element.slot = 'toolbar'
    const toolbar = createGeneratedElement(doc, 'div')
    toolbar.dataset.part = 'command-bar'
    toolbar.append(commandBar.element)
    const palette = new PalettePanel({
      ownerDocument: doc,
      isReadonly: () => this.readonly === true,
      addNode: type => this.addNode(type),
      context: () => this.#context(),
    })
    registerDropTarget(root, {
      over: (point, payload) => this.#dropOver(point, payload),
      drop: (point, payload) => this.#dropAt(point, payload),
      leave: () => this.#clearDrop(),
    })
    root.addEventListener('pan-request', this.#onPanRequest)
    root.addEventListener('dragover', this.#onNativeDragOver)
    root.addEventListener('drop', this.#onNativeDrop)
    const properties = new PropertiesPanel({
      ownerDocument: doc,
      editor: this.#editor,
      isReadonly: () => this.readonly === true,
      issues: () => this.#issues,
      editors: () => this.#model.editors,
      groupOrder: () => this.propertyGroupOrder,
      groupLabels: () => this.propertyGroupLabels,
    })
    const issues = new IssuesPanel({
      ownerDocument: doc,
      document: () => this.#editor.document,
      model: () => this.#editor.model,
      issues: () => this.#issues,
      locate: issue => this.#locate(issue),
    })
    palette.element.headless = true
    properties.element.headless = true
    issues.element.headless = true
    const frame = createGeneratedElement(doc, 'xh-designer-frame', { 'data-part': 'frame' })
    frame.addEventListener('layout-change', this.#onLayoutChange)
    toolbar.slot = 'toolbar'
    palette.element.slot = 'palette'
    canvas.slot = 'canvas'
    properties.element.slot = 'properties'
    issues.element.slot = 'issues'
    // 问题列表带计数的严重程度开关放进它所在卡片的面板头
    const issueSummary = issues.element.summary
    issueSummary.slot = 'issues-actions'
    minimap.element.slot = 'minimap'
    frame.append(toolbar, palette.element, canvas, properties.element, issues.element, issueSummary, minimap.element)
    const panels = createPanelHost<FlowDesignerContext>(frame, { commands: () => this.#model.commands })
    const selectionStatus = createStatusItem(doc, { value: '' })
    selectionStatus.element.slot = 'status-start'
    const zoomStatus = createStatusItem(doc, { value: '', action: () => this.zoomToActual() })
    zoomStatus.element.slot = 'status-end'
    frame.append(selectionStatus.element, zoomStatus.element)
    const settings = createGeneratedElement(doc, 'xh-designer-settings', { 'data-part': 'settings' })
    settings.addEventListener('settings-change', this.#onSettingsChange)
    settings.addEventListener('settings-command', this.#onSettingsCommand)
    const tour = createGeneratedElement(doc, 'xh-designer-tour', { 'data-part': 'tour' })
    tour.frame = frame
    tour.addEventListener('tour-end', this.#onTourEnd)
    const jsonEditor = createGeneratedElement(doc, 'xh-designer-json-editor', { 'data-part': 'json-editor' })
    jsonEditor.addEventListener('json-apply', this.#onJsonApply)
    this.append(frame, settings, tour, jsonEditor)
    root.addEventListener('pointerdown', this.#onPointerDown)
    root.addEventListener('dblclick', this.#onDoubleClick)
    root.addEventListener('contextmenu', this.#onContextMenu)
    root.addEventListener('wheel', this.#onWheel, { passive: false })
    this.#layers = { frame, canvas, root, world, edges, labels, nodes, ports, handles, overlay, dropPreview, transform, toolbar, commandBar, headerBar, selectionBar, palette, properties, issues, minimap, menu, panels, settings, tour, jsonEditor, selectionStatus, zoomStatus }
    panels.assign(this.#model.extensions, this.#context())
    this.#prepareMenu(menu, 'blank')
    return this.#layers
  }

  #renderEdges(layers: Layers, selected: ReadonlySet<string>): void {
    const scene = this.#scene
    const edges = scene?.edges.filter(edge => edge.path !== '') ?? []
    placeSvgLayer(layers.edges, scene?.bounds)
    const doc = this.ownerDocument
    reconcile(layers.edges, edges, this.#keys, edge => edge.id, (edge, reuse) => {
      const group = reuse ?? createEdgeGroup(doc)
      paintEdge(group, edge, selected.has(edge.id), this.#highlight?.kind === 'edge' && this.#highlight.id === edge.id)
      return group
    })
  }

  #renderLabels(layers: Layers): void {
    const labeled = this.#scene?.edges.filter(edge => edge.label !== undefined && edge.labelPoint !== undefined) ?? []
    const doc = this.ownerDocument
    reconcile(layers.labels, labeled, this.#keys, edge => edge.id, (edge, reuse) => {
      const label = (reuse as HTMLElement | undefined) ?? createGeneratedElement(doc, 'div')
      label.dataset.part = 'edge-label'
      label.dataset.edgeId = edge.id
      label.textContent = edge.label ?? ''
      label.style.left = `${edge.labelPoint!.x}px`
      label.style.top = `${edge.labelPoint!.y}px`
      return label
    })
  }

  #renderNodes(layers: Layers, selected: ReadonlySet<string>): void {
    const doc = this.ownerDocument
    reconcile(layers.nodes, this.#scene?.nodes ?? [], this.#keys, node => node.id, (sceneNode, reuse) => {
      const element = (reuse as HTMLElement | undefined) ?? createGeneratedElement(doc, 'div')
      this.#paintNode(element, sceneNode, selected.has(sceneNode.id))
      return element
    })
  }

  #paintNode(element: HTMLElement, sceneNode: FlowSceneNode, selected: boolean): void {
    const { node, rect } = sceneNode
    element.dataset.part = 'node'
    element.dataset.nodeId = node.id
    element.dataset.nodeType = node.type
    toggleData(element, 'selected', selected ? '' : undefined)
    toggleData(element, 'issue', this.#issueLevels.get(node.id))
    const highlighted = this.#highlight?.kind === 'node' && this.#highlight.id === node.id
    toggleData(element, 'highlighted', highlighted ? '' : undefined)
    element.style.left = `${rect.x}px`
    element.style.top = `${rect.y}px`
    element.style.width = `${rect.width}px`
    element.style.height = `${rect.height}px`
    const render = this.#model.runtime.renderers.get(node.type) ?? defaultNodeRenderer
    render(element, { node, nodeType: sceneNode.nodeType, label: sceneNode.label, status: undefined, highlighted })
  }

  #renderPorts(layers: Layers): void {
    const ports = (this.#scene?.nodes ?? []).flatMap(sceneNode =>
      (sceneNode.nodeType?.ports ?? []).map(port => ({ sceneNode, port, at: getPortPosition(sceneNode.rect, port) })))
    const doc = this.ownerDocument
    reconcile(layers.ports, ports, this.#keys, item => `${item.sceneNode.id}\u0000${item.port.id}`, (item, reuse) => {
      const element = (reuse as HTMLElement | undefined) ?? createGeneratedElement(doc, 'div')
      element.dataset.part = 'port'
      element.dataset.nodeId = item.sceneNode.id
      element.dataset.portId = item.port.id
      element.dataset.direction = item.port.direction
      element.dataset.side = item.port.side
      paintPortLabel(element, item.port.label)
      element.style.left = `${item.at.x}px`
      element.style.top = `${item.at.y}px`
      return element
    })
  }

  /** 唯一选中且画得出的那条连线；只读时没有。 */
  #editableEdge(): FlowSceneEdge | undefined {
    const { nodes, edges } = this.#editor.selection
    if (this.readonly || nodes.length > 0 || edges.length !== 1)
      return undefined
    const edge = this.#scene?.edges.find(item => item.id === edges[0])
    return edge && edge.anchored && edge.points.length >= 2 ? edge : undefined
  }

  /** 选中连线的控制柄：两端的端点柄、每个拐点的拐点柄与每段中点的加点柄。 */
  #renderHandles(layers: Layers): void {
    const edge = this.#editableEdge()
    const items: { key: string, part: string, at: FlowPoint, end?: FlowEdgeEnd, index?: number }[] = []
    if (edge) {
      const points = edge.points
      items.push({ key: 'source', part: 'edge-handle', end: 'source', at: points[0]! })
      items.push({ key: 'target', part: 'edge-handle', end: 'target', at: points.at(-1)! })
      points.slice(1, -1).forEach((at, index) => items.push({ key: `vertex-${index}`, part: 'vertex-handle', index, at }))
      for (let index = 0; index < points.length - 1; index++) {
        const from = points[index]!
        const to = points[index + 1]!
        items.push({ key: `segment-${index}`, part: 'segment-handle', index, at: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 } })
      }
    }
    const doc = this.ownerDocument
    reconcile(layers.handles, items, this.#keys, item => item.key, (item, reuse) => {
      const element = (reuse as HTMLElement | undefined) ?? createGeneratedElement(doc, 'div')
      element.dataset.part = item.part
      element.dataset.edgeId = edge!.id
      toggleData(element, 'end', item.end)
      toggleData(element, 'index', item.index === undefined ? undefined : String(item.index))
      element.style.left = `${item.at.x}px`
      element.style.top = `${item.at.y}px`
      return element
    })
  }

  #renderOverlay(layers: Layers): void {
    const scene = this.#scene
    placeSvgLayer(layers.overlay, scene?.bounds)
    const doc = this.ownerDocument
    const shapes: { key: string, d: string, part: string, valid?: boolean }[] = []
    const preview = this.#preview
    if (preview)
      shapes.push({ key: 'preview', part: 'connect-preview', d: `M${preview.from.x},${preview.from.y}L${preview.to.x},${preview.to.y}`, valid: preview.valid })
    reconcile(layers.overlay, shapes, this.#keys, shape => shape.key, (shape, reuse) => {
      const path = reuse ?? doc.createElementNS(SVG_NS, 'path')
      path.setAttribute(GEN_ATTR, '')
      path.setAttribute('data-part', shape.part)
      path.setAttribute('d', shape.d)
      if (shape.valid === undefined)
        path.removeAttribute('data-valid')
      else
        path.setAttribute('data-valid', String(shape.valid))
      return path
    })
    placeBox(layers.dropPreview, this.#dropPreview)
  }

  /** 外框此刻显示这块面板（布局里没隐藏、宿主没藏掉）。 */
  #shows(panel: string): boolean {
    return this.#layers?.frame.showsPanel(panel) ?? false
  }

  /** 设置里的状态栏开关，缺省开。 */
  #statusBarOn(): boolean {
    return this.#resolvedSettings[DESIGNER_SETTING_KEYS.statusBar] !== false
  }

  /** 状态栏：左段写选中对象（没选中时写节点与连线数），右段写缩放。 */
  #renderStatus(layers: Layers, t: FlowDesignerTranslations): void {
    const { nodes, edges } = this.#editor.selection
    const document = this.#editor.document
    if (nodes.length + edges.length > 1) {
      layers.selectionStatus.update({ value: t.statusSelected(nodes.length + edges.length) })
    }
    else if (nodes.length === 1) {
      const node = document.nodes.find(item => item.id === nodes[0])
      const type = node && this.#editor.model.nodeTypes.get(node.type)
      layers.selectionStatus.update(node
        ? { label: type?.label ?? node.type, value: t.statusGeometry(Math.round(node.x), Math.round(node.y), Math.round(node.width), Math.round(node.height)) }
        : { value: '' })
    }
    else if (edges.length === 1) {
      const edge = document.edges.find(item => item.id === edges[0])
      layers.selectionStatus.update({ label: t.edge, value: edge?.label ?? edges[0]! })
    }
    else {
      layers.selectionStatus.update({ label: t.flow, value: t.statusDocument(document.nodes.length, document.edges.length) })
    }
    layers.zoomStatus.update({ label: t.statusZoom, value: `${Math.round(this.#viewport.zoom * 100)}%` })
  }

  /**
   * 设置：建好设置宿主（主题色预设、注册函数或存储键变了就重建），给了存储键又没赋 settings 时从存储读；settings 变了
   * 把主题与主题色落到设计器上；算出此刻生效的设置，交给设置对话框。
   */
  #syncSettings(layers: Layers, t: FlowDesignerTranslations, changed: PropertyValues): void {
    const options = [this.brands, this.registerBrand, this.settingsStorageKey]
    let fresh = false
    if (!this.#settingsHost || options.some((value, index) => value !== this.#settingsHostOptions[index])) {
      this.#settingsHost?.dispose()
      this.#settingsHostOptions = options
      const storageKey = this.settingsStorageKey
      this.#settingsHost = storageKey === undefined
        ? createDesignerSettingsHost({ root: this, brands: this.brands, registerBrand: this.registerBrand })
        : createDesignerSettingsHost({
            root: this,
            brands: this.brands,
            registerBrand: this.registerBrand,
            storageKey,
            onStorageError: detail => emitEvent(this, 'settings-storage-error', detail),
          })
      if (storageKey !== undefined && this.settings === undefined)
        this.settings = this.#settingsHost.load()
      fresh = true
    }
    if (fresh || changed.has('settings'))
      this.#settingsHost.apply(this.settings ?? {})
    const sections = [flowSettingsSection(t), ...this.#model.settings]
    const sectionsKey = JSON.stringify(sections)
    if (sectionsKey !== this.#settingsSectionsKey) {
      this.#settingsSectionsKey = sectionsKey
      this.#settingsSectionList = sections
    }
    this.#resolvedSettings = resolveSettings(this.#settingsSectionList, this.settings)
    const dialog = layers.settings
    const general = { brands: this.brands, customBrand: this.registerBrand !== undefined }
    const policy: DesignerSettingsPolicy = { ...this.settingsPolicy }
    const dialogKey = JSON.stringify([general.brands, general.customBrand, policy])
    if (dialogKey !== this.#settingsDialogKey) {
      this.#settingsDialogKey = dialogKey
      dialog.general = general
      dialog.policy = policy
    }
    if (dialog.sections !== this.#settingsSectionList)
      dialog.sections = this.#settingsSectionList
    if (dialog.frame !== layers.frame)
      dialog.frame = layers.frame
    if (dialog.settings !== this.settings)
      dialog.settings = this.settings
  }

  /** 设置对话框里改了一条：换成新的 settings，给了存储键就存起来，再派发 settings-change。 */
  readonly #onSettingsChange = (event: Event): void => {
    event.stopPropagation()
    const detail = (event as DesignerSettingsEventMap['settings-change']).detail
    this.#commitSettings(detail)
  }

  /** 换成新的 settings，给了存储键就存起来，再派发 settings-change。 */
  #commitSettings(detail: DesignerSettingsEventMap['settings-change']['detail']): void {
    this.settings = detail.settings
    this.#settingsHost?.save(detail.settings, this.#settingsSectionList)
    emitEvent(this, 'settings-change', detail)
  }

  /** 外框改了面板布局：整份写进设置的 layout.panels。 */
  readonly #onLayoutChange = (event: Event): void => {
    event.stopPropagation()
    const value = (event as DesignerFrameEventMap['layout-change']).detail.layout as unknown as JsonValue
    const key = DESIGNER_SETTING_KEYS.layout
    this.#commitSettings({ key, value, settings: { ...this.settings, [key]: value } })
  }

  /** 设置里存的面板布局。 */
  #storedLayout(): DesignerLayout | undefined {
    const value = this.settings?.[DESIGNER_SETTING_KEYS.layout]
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as unknown as DesignerLayout : undefined
  }

  /** 宿主对布局的管控，从 settingsPolicy 换算；内容不变时沿用同一个对象。 */
  #frameLayoutPolicy(): DesignerLayoutPolicy | undefined {
    const policy = designerLayoutPolicy(this.settingsPolicy)
    const key = JSON.stringify(policy ?? null)
    if (key !== this.#layoutPolicyKey) {
      this.#layoutPolicyKey = key
      this.#layoutPolicy = policy
    }
    return this.#layoutPolicy
  }

  /**
   * 外框的命名区：工具栏与画布带上本地化的区名（分隔条的无障碍名称要用）；物料、属性与问题画成卡片，面板头写标题、
   * 图标与帮助，属性面板的副标题是当前编辑的对象；小地图是画布右下角的浮动件。设置里关了状态栏或工具栏时不登记它们。
   * 后面接扩展面板的区。
   */
  #frameRegions(t: FlowDesignerTranslations, toolbar: string, layers: Layers): readonly DesignerFrameRegion[] {
    const regions: Readonly<Record<string, Partial<DesignerFrameRegion>>> = {
      toolbar: { label: toolbar },
      palette: { title: t.palette, icon: LayoutGridIcon, help: t.paletteHelp },
      canvas: { label: t.label },
      properties: {
        title: this.#config.translations<{ title: string }>('xh-designer-properties', { title: 'Properties' }).title,
        subtitle: layers.properties.element.heading,
        icon: SlidersHorizontalIcon,
        help: t.propertiesHelp,
      },
      issues: {
        title: this.#config.translations<{ title: string }>('xh-designer-issues', { title: 'Problems' }).title,
        icon: CircleAlertIcon,
        help: t.issuesHelp,
      },
    }
    const statusBar = this.#statusBarOn()
    const toolbarShown = toolbarVisibleOf(this.#resolvedSettings)
    const key = JSON.stringify([regions, t.minimap, statusBar, toolbarShown])
    if (key !== this.#frameRegionsKey || this.#frameRegionsModel !== this.#model) {
      this.#frameRegionsKey = key
      this.#frameRegionsModel = this.#model
      this.#frameRegionList = [
        ...DESIGNER_FRAME_REGIONS.filter(region => (statusBar || region.name !== 'status') && (toolbarShown || region.name !== 'toolbar')).map(region => ({ ...region, ...regions[region.name] })),
        { name: 'minimap', position: 'overlay', anchor: 'bottom-end', title: t.minimap, icon: MapIcon },
        ...this.#model.extensions.flatMap(extension => (extension.panels ?? []).map(panel => panel.region)),
      ]
    }
    return this.#frameRegionList
  }

  #renderPanels(layers: Layers, t: FlowDesignerTranslations): void {
    const shared = this.#commandTranslations()
    const frame = layers.frame
    frame.regions = this.#frameRegions(t, shared.toolbar, layers)
    frame.layout = this.#storedLayout()
    frame.defaultLayout = this.defaultLayout
    frame.layoutPolicy = this.#frameLayoutPolicy()
    this.#renderStatus(layers, t)
    const context: FlowDesignerContext = { designer: this, translations: t, commandTranslations: shared, settings: this.#resolvedSettings, frame: layers.frame }
    const { commands } = this.#model
    layers.commandBar.setDisplay(toolbarDisplayOf(this.#resolvedSettings))
    const arranged = arrangeCommands('toolbar', commands, flowToolbarLayout(this.canImport), this.commandLayout)
    layers.commandBar.update(applyToolbarCustomization(arranged, toolbarCustomizationOf(this.#resolvedSettings)), commands, context, shared.toolbar)
    // 设置对话框的「工具栏」页按宿主排好的这一份列出按钮表，用户的定制压在它上面
    const source = toolbarSettingsSource(arranged, commands, context)
    const sourceKey = JSON.stringify(source)
    if (sourceKey !== this.#toolbarSourceKey) {
      this.#toolbarSourceKey = sourceKey
      layers.settings.toolbar = source
    }
    const header = arrangeCommands('header', commands, [], this.commandLayout)
    if (header.length > 0) {
      layers.headerBar.update(header, commands, context, t.insertToolbar)
      if (!layers.headerBar.element.isConnected)
        layers.frame.append(layers.headerBar.element)
    }
    else {
      layers.headerBar.element.remove()
    }
    this.#renderSelectionBar(layers, context, t)
    if (this.#shows('palette'))
      layers.palette.update(this.#editor.model.nodeTypes, { order: this.paletteGroupOrder, labels: this.paletteGroupLabels }, t, this.#model.paletteSources)
    if (this.#shows('properties'))
      layers.properties.update(t)
    if (this.#shows('issues'))
      layers.issues.update(t)
    if (this.#shows('minimap'))
      layers.minimap.update()
    // 属性面板刷新后副标题（当前对象）才是新的，区登记再取一次；没变时是同一份
    frame.regions = this.#frameRegions(t, shared.toolbar, layers)
    layers.panels.update(context)
  }

  /** 选中工具条的主体：选中一个节点为 node，几个为 nodes；没选中节点时为 undefined。 */
  #selectionSubject(): FlowSelectionSubject | undefined {
    const count = this.#editor.selection.nodes.length
    return count === 0 ? undefined : count === 1 ? 'node' : 'nodes'
  }

  /**
   * 选中工具条：按主体取 selection:<主体> 的排列（宿主经 commandLayout 改，扩展命令写上落点就追加成一组），可编辑、
   * 有选中的节点、排列不空时放进变换覆盖层（slot="toolbar"），否则拿掉；位置、翻转与手势中收起由覆盖层管。
   */
  #renderSelectionBar(layers: Layers, context: FlowDesignerContext, t: FlowDesignerTranslations): void {
    const subject = this.readonly ? undefined : this.#selectionSubject()
    const { commands } = this.#model
    const groups = subject === undefined ? [] : arrangeCommands(`selection:${subject}`, commands, flowSelectionLayout(subject), this.commandLayout)
    if (groups.every(group => group.length === 0)) {
      layers.selectionBar.element.remove()
      return
    }
    layers.selectionBar.update(groups, commands, context, t.selectionToolbar)
    if (!layers.selectionBar.element.isConnected)
      layers.transform.append(layers.selectionBar.element)
  }

  #startAutoFit(): void {
    this.#autoFit = true
    this.#fitPending = true
  }

  #stopAutoFit(): void {
    this.#autoFit = false
    this.#fitPending = false
  }

  #onResize(): void {
    if (!this.#autoFit)
      return
    this.#fitPending = true
    this.#fitIfPending()
  }

  #fitIfPending(): boolean {
    const bounds = this.#scene?.bounds
    const size = this.#size()
    if (!this.#fitPending || !bounds || !size)
      return false
    this.#fitPending = false
    this.#moveTo(fitRect(bounds, size, { padding: FIT_PADDING }))
    return true
  }

  #moveTo(viewport: Viewport): void {
    this.#viewport = viewport
    this.#applyViewport(true)
  }

  #applyViewport(notify: boolean): void {
    const layers = this.#layers
    if (layers) {
      const { x, y, zoom } = this.#viewport
      layers.world.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`
      layers.world.style.setProperty('--xh-flow-designer-zoom', String(zoom))
      layers.transform.viewport = this.#viewport
      layers.zoomStatus.update({ label: this.#translations().statusZoom, value: `${Math.round(zoom * 100)}%` })
      if (this.#shows('minimap'))
        layers.minimap.update()
    }
    if (notify)
      emitEvent(this, 'viewport-change', { viewport: this.#viewport })
  }

  #size(): { width: number, height: number } | undefined {
    const root = this.#layers?.root
    if (!root || root.clientWidth === 0 || root.clientHeight === 0)
      return undefined
    return { width: root.clientWidth, height: root.clientHeight }
  }

  /** 没给落点的新节点错开的一步（世界坐标）：有网格时取不小于它的网格整数倍。 */
  #cascadeStep(): number {
    return this.grid === false || !(this.grid > 0) ? CASCADE_STEP : Math.ceil(CASCADE_STEP / this.grid) * this.grid
  }

  /**
   * 没给落点的新节点放在哪（左上角）：视口中央；那里已有节点（左上角相差不到半步）时往右下错一步，直到空出来。
   * 错到视口右边或下边放不下时，从视口左上角另起一斜列接着错。
   */
  #cascadePlace(size: { width: number, height: number }): FlowPoint {
    const center = this.#viewportCenter()
    const step = this.#cascadeStep()
    const view = this.#size()
    const topLeft = view ? screenToWorld(this.#viewport, { x: 0, y: 0 }) : undefined
    const bottomRight = view ? screenToWorld(this.#viewport, { x: view.width, y: view.height }) : undefined
    const nodes = this.#editor.document.nodes
    const taken = (point: FlowPoint): boolean => nodes.some(node => Math.abs(node.x - point.x) < step / 2 && Math.abs(node.y - point.y) < step / 2)
    let point = this.#snapToGrid({ x: center.x - size.width / 2, y: center.y - size.height / 2 })
    let column = 0
    for (let round = 0; round < CASCADE_LIMIT && taken(point); round++) {
      point = { x: point.x + step, y: point.y + step }
      if (topLeft && bottomRight && (point.x + size.width > bottomRight.x || point.y + size.height > bottomRight.y)) {
        column += 1
        point = this.#snapToGrid({ x: topLeft.x + step * column, y: topLeft.y + step })
      }
    }
    return point
  }

  #viewportCenter(): FlowPoint {
    const size = this.#size()
    return size ? screenToWorld(this.#viewport, { x: size.width / 2, y: size.height / 2 }) : { x: 0, y: 0 }
  }

  #nodeRect(id: string): FlowRect | undefined {
    return this.#scene?.nodes.find(node => node.id === id)?.rect
  }

  #zoomAtCenter(factor: number): void {
    const size = this.#size()
    if (size)
      this.setViewport(zoomBy(this.#viewport, factor, { x: size.width / 2, y: size.height / 2 }))
  }

  /** 跟随一次按下：位移过了激活距离才算拖动；结束时告知是否拖动过。 */
  #track(
    event: PointerEvent,
    kind: Gesture['kind'],
    handlers: { readonly onActivate?: () => void, readonly onMove: (client: FlowPoint) => void, readonly onEnd: (active: boolean) => void },
  ): void {
    const start = { x: event.clientX, y: event.clientY }
    const gesture: Gesture = {
      kind,
      active: false,
      session: createPointerSession({
        doc: resolveSessionDoc(this),
        pointerId: event.pointerId,
        onMove: ({ point }) => {
          if (!gesture.active) {
            if (!shouldActivate({ x: point.clientX - start.x, y: point.clientY - start.y }))
              return
            gesture.active = true
            this.#layers?.root.setAttribute('data-gesture', kind)
            handlers.onActivate?.()
          }
          handlers.onMove({ x: point.clientX, y: point.clientY })
        },
        onEnd: () => {
          gesture.session.dispose()
          if (this.#gesture === gesture)
            this.#gesture = undefined
          this.#layers?.root.removeAttribute('data-gesture')
          handlers.onEnd(gesture.active)
        },
      }),
    }
    this.#gesture = gesture
  }

  #cancelGesture(): void {
    const gesture = this.#gesture
    if (!gesture)
      return
    gesture.session.dispose()
    this.#gesture = undefined
    this.#layers?.root.removeAttribute('data-gesture')
    if (this.#editor.history.inTransaction)
      this.#editor.history.rollback()
    this.#preview = undefined
    this.requestUpdate()
  }

  readonly #onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || this.#gesture)
      return
    this.#stopAutoFit()
    const target = event.target instanceof Element ? event.target : undefined
    const additive = event.shiftKey || event.ctrlKey || event.metaKey
    const handle = target?.closest<HTMLElement>(HANDLE_SELECTOR)
    if (handle && this.contains(handle) && !this.readonly) {
      const edgeId = handle.dataset.edgeId!
      if (handle.dataset.part === 'edge-handle')
        this.#startReconnect(event, edgeId, handle.dataset.end as FlowEdgeEnd)
      else
        this.#startVertexDrag(event, edgeId, handle.dataset.part === 'vertex-handle' ? 'move' : 'insert', Number(handle.dataset.index))
      return
    }
    const port = target?.closest<HTMLElement>('[data-part="port"]')
    if (port && this.contains(port) && !this.readonly) {
      this.#startConnect(event, port.dataset.nodeId!, port.dataset.portId!)
      return
    }
    const node = target?.closest<HTMLElement>('[data-part="node"]')
    if (node && this.contains(node)) {
      this.#pressNode(event, node.dataset.nodeId!, additive)
      return
    }
    const edge = target?.closest('[data-edge-id]')
    if (edge && this.contains(edge)) {
      const id = edge.getAttribute('data-edge-id')!
      this.#editor.select({ edges: [id] }, additive ? 'toggle' : 'replace')
      return
    }
    if (event.shiftKey)
      this.#beginMarquee(event, event.ctrlKey || event.metaKey)
    else
      this.#startPan(event)
  }

  #pressNode(event: PointerEvent, id: string, additive: boolean): void {
    const selected = this.#editor.selection.nodes.includes(id)
    if (additive) {
      this.#editor.select({ nodes: [id] }, 'toggle')
      if (selected)
        return
    }
    else if (!selected) {
      this.#editor.select({ nodes: [id] })
    }
    if (this.readonly)
      return
    const layers = this.#ensureLayers()
    this.#syncTransform(layers)
    layers.transform.startMove(event)
  }

  /** 覆盖层的输入：视口、选中的节点（不缩放、不旋转）与只读。 */
  #syncTransform(layers: Layers): void {
    const transform = layers.transform
    transform.viewport = this.#viewport
    transform.readonly = this.readonly
    const ids = new Set(this.#editor.selection.nodes)
    const nodes = this.#editor.document.nodes.filter(node => ids.has(node.id))
    const current = transform.items ?? []
    const same = current.length === nodes.length && current.every((item, index) => {
      const node = nodes[index]!
      return item.id === node.id && item.rect.x === node.x && item.rect.y === node.y && item.rect.width === node.width && item.rect.height === node.height
    })
    if (!same)
      transform.items = nodes.map(node => ({ id: node.id, rect: { x: node.x, y: node.y, width: node.width, height: node.height }, handles: false }))
  }

  /** 移动时的吸附：开了 snap 时对齐其余节点，设了网格时退到网格；都没有时不吸。 */
  readonly #getSnap = (): DesignerSnapOptions | undefined => {
    const grid = this.grid === false || !(this.grid > 0) ? undefined : this.grid
    const snap = this.#resolvedSettings[FLOW_SETTING_KEYS.snap] !== false
    if (!snap && grid === undefined)
      return undefined
    const ids = new Set(this.#editor.selection.nodes)
    const targets = snap
      ? this.#editor.document.nodes.filter(node => !ids.has(node.id)).map(node => ({ x: node.x, y: node.y, width: node.width, height: node.height }))
      : []
    return grid === undefined ? { targets } : { targets, grid }
  }

  /** 覆盖层的移动：开始时开事务，每一帧移动节点，松手提交；按住 Alt 松手时撤回移动，按位移复制一份。 */
  readonly #onTransform = (event: Event): void => {
    const { phase, rects, copy } = (event as DesignerTransformEventMap['transform']).detail
    const history = this.#editor.history
    const root = this.#ensureLayers().root
    if (phase === 'start') {
      history.begin(nodesLabel('move', identitiesIn(this.#editor.document, [...rects.keys()]), this.#labelSource))
      root.dataset.gesture = 'move'
      return
    }
    if (phase === 'move') {
      this.#editor.execute([{ type: 'moveNodes', positions: [...rects].map(([id, rect]) => ({ id, x: rect.x, y: rect.y })) }])
      return
    }
    delete root.dataset.gesture
    if (!history.inTransaction)
      return
    if (phase === 'cancel') {
      history.rollback()
      return
    }
    if (!copy) {
      history.commit()
      return
    }
    history.rollback()
    const [id, rect] = [...rects][0]!
    const node = this.#editor.document.nodes.find(item => item.id === id)
    if (node)
      this.#editor.duplicate({ offset: { x: rect.x - node.x, y: rect.y - node.y }, label: nodesLabel('copy', identitiesIn(this.#editor.document, this.#editor.selection.nodes), this.#labelSource) })
  }

  /** 交给覆盖层框选；没拖动就松手且不是追加时清空选择。 */
  #beginMarquee(event: PointerEvent, additive: boolean): void {
    this.#marqueeBase = additive ? this.#editor.selection.nodes : []
    this.#marqueeStarted = false
    const doc = this.ownerDocument
    const onUp = (up: PointerEvent): void => {
      if (up.pointerId !== event.pointerId)
        return
      doc.removeEventListener('pointerup', onUp)
      doc.removeEventListener('pointercancel', onUp)
      if (!this.#marqueeStarted && !additive && up.type === 'pointerup')
        this.#editor.clearSelection()
    }
    doc.addEventListener('pointerup', onUp)
    doc.addEventListener('pointercancel', onUp)
    this.#ensureLayers().transform.startMarquee(event, { additive })
  }

  /** 框选：选中落在框里的节点，追加时并上框选前的选择。 */
  readonly #onMarquee = (event: Event): void => {
    const { phase, rect, mode } = (event as DesignerTransformEventMap['marquee']).detail
    const root = this.#ensureLayers().root
    if (phase === 'start') {
      this.#marqueeStarted = true
      root.dataset.gesture = 'marquee'
    }
    if (phase === 'end' || phase === 'cancel')
      delete root.dataset.gesture
    if (phase === 'cancel')
      return
    const nodes = this.#scene?.nodes ?? []
    const hits = selectInMarquee(rect, nodes.map(node => node.rect), mode).map(index => nodes[index]!.id)
    this.#editor.select({ nodes: [...new Set([...this.#marqueeBase, ...hits])], edges: [] })
  }

  #startConnect(event: PointerEvent, nodeId: string, portId: string): void {
    const sceneNode = this.#scene?.nodes.find(node => node.id === nodeId)
    const port = sceneNode?.nodeType?.ports.find(item => item.id === portId)
    if (!sceneNode || !port || !portAllows(port, 'source'))
      return
    const source: FlowEndpoint = { node: nodeId, port: portId }
    const from = getPortPosition(sceneNode.rect, port)
    let target: FlowEndpoint | undefined
    this.#track(event, 'connect', {
      onMove: (client) => {
        const world = this.clientToWorld(client.x, client.y)
        target = this.#endpointAt(world, source)
        const valid = target ? this.#editor.checkConnect(source, target).length === 0 : undefined
        this.#preview = { from, to: target ? this.#anchorOf(target) ?? world : world, valid }
        this.requestUpdate()
      },
      onEnd: (active) => {
        this.#preview = undefined
        this.requestUpdate()
        if (!active || !target)
          return
        const result = this.#editor.connect(source, target)
        if (!result.ok)
          emitEvent(this, 'connect-reject', { source, target, problems: result.problems })
      },
    })
  }

  /** 拖连线的一端改连：指针下有端口或节点时显示能不能连，松手时改连，违反约束时派发 connect-reject。 */
  #startReconnect(event: PointerEvent, edgeId: string, end: FlowEdgeEnd): void {
    const edge = this.#editor.document.edges.find(item => item.id === edgeId)
    const points = this.#scene?.edges.find(item => item.id === edgeId)?.points
    if (!edge || !points || points.length < 2)
      return
    const fixed = end === 'source' ? points.at(-1)! : points[0]!
    const pair = (endpoint: FlowEndpoint): { source: FlowEndpoint, target: FlowEndpoint } =>
      end === 'source' ? { source: endpoint, target: edge.target } : { source: edge.source, target: endpoint }
    let endpoint: FlowEndpoint | undefined
    this.#track(event, 'connect', {
      onMove: (client) => {
        const world = this.clientToWorld(client.x, client.y)
        endpoint = this.#endpointAt(world)
        const { source, target } = endpoint ? pair(endpoint) : pair(edge[end])
        const valid = endpoint ? this.#editor.checkConnect(source, target, edgeId).length === 0 : undefined
        const at = endpoint ? this.#anchorOf(endpoint) ?? world : world
        this.#preview = end === 'source' ? { from: at, to: fixed, valid } : { from: fixed, to: at, valid }
        this.requestUpdate()
      },
      onEnd: (active) => {
        this.#preview = undefined
        this.requestUpdate()
        if (!active || !endpoint)
          return
        const result = this.#editor.reconnect(edgeId, end, endpoint)
        if (!result.ok)
          emitEvent(this, 'connect-reject', { ...pair(endpoint), problems: result.problems })
      },
    })
  }

  /** 拖拐点挪动它，或拖线段中点在那里加一个拐点；位置吸附网格，一次拖动记一步撤销。没有手动拐点的连线以路由出的折点为起点。 */
  #startVertexDrag(event: PointerEvent, edgeId: string, mode: 'move' | 'insert', index: number): void {
    const points = this.#scene?.edges.find(item => item.id === edgeId)?.points
    if (!points)
      return
    const interior = points.slice(1, -1)
    this.#track(event, 'vertex', {
      onActivate: () => this.#editor.history.begin(() => this.#translations().history.editRoute),
      onMove: (client) => {
        const at = this.#snapToGrid(this.clientToWorld(client.x, client.y))
        const vertices = mode === 'move'
          ? interior.map((point, i) => i === index ? at : point)
          : [...interior.slice(0, index), at, ...interior.slice(index)]
        this.#editor.execute([{ type: 'updateEdge', id: edgeId, patch: { vertices } }])
      },
      onEnd: (active) => {
        if (active && this.#editor.history.inTransaction)
          this.#editor.history.commit()
        this.requestUpdate()
      },
    })
  }

  /** 世界坐标处的连接终点：靠近某个端口（exclude 那个端口除外）时取该端口，否则取指针下的节点；都没有时为 undefined。 */
  #endpointAt(world: FlowPoint, exclude?: FlowEndpoint): FlowEndpoint | undefined {
    const nodes = this.#scene?.nodes ?? []
    const reach = PORT_HIT_DISTANCE / this.#viewport.zoom
    let best: { endpoint: FlowEndpoint, distance: number } | undefined
    for (const sceneNode of nodes) {
      for (const port of sceneNode.nodeType?.ports ?? []) {
        if (exclude && sceneNode.id === exclude.node && port.id === exclude.port)
          continue
        const at = getPortPosition(sceneNode.rect, port)
        const distance = Math.hypot(at.x - world.x, at.y - world.y)
        if (distance <= reach && (!best || distance < best.distance))
          best = { endpoint: { node: sceneNode.id, port: port.id }, distance }
      }
    }
    if (best)
      return best.endpoint
    const index = hitTest(world, nodes.map(node => node.rect))
    return index < 0 ? undefined : { node: nodes[index]!.id }
  }

  #anchorOf(endpoint: FlowEndpoint): FlowPoint | undefined {
    const sceneNode = this.#scene?.nodes.find(node => node.id === endpoint.node)
    if (!sceneNode)
      return undefined
    const port = endpoint.port === undefined ? undefined : sceneNode.nodeType?.ports.find(item => item.id === endpoint.port)
    if (port)
      return getPortPosition(sceneNode.rect, port)
    return { x: sceneNode.rect.x + sceneNode.rect.width / 2, y: sceneNode.rect.y + sceneNode.rect.height / 2 }
  }

  /** 物料拖到画布上：按节点类型的尺寸在指针处画落点（吸附网格）；只读或不是物料时不接受。 */
  #dropOver(point: FlowPoint, payload: unknown): DropOver {
    const sourceItem = this.#sourceItemOf(payload)
    if (sourceItem !== undefined) {
      this.#clearDrop()
      return { accept: !this.readonly }
    }
    const type = paletteNodeType(payload)
    const nodeType = type === undefined ? undefined : this.#editor.model.nodeTypes.get(type)
    if (this.readonly || !nodeType) {
      this.#clearDrop()
      return { accept: false }
    }
    const { width, height } = nodeType.size
    const center = this.clientToWorld(point.x, point.y)
    this.#dropPreview = { ...this.#snapToGrid({ x: center.x - width / 2, y: center.y - height / 2 }), width, height }
    this.#ensureLayers().root.dataset.gesture = 'drop'
    this.requestUpdate()
    return { accept: true, ghost: 'hide' }
  }

  /** 拖进来的是物料来源的条目时它的 id。 */
  #sourceItemOf(payload: unknown): string | undefined {
    const drag = payload as Partial<DesignerPaletteDragPayload> | undefined
    return drag?.source === 'palette' && typeof drag.id === 'string' && this.#ensureLayers().palette.isSourceItem(drag.id) ? drag.id : undefined
  }

  /** 在落点新建拖进来的节点类型；物料来源的条目交给那个来源，带上松手处的世界坐标。 */
  #dropAt(point: FlowPoint, payload: unknown): void {
    const sourceItem = this.#sourceItemOf(payload)
    if (sourceItem !== undefined) {
      this.#clearDrop()
      if (!this.readonly)
        this.#ensureLayers().palette.insert(sourceItem, this.clientToWorld(point.x, point.y))
      return
    }
    const type = paletteNodeType(payload)
    const target = this.#dropPreview
    this.#clearDrop()
    if (type !== undefined && target)
      this.#editor.addNode(type, { x: target.x, y: target.y })
  }

  #clearDrop(): void {
    const root = this.#layers?.root
    if (root?.dataset.gesture === 'drop')
      delete root.dataset.gesture
    if (!this.#dropPreview)
      return
    this.#dropPreview = undefined
    this.requestUpdate()
  }

  /** 拖到画布边缘时平移视口，让视口外的落点够得着。 */
  readonly #onPanRequest = (event: Event): void => {
    const { dx, dy } = (event as CustomEvent<PanRequestDetail>).detail
    this.setViewport(panBy(this.#viewport, -dx, -dy))
  }

  #startPan(event: PointerEvent): void {
    let last = { x: event.clientX, y: event.clientY }
    this.#track(event, 'pan', {
      onMove: (client) => {
        this.setViewport(panBy(this.#viewport, client.x - last.x, client.y - last.y))
        last = client
      },
      onEnd: (active) => {
        if (!active)
          this.#editor.clearSelection()
      },
    })
  }

  /** 删掉手动拐点；删到一个不剩时交回路由器。路由出的折点没有可删的。 */
  #removeVertex(edgeId: string, index: number): void {
    const edge = this.#editor.document.edges.find(item => item.id === edgeId)
    if (this.readonly || !edge?.vertices || !edge.vertices[index])
      return
    const vertices = edge.vertices.filter((_, i) => i !== index)
    this.#editor.updateEdge(edgeId, { vertices: vertices.length === 0 ? null : vertices })
  }

  #targetOf(event: Event): { kind: 'node' | 'edge', id: string } | undefined {
    const target = event.target instanceof Element ? event.target : undefined
    const node = target?.closest<HTMLElement>('[data-part="node"]')
    if (node?.dataset.nodeId !== undefined && this.contains(node))
      return { kind: 'node', id: node.dataset.nodeId }
    const edge = target?.closest('[data-edge-id]')
    const edgeId = edge?.getAttribute('data-edge-id')
    if (edge && edgeId !== null && edgeId !== undefined && this.contains(edge))
      return { kind: 'edge', id: edgeId }
    return undefined
  }

  readonly #onDoubleClick = (event: MouseEvent): void => {
    const vertex = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-part="vertex-handle"]') : null
    if (vertex && this.contains(vertex)) {
      this.#removeVertex(vertex.dataset.edgeId!, Number(vertex.dataset.index))
      return
    }
    const target = this.#targetOf(event)
    if (target?.kind === 'node')
      emitEvent(this, 'node-dblclick', { id: target.id })
  }

  readonly #onContextMenu = (event: MouseEvent): void => {
    const target = this.#targetOf(event)
    const position = { x: event.clientX, y: event.clientY }
    if (target && !(target.kind === 'node' ? this.#editor.selection.nodes : this.#editor.selection.edges).includes(target.id))
      this.#editor.select(target.kind === 'node' ? { nodes: [target.id] } : { edges: [target.id] })
    const proceed = target
      ? emitEvent(this, `${target.kind}-contextmenu`, { id: target.id, ...position }, { cancelable: true })
      : emitEvent(this, 'blank-contextmenu', position, { cancelable: true })
    if (!proceed) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    if (this.#layers)
      this.#prepareMenu(this.#layers.menu, target?.kind ?? 'blank')
  }

  #translations(): FlowDesignerTranslations {
    return this.#config.translations<FlowDesignerTranslations>(FLOW_DESIGNER_TAG, DEFAULT_FLOW_DESIGNER_TRANSLATIONS, this.translations)
  }

  /** 四款共用的命令文案：designer-shell 语言包的 xh-designer-commands 一桶。 */
  #commandTranslations(): DesignerCommandsTranslations {
    return this.#config.translations<DesignerCommandsTranslations>('xh-designer-commands', DESIGNER_COMMANDS_EN_US)
  }

  readonly #onWheel = (event: WheelEvent): void => {
    event.preventDefault()
    if (event.ctrlKey || event.metaKey) {
      const box = this.#layers!.root.getBoundingClientRect()
      this.setViewport(zoomBy(this.#viewport, wheelZoomFactor(event.deltaY, event.deltaMode), { x: event.clientX - box.left, y: event.clientY - box.top }))
      return
    }
    const pixels = wheelPixels(event, { page: this.#size()?.height })
    this.setViewport(panBy(this.#viewport, -pixels.x, -pixels.y))
  }

  /** 写进系统剪贴板，只写 text/plain；写不进时内容只留在设计器内。 */
  #writeSystemClipboard(clipboard: FlowClipboard): void {
    this.ownerDocument.defaultView?.navigator.clipboard?.writeText(encodeFlowClipboard(clipboard)).catch(() => {})
  }

  /** 画布有焦点时，复制、剪切写入剪贴板事件的数据；粘贴读出流程的剪贴板内容，不是时交给导入器。 */
  readonly #onClipboard = (event: ClipboardEvent): void => {
    const data = event.clipboardData
    const root = this.getRootNode() as Document | ShadowRoot
    if (!data || this.#gesture || !this.#layers || root.activeElement !== this.#layers.menu.trigger)
      return
    if (event.type === 'paste') {
      if (this.readonly)
        return
      const content = readFlowClipboard(data)
      if (content)
        this.paste(content)
      else if (!this.canImport || !this.#import(importSources(data, 'clipboard'), this.#viewportCenter()))
        return
      event.preventDefault()
      return
    }
    const copied = event.type === 'copy' ? this.#editor.copy() : this.readonly ? undefined : this.#editor.cut()
    if (!copied)
      return
    writeFlowClipboard(data, copied)
    event.preventDefault()
  }

  /** 有导入器时画布接受从外部拖进来的文件与文本。 */
  readonly #onNativeDragOver = (event: DragEvent): void => {
    if (this.readonly || event.dataTransfer === null || !this.canImport)
      return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  readonly #onNativeDrop = (event: DragEvent): void => {
    if (this.readonly || event.dataTransfer === null || !this.canImport)
      return
    event.preventDefault()
    if (this.#import(importSources(event.dataTransfer, 'drop'), this.clientToWorld(event.clientX, event.clientY)))
      this.#stopAutoFit()
  }

  /** 把来源交给第一个接下的导入器，导入是异步的；没有导入器接下时返回 false。 */
  #import(sources: readonly DesignerImportSource[], at: FlowPoint): boolean {
    const found = findImporter(this.#model.importers, sources)
    if (!found)
      return false
    void this.#runImport(found.importer, found.source, at)
    return true
  }

  /** 导入并放下：片段放在 at 处，整份流程定义换掉当前定义；导入器抛错或结果没有通过检查时派发 import-error。 */
  async #runImport(importer: FlowDesignerImporter, source: DesignerImportSource, at: FlowPoint): Promise<void> {
    try {
      const result = await importer.import(source, this.#context())
      if (result === undefined || this.readonly)
        return
      if ('document' in result)
        this.#replaceDocument(result.document, importer.id)
      else
        this.#placeFragment(result, at, importer.id)
    }
    catch (error) {
      emitEvent(this, 'import-error', { importer: importer.id, source, error })
    }
  }

  /** 片段整体挪到以 at 为中心、左上角吸附网格，按粘贴的规则换新 id 放进流程定义并选中。 */
  #placeFragment(fragment: FlowImportFragment, at: FlowPoint, importer: string): void {
    const read = readFlowFragment(fragment.nodes, fragment.edges ?? [])
    if (!read)
      throw new TypeError(`[flow-designer] importer "${importer}" returned malformed nodes or edges`)
    this.#checkNodeTypes(read.nodes, importer)
    const bounds = unionRects(read.nodes)
    if (!bounds)
      return
    const topLeft = this.#snapToGrid({ x: at.x - bounds.width / 2, y: at.y - bounds.height / 2 })
    const dx = topLeft.x - bounds.x
    const dy = topLeft.y - bounds.y
    this.#editor.paste({
      nodes: read.nodes.map(node => ({ ...node, x: node.x + dx, y: node.y + dy })),
      edges: read.edges.map(edge => edge.vertices === undefined ? edge : { ...edge, vertices: edge.vertices.map(point => ({ x: point.x + dx, y: point.y + dy })) }),
    }, { offset: 0 })
  }

  /** 整份流程定义换掉当前定义，记一步撤销，清空选择，视口随后适配。 */
  #replaceDocument(document: FlowDocument, importer: string): void {
    const read = readDocument(document)
    if (!read.ok || !readFlowFragment(read.document.nodes, read.document.edges))
      throw new TypeError(`[flow-designer] importer "${importer}" returned a malformed flow definition`)
    this.#checkNodeTypes(read.document.nodes, importer)
    this.#applyDocument(read.document)
  }

  /** 整份换上一份读入过的定义（core 的 replaceDocument，记一步撤销）：清空选择，视口随后适配。 */
  #applyDocument(document: FlowDocument): void {
    this.#editor.clearSelection()
    this.#startAutoFit()
    this.#editor.execute([{ type: 'replaceDocument', document }])
  }

  /** 节点类型都已登记；有没登记的抛 TypeError。 */
  #checkNodeTypes(nodes: readonly FlowNode[], importer: string): void {
    const unknown = nodes.find(node => this.#editor.model.nodeTypes.get(node.type) === undefined)
    if (unknown)
      throw new TypeError(`[flow-designer] importer "${importer}" returned node type "${unknown.type}" that is not registered`)
  }

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
      const { nodes, edges } = this.#editor.selection
      if (this.#layers)
        this.#prepareMenu(this.#layers.menu, nodes.length > 0 ? 'node' : edges.length > 0 ? 'edge' : 'blank')
      return
    }
    // Alt + F10 把焦点交给选中工具条，在工具条里按 Esc 回到这里
    if (event.key === 'F10' && event.altKey && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
      if (this.#layers?.transform.focusToolbar())
        event.preventDefault()
      return
    }
    if (event.key === 'Escape' && this.#gesture) {
      this.#cancelGesture()
      event.preventDefault()
      return
    }
    if (this.#gesture)
      return
    const context = this.#context()
    const hit = commandForShortcut(this.#model.commands.values(), event, context, this.#kbdPlatform())
    if (hit) {
      hit.run(context)
      event.preventDefault()
      return
    }
    const command = event.ctrlKey || event.metaKey
    if (command && !event.altKey && this.#onCommandKey(event))
      event.preventDefault()
    else if (!command && !event.altKey && this.#onPlainKey(event))
      event.preventDefault()
  }

  /** 没有命令占用的修饰键组合：Ctrl / ⌘ + S 派发 save。 */
  #onCommandKey(event: KeyboardEvent): boolean {
    if (event.key.toLowerCase() !== 's')
      return false
    emitEvent(this, 'save', {})
    return true
  }

  /** 没有命令占用的单键：Backspace 删除，= 与按着 Shift 的 + 放大，方向键微移选中的节点或平移视口。 */
  #onPlainKey(event: KeyboardEvent): boolean {
    switch (event.key) {
      case 'Backspace':
        return this.deleteSelection()
      case '+':
      case '=':
        this.zoomIn()
        return true
    }
    const delta = nudgeDelta(event.key, { large: event.shiftKey, largeStep: this.#gridStep() })
    if (!delta)
      return false
    const ids = this.#editor.selection.nodes
    if (ids.length > 0 && !this.readonly) {
      this.#editor.moveNodes(ids, delta.dx, delta.dy, { merge: nudgeMergeKey(ids), mergeWithin: HISTORY_NUDGE_MERGE_WITHIN })
      return true
    }
    this.setViewport(panBy(this.#viewport, -Math.sign(delta.dx) * PAN_STEP, -Math.sign(delta.dy) * PAN_STEP))
    return true
  }
}

/**
 * 注册 <xh-flow-designer> 与它用到的 UI 元素、设计器零件（零件各自带上它们内部用的 UI 元素）；
 * 宿主不必再全量注册。重复调用不报错。
 */
export function defineFlowDesigner(): void {
  defineXhElement('xh-icon', XhIconElement)
  defineXhElement('xh-toolbar', XhToolbarElement)
  defineXhElement('xh-context-menu', XhContextMenuElement)
  defineXhElement('xh-field-array', XhFieldArrayElement)
  defineXhElement('xh-checkbox', XhCheckboxElement)
  defineDesignerShellElement('xh-designer-frame', XhDesignerFrameElement)
  defineDesignerShellElement('xh-designer-tour', XhDesignerTourElement)
  defineDesignerShellElement('xh-designer-json-editor', XhDesignerJsonEditorElement)
  defineDesignerShellElement('xh-designer-palette', XhDesignerPaletteElement)
  defineDesignerShellElement('xh-designer-properties', XhDesignerPropertiesElement)
  defineDesignerShellElement('xh-designer-issues', XhDesignerIssuesElement)
  defineDesignerShellElement('xh-designer-minimap', XhDesignerMinimapElement)
  defineDesignerShellElement('xh-designer-transform', XhDesignerTransformElement)
  defineDesignerShellElement('xh-designer-settings', XhDesignerSettingsElement)
  registerElement(FLOW_DESIGNER_TAG, XhFlowDesigner)
}

/** 父元素里 data-* 等于 value 的直接子元素。 */
function childWith(parent: HTMLElement, key: string, value: string): HTMLElement | null {
  for (const child of Array.from(parent.children)) {
    if (child instanceof HTMLElement && child.dataset[key] === value)
      return child
  }
  return null
}

/** 端口的显示名写进端口里的 port-label；没有显示名时撤掉。 */
function paintPortLabel(port: HTMLElement, label: string | undefined): void {
  let text = port.firstElementChild as HTMLElement | null
  if (label === undefined) {
    text?.remove()
    return
  }
  if (!text) {
    text = createGeneratedElement(port.ownerDocument, 'span')
    text.dataset.part = 'port-label'
    port.append(text)
  }
  if (text.textContent !== label)
    text.textContent = label
}

function placeBox(element: HTMLElement, rect: FlowRect | undefined): void {
  element.hidden = rect === undefined
  if (!rect)
    return
  element.style.left = `${rect.x}px`
  element.style.top = `${rect.y}px`
  element.style.width = `${rect.width}px`
  element.style.height = `${rect.height}px`
}

function svgLayer(doc: Document, part: string): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, 'svg')
  svg.setAttribute(GEN_ATTR, '')
  svg.setAttribute('data-part', part)
  svg.setAttribute('aria-hidden', 'true')
  return svg
}

function placeSvgLayer(svg: SVGSVGElement, bounds: FlowRect | undefined): void {
  const box = bounds ? expandRect(bounds, EDGE_LAYER_MARGIN) : { x: 0, y: 0, width: 0, height: 0 }
  svg.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`)
  svg.setAttribute('width', String(box.width))
  svg.setAttribute('height', String(box.height))
  svg.style.left = `${box.x}px`
  svg.style.top = `${box.y}px`
}

function createEdgeGroup(doc: Document): SVGGElement {
  const group = doc.createElementNS(SVG_NS, 'g')
  group.setAttribute(GEN_ATTR, '')
  group.setAttribute('data-part', 'edge')
  for (const part of ['edge-hit', 'edge-line', 'edge-arrow']) {
    const path = doc.createElementNS(SVG_NS, 'path')
    path.setAttribute('data-part', part)
    group.append(path)
  }
  return group
}

function paintEdge(group: Element, edge: FlowSceneEdge, selected: boolean, highlighted: boolean): void {
  group.setAttribute('data-edge-id', edge.id)
  toggleAttribute(group, 'data-dashed', edge.dashed)
  toggleAttribute(group, 'data-selected', selected)
  toggleAttribute(group, 'data-highlighted', highlighted)
  const [hit, line, arrow] = Array.from(group.children)
  hit!.setAttribute('d', edge.path)
  line!.setAttribute('d', edge.path)
  arrow!.setAttribute('d', edge.arrow)
}

function toggleAttribute(element: Element, name: string, on: boolean): void {
  if (on)
    element.setAttribute(name, '')
  else
    element.removeAttribute(name)
}

function toggleData(element: HTMLElement, key: string, value: string | undefined): void {
  if (value === undefined)
    delete element.dataset[key]
  else
    element.dataset[key] = value
}

declare global {
  interface HTMLElementTagNameMap {
    'xh-flow-designer': XhFlowDesigner
  }
}
