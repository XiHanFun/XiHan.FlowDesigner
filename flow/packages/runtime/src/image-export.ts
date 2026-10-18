/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 把画面上的流程图导出成图片：按场景与元素此刻的计算样式画成一份能单独打开的 SVG
// （节点的框、图标与文字，连线、箭头与标签），颜色与字体都是算好的具体值；PNG 在它上面栅格化。
// 颜色一律写成 sRGB 的 #rrggbb，自带的透明度写进 fill-opacity / stroke-opacity；字体写在根上，与根相同的文字不再重复写。

import type { FlowRect } from '@xihan-flow/core'
import type { FlowScene, FlowSceneNode } from './scene'
import { colorParse, colorRgbaToHex } from '@xihan-ui/core/color'
import { rasterizeSvg, serializeSvg, standaloneSvg } from '@xihan-ui/core/svg-export'

const SVG_NS = 'http://www.w3.org/2000/svg'
const DEFAULT_PADDING = 24
/** 连线层克隆根上只管它自己画布的属性，其余（表现属性）挪到放连线的组上，子元素照旧从它继承。 */
const LAYER_GEOMETRY: ReadonlySet<string> = new Set(['viewBox', 'width', 'height', 'x', 'y', 'preserveAspectRatio'])
/** 文字的字体属性：根上写一份，与根相同的文字不再写。 */
const FONT_PROPERTIES = ['font-family', 'font-size', 'font-weight', 'font-style'] as const

type FontAttributes = Readonly<Record<(typeof FONT_PROPERTIES)[number], string | undefined>>

/** 导出图片的格式。 */
export type FlowImageFormat = 'svg' | 'png'

/** 导出图片的选项。 */
export interface FlowImageExportOptions {
  /** 倍率，只对 PNG 有效：PNG 的像素宽高是图的宽高乘它，缺省 1；超过浏览器画布的上限时自动降倍率，图按比例缩小。 */
  readonly scale?: number
  /** 底色，任何 CSS 颜色；缺省取画布此刻的底色（画布透明时往外找到第一层不透明的），写 'transparent' 不铺。 */
  readonly background?: string
  /** 流程图四周的留白，缺省 24。 */
  readonly padding?: number
}

/** 画出图片要读的活元素：场景、画布上的连线层、节点与连线标签的元素，以及视口的缩放。 */
export interface FlowImageSource {
  readonly scene: FlowScene
  /** 画布元素：缺省底色从它开始找。 */
  readonly canvas: Element
  /** 连线所在的 SVG 层，里面的坐标是世界坐标。 */
  readonly edges: SVGSVGElement
  /** 节点 id → 画面上的节点元素。 */
  readonly node: (id: string) => HTMLElement | null
  /** 连线 id → 画面上的连线标签元素。 */
  readonly label: (id: string) => HTMLElement | null
  /** 视口的缩放：元素在屏幕上的尺寸除以它即世界尺寸。 */
  readonly zoom: number
}

const px = (value: string): number => Number.parseFloat(value) || 0

function isTransparent(color: string): boolean {
  return color === '' || color === 'transparent' || colorParse(color)?.a === 0
}

/** 一种颜色在 SVG 里的写法：认得的换成 sRGB 的 #rrggbb 与透明度（不透明时没有），认不出的原样给出。 */
function paintOf(color: string): { readonly paint: string, readonly opacity: string | undefined } {
  const rgba = colorParse(color)
  if (!rgba)
    return { paint: color, opacity: undefined }
  return { paint: colorRgbaToHex(rgba), opacity: rgba.a < 1 ? String(Math.round(rgba.a * 1000) / 1000) : undefined }
}

/** 填充色写成 fill 与 fill-opacity 两个属性。 */
function fillOf(color: string): Record<string, string | undefined> {
  const { paint, opacity } = paintOf(color)
  return { 'fill': paint, 'fill-opacity': opacity }
}

/** 元素算出的字体；font-style 是 normal 时不写。 */
function fontOf(style: CSSStyleDeclaration): FontAttributes {
  return {
    'font-family': style.fontFamily,
    'font-size': style.fontSize,
    'font-weight': style.fontWeight,
    'font-style': style.fontStyle === 'normal' ? undefined : style.fontStyle,
  }
}

/** 画布此刻的底色：画布透明时往外找第一层不透明的背景；都透明时为 undefined。 */
function canvasBackground(canvas: Element): string | undefined {
  for (let element: Element | null = canvas; element; element = element.parentElement) {
    const color = getComputedStyle(element).backgroundColor
    if (!isTransparent(color))
      return color
  }
  return undefined
}

/** 在 SVG 命名空间里建元素，写上属性；undefined 与空串（算不出的样式）不写。xmlns 交给序列化时写出。 */
function create<K extends keyof SVGElementTagNameMap>(doc: Document, tag: K, attributes: Readonly<Record<string, string | number | undefined>>): SVGElementTagNameMap[K] {
  const element = doc.createElementNS(SVG_NS, tag)
  for (const [name, value] of Object.entries(attributes)) {
    if (value !== undefined && value !== '')
      element.setAttribute(name, String(value))
  }
  return element
}

/** 一段文字：取元素的颜色与字体，居中写在 box 的中心；字体与根上的相同时不写，交给继承。 */
function textOf(doc: Document, content: string, style: CSSStyleDeclaration, box: FlowRect, rootFont: FontAttributes): SVGTextElement {
  const font = fontOf(style)
  const own = Object.fromEntries(FONT_PROPERTIES.map(name => [name, font[name] === rootFont[name] ? undefined : font[name] ?? 'normal']))
  const text = create(doc, 'text', {
    'x': box.x + box.width / 2,
    'y': box.y + box.height / 2,
    'text-anchor': 'middle',
    'dominant-baseline': 'central',
    ...fillOf(style.color),
    ...own,
  })
  text.textContent = content
  return text
}

/** 一个带边框的框：border-box 的边框画在框内，描边沿边框中线。 */
function boxOf(doc: Document, style: CSSStyleDeclaration, box: FlowRect): SVGRectElement | undefined {
  const stroke = px(style.borderTopWidth)
  const filled = !isTransparent(style.backgroundColor)
  const hasStroke = stroke > 0 && style.borderTopStyle !== 'none' && !isTransparent(style.borderTopColor)
  if (!filled && !hasStroke)
    return undefined
  const line = hasStroke ? paintOf(style.borderTopColor) : undefined
  return create(doc, 'rect', {
    'x': box.x + (hasStroke ? stroke / 2 : 0),
    'y': box.y + (hasStroke ? stroke / 2 : 0),
    'width': Math.max(0, box.width - (hasStroke ? stroke : 0)),
    'height': Math.max(0, box.height - (hasStroke ? stroke : 0)),
    'rx': px(style.borderTopLeftRadius) || undefined,
    ...(filled ? fillOf(style.backgroundColor) : { fill: 'none' }),
    'stroke': line?.paint,
    'stroke-opacity': line?.opacity,
    'stroke-width': hasStroke ? stroke : undefined,
    'stroke-dasharray': hasStroke && style.borderTopStyle === 'dashed' ? `${stroke * 3} ${stroke * 2}` : undefined,
  })
}

/** 子元素相对节点框的位置，换成世界坐标。 */
function placeWithin(node: FlowRect, nodeBox: DOMRect, inner: DOMRect, zoom: number): FlowRect {
  return {
    x: node.x + (inner.left - nodeBox.left) / zoom,
    y: node.y + (inner.top - nodeBox.top) / zoom,
    width: inner.width / zoom,
    height: inner.height / zoom,
  }
}

/** 节点：框、图标与文字。自定义渲染画的其余内容不导出，只按节点的文字写一行。 */
function drawNode(doc: Document, sceneNode: FlowSceneNode, element: HTMLElement, zoom: number, rootFont: FontAttributes): SVGGElement {
  const group = create(doc, 'g', {})
  const style = getComputedStyle(element)
  const box = boxOf(doc, style, sceneNode.rect)
  if (box)
    group.append(box)
  const nodeBox = element.getBoundingClientRect()
  const iconSvg = element.querySelector<SVGSVGElement>(':scope > [data-part="node-icon"] svg')
  if (iconSvg) {
    const at = placeWithin(sceneNode.rect, nodeBox, iconSvg.getBoundingClientRect(), zoom)
    const icon = standaloneSvg(iconSvg)
    for (const name of FONT_PROPERTIES) {
      if (icon.getAttribute(name) === rootFont[name])
        icon.removeAttribute(name)
    }
    icon.setAttribute('x', String(at.x))
    icon.setAttribute('y', String(at.y))
    icon.setAttribute('width', String(at.width))
    icon.setAttribute('height', String(at.height))
    group.append(icon)
  }
  const labelElement = element.querySelector<HTMLElement>(':scope > [data-part="node-label"]')
  const range = element.ownerDocument.createRange()
  range.selectNodeContents(labelElement ?? element)
  const measured = typeof range.getBoundingClientRect === 'function' ? range.getBoundingClientRect() : undefined
  const at = measured && measured.width > 0 ? placeWithin(sceneNode.rect, nodeBox, measured, zoom) : sceneNode.rect
  group.append(textOf(doc, sceneNode.label, getComputedStyle(labelElement ?? element), at, rootFont))
  return group
}

/** 连线标签：标签元素的底色与边框画成框，文字居中，中心在标签点上。 */
function drawLabel(doc: Document, text: string, center: { x: number, y: number }, element: HTMLElement, zoom: number, rootFont: FontAttributes): SVGGElement {
  const group = create(doc, 'g', {})
  const style = getComputedStyle(element)
  const rect = element.getBoundingClientRect()
  const width = rect.width / zoom
  const height = rect.height / zoom
  const box = { x: center.x - width / 2, y: center.y - height / 2, width, height }
  const frame = boxOf(doc, style, box)
  if (frame)
    group.append(frame)
  group.append(textOf(doc, text, style, box, rootFont))
  return group
}

/**
 * 把画面上的流程图画成一份能单独打开的 SVG：连线层经 standaloneSvg 克隆（只供命中的透明粗线不要，克隆根上的表现属性
 * 挪到放连线的组上），节点按计算样式画成框、图标与文字，连线标签画成底框与文字；四周留白，按选项铺底色。
 * 颜色写成 sRGB 的 #rrggbb，透明度写进 fill-opacity / stroke-opacity；画布的字体写在根上，文字只写与它不同的那几项。
 * 坐标是世界坐标，1 个单位即 1 像素。流程图是空的时抛 RangeError。
 */
export function flowImageSvg(source: FlowImageSource, options: FlowImageExportOptions = {}): SVGSVGElement {
  const bounds = source.scene.bounds
  if (!bounds)
    throw new RangeError('[flow] 流程图是空的，没有可导出的内容')
  const doc = source.edges.ownerDocument
  const padding = options.padding ?? DEFAULT_PADDING
  const area = { x: bounds.x - padding, y: bounds.y - padding, width: bounds.width + padding * 2, height: bounds.height + padding * 2 }
  const rootFont = fontOf(getComputedStyle(source.canvas))
  const root = create(doc, 'svg', {
    width: area.width,
    height: area.height,
    viewBox: `${area.x} ${area.y} ${area.width} ${area.height}`,
    ...rootFont,
  })
  const background = options.background ?? canvasBackground(source.canvas)
  if (background !== undefined && background !== 'transparent')
    root.append(create(doc, 'rect', { ...area, ...fillOf(background) }))

  const edges = standaloneSvg(source.edges, { include: element => element.getAttribute('data-part') !== 'edge-hit' })
  const edgeGroup = create(doc, 'g', {})
  for (const attribute of Array.from(edges.attributes)) {
    if (!LAYER_GEOMETRY.has(attribute.name) && root.getAttribute(attribute.name) !== attribute.value)
      edgeGroup.setAttribute(attribute.name, attribute.value)
  }
  edgeGroup.append(...Array.from(edges.childNodes))
  root.append(edgeGroup)

  for (const edge of source.scene.edges) {
    const element = edge.label === undefined || edge.labelPoint === undefined ? null : source.label(edge.id)
    if (element)
      root.append(drawLabel(doc, edge.label!, edge.labelPoint!, element, source.zoom, rootFont))
  }
  for (const sceneNode of source.scene.nodes) {
    const element = source.node(sceneNode.id)
    if (element)
      root.append(drawNode(doc, sceneNode, element, source.zoom, rootFont))
  }
  return root
}

/**
 * 导出成图片：SVG 是 flowImageSvg 的文本，PNG 在它上面按倍率栅格化（底色已画进 SVG），超过画布上限时按比例缩小。
 * PNG 里的文字用本机的系统字体画，不加载网页字体。
 */
export async function exportFlowImage(source: FlowImageSource, format: FlowImageFormat, options: FlowImageExportOptions = {}): Promise<Blob> {
  const svg = flowImageSvg(source, options)
  if (format === 'svg')
    return new Blob([serializeSvg(svg)], { type: 'image/svg+xml' })
  return rasterizeSvg(svg, { scale: options.scale, oversize: 'shrink' })
}
