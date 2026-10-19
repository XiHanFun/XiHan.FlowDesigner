/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 从源码生成 reference/ 下的参考页：类型、元素的属性、方法与事件取自 flow/packages 的 TypeScript 源码与注释，
// 问题码与缺省严重程度取自 @xihan-flow/core，问题的中文说明取自 flowZhCN。
// 带 --check 时只比对，与已提交的页面不一致就列出并以非零退出。

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { DEFAULT_ISSUE_SEVERITY } from '@xihan-flow/core'
import { createXihanWorkflow, xihanWorkflowZhCN } from '@xihan-flow/core/presets/xihan-workflow'
import { flowZhCN } from '@xihan-flow/runtime/locale'
import { formatJsonPath } from '@xihan-ui/core/json'
import ts from 'typescript'

const docsDir = fileURLToPath(new URL('../', import.meta.url))
const repoDir = join(docsDir, '..')
const checkOnly = process.argv.includes('--check')

const GENERATED = '<!-- 本页由 docs/scripts/gen-reference.mjs 从源码生成，不要手改；源码变了之后在 docs/ 运行 pnpm gen。 -->'

function packageSource(...parts) {
  return join(repoDir, 'flow', 'packages', ...parts)
}

// —— Markdown ——

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 行内代码；含 {{ 的写成 v-pre 的 <code>，免得被当成 Vue 插值。 */
function code(text, cell = false) {
  if (text.includes('{{'))
    return `<code v-pre>${escapeHtml(text).replace(/\|/g, '&#124;')}</code>`
  const body = cell ? text.replace(/\|/g, '\\|') : text
  return body.includes('`') ? `\`\` ${body} \`\`` : `\`${body}\``
}

/** 注释里的一段话：反引号里的按代码写，其余转义尖括号、花括号与表格里的竖线。 */
function prose(text, cell = false) {
  return text.split(/(`[^`]*`)/).map((part, index) => {
    if (index % 2 === 1)
      return code(part.slice(1, -1), cell)
    const escaped = escapeHtml(part).replace(/\{\{/g, '&#123;&#123;')
    return cell ? escaped.replace(/\|/g, '\\|') : escaped
  }).join('')
}

/** 注释里折行的两段接起来：两边都是 ASCII 字母数字时补一个空格。 */
function joinWrapped(left, right) {
  return /[\w)]$/.test(left) && /^[\w(`]/.test(right) ? `${left} ${right}` : `${left}${right}`
}

/** 注释按段落与列表项分块：普通行接到上一块，列表项另起一块。 */
function docBlocks(doc) {
  const blocks = []
  for (const line of doc.split('\n').map(item => item.trim()).filter(Boolean)) {
    if (line.startsWith('- ') || blocks.length === 0)
      blocks.push(line)
    else
      blocks[blocks.length - 1] = joinWrapped(blocks.at(-1), line)
  }
  return blocks
}

/** 注释写进表格单元格：并成一行，列表项另起一行。 */
function cellDoc(doc) {
  return docBlocks(doc).map(block => prose(block, true)).join('<br>')
}

/** 注释写成段落：列表项保留为 Markdown 列表。 */
function blockDoc(doc) {
  return docBlocks(doc).map((block, index) => {
    const text = prose(block)
    if (index === 0)
      return text
    return block.startsWith('- ') ? `\n${text}` : `\n\n${text}`
  }).join('')
}

function table(head, rows) {
  if (rows.length === 0)
    return ''
  return [
    `| ${head.join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function page(title, intro, sections) {
  return `${[`# ${title}`, GENERATED, intro, ...sections].filter(Boolean).join('\n\n')}\n`
}

function anchorOf(name) {
  return name.toLowerCase()
}

// —— TypeScript 源码 ——

const sourceCache = new Map()

function sourceFile(file) {
  let source = sourceCache.get(file)
  if (source === undefined) {
    source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
    sourceCache.set(file, source)
  }
  return source
}

/** 节点源码并成一行；类型声明文件里类型字面量的分号分隔换成逗号，与源码的写法一致。 */
function flat(node) {
  return node.getText().replace(/\s+/g, ' ').trim().replace(/;\s*\}/g, ' }').replace(/;\s+/g, ', ')
}

/** 节点的注释原文：按行去掉注释符号，文中的 @xihan-ui/... 之类不当作标签。 */
function jsdoc(node) {
  const doc = ts.getJSDocCommentsAndTags(node).filter(item => item.kind === ts.SyntaxKind.JSDoc).at(-1)
  if (doc === undefined)
    return ''
  return doc.getText()
    .replace(/^\/\*\*/, '')
    .replace(/\*\/$/, '')
    .split('\n')
    .map(line => line.replace(/^\s*\* ?/, '').trimEnd())
    .join('\n')
    .trim()
}

function nameOf(node) {
  const name = node.name
  if (name === undefined)
    return ''
  return ts.isStringLiteral(name) || ts.isIdentifier(name) || ts.isPrivateIdentifier(name) ? name.text : name.getText()
}

function hasModifier(node, kind) {
  return ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some(modifier => modifier.kind === kind)
}

function isExported(statement) {
  return hasModifier(statement, ts.SyntaxKind.ExportKeyword)
}

function declarationsOf(source) {
  const found = new Map()
  for (const statement of source.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations)
        found.set(declaration.name.getText(), { node: declaration, statement, exported: isExported(statement) })
      continue
    }
    const name = nameOf(statement)
    if (name !== '')
      found.set(name, { node: statement, statement, exported: isExported(statement) })
  }
  return found
}

function declaration(file, name) {
  const found = declarationsOf(sourceFile(file)).get(name)
  if (found === undefined)
    throw new Error(`[gen-reference] ${name} not found in ${file}`)
  return found
}

/** 参数列表：带缺省值的参数写成可选，不写缺省值。 */
function parameters(node) {
  return node.parameters.map((parameter) => {
    const optional = parameter.questionToken !== undefined || parameter.initializer !== undefined
    const rest = parameter.dotDotDotToken === undefined ? '' : '...'
    const type = parameter.type === undefined ? '' : `: ${flat(parameter.type)}`
    return `${rest}${parameter.name.getText()}${optional ? '?' : ''}${type}`
  }).join(', ')
}

function signature(name, node) {
  const typeParameters = node.typeParameters === undefined ? '' : `<${node.typeParameters.map(flat).join(', ')}>`
  const returns = node.type === undefined ? '' : `: ${flat(node.type)}`
  return `${name}${typeParameters}(${parameters(node)})${returns}`
}

/** 接口的成员：函数类型的属性当作方法。 */
function interfaceMembers(file, name) {
  const { node } = declaration(file, name)
  if (!ts.isInterfaceDeclaration(node))
    throw new Error(`[gen-reference] ${name} is not an interface`)
  return node.members.map((member) => {
    const memberName = nameOf(member)
    const doc = jsdoc(member)
    const optional = member.questionToken !== undefined
    const readonly = hasModifier(member, ts.SyntaxKind.ReadonlyKeyword)
    if (ts.isMethodSignature(member))
      return { kind: 'method', name: memberName, signature: signature(memberName, member), doc, optional }
    if (ts.isPropertySignature(member) && member.type !== undefined && ts.isFunctionTypeNode(member.type))
      return { kind: 'method', name: memberName, signature: signature(memberName, member.type), doc, optional }
    return { kind: 'property', name: memberName, type: member.type === undefined ? 'unknown' : flat(member.type), doc, optional, readonly }
  })
}

function heritageOf(node) {
  return (node.heritageClauses ?? []).flatMap(clause => clause.types.map(flat))
}

function classMembers(file, className) {
  const { node } = declaration(file, className)
  const config = new Map()
  const properties = []
  const accessors = new Map()
  const methods = []
  for (const member of node.members) {
    const name = nameOf(member)
    const isStatic = hasModifier(member, ts.SyntaxKind.StaticKeyword)
    if (isStatic && ts.isPropertyDeclaration(member) && name === 'properties' && member.initializer !== undefined && ts.isObjectLiteralExpression(member.initializer)) {
      for (const property of member.initializer.properties) {
        const options = {}
        if (ts.isObjectLiteralExpression(property.initializer)) {
          for (const item of property.initializer.properties)
            options[nameOf(item)] = item.initializer.getText()
        }
        config.set(nameOf(property), options)
      }
      continue
    }
    if (isStatic || ts.isPrivateIdentifier(member.name ?? member) || hasModifier(member, ts.SyntaxKind.ProtectedKeyword) || hasModifier(member, ts.SyntaxKind.PrivateKeyword))
      continue
    if (ts.isPropertyDeclaration(member) && hasModifier(member, ts.SyntaxKind.DeclareKeyword)) {
      properties.push({ name, type: flat(member.type), doc: jsdoc(member) })
      continue
    }
    if (ts.isGetAccessorDeclaration(member)) {
      const entry = accessors.get(name) ?? { name }
      Object.assign(entry, { type: flat(member.type), doc: jsdoc(member) || entry.doc })
      accessors.set(name, entry)
      continue
    }
    if (ts.isSetAccessorDeclaration(member)) {
      const entry = accessors.get(name) ?? { name }
      Object.assign(entry, { writable: true, doc: entry.doc || jsdoc(member) })
      accessors.set(name, entry)
      continue
    }
    if (ts.isMethodDeclaration(member) && !hasModifier(member, ts.SyntaxKind.OverrideKeyword))
      methods.push({ name, signature: signature(name, member), doc: jsdoc(member) })
  }
  const attribute = (name) => {
    const options = config.get(name)
    if (options === undefined || options.attribute === 'false')
      return undefined
    if (options.attribute !== undefined)
      return options.attribute.replace(/^'|'$/g, '')
    return name.toLowerCase()
  }
  return {
    properties: properties.filter(property => config.has(property.name)).map(property => ({ ...property, attribute: attribute(property.name) })),
    accessors: [...accessors.values()],
    methods,
  }
}

function constantValue(file, name) {
  return flat(declaration(file, name).node.initializer)
}

function functionSignature(file, name) {
  const { node } = declaration(file, name)
  return { signature: signature(name, node), doc: jsdoc(node) }
}

// —— 渲染元素 API ——

function memberTable(members) {
  const properties = members.filter(member => member.kind === 'property')
  return table(['属性', '类型', '说明'], properties.map(member => [
    code(member.optional ? `${member.name}?` : member.name, true),
    code(member.type, true),
    cellDoc(member.doc),
  ]))
}

function methodTable(methods) {
  return table(['方法', '说明'], methods.map(method => [code(method.signature, true), cellDoc(method.doc)]))
}

/** 类型参数写成一句；没有时为空串。 */
function typeParametersLine(node) {
  return node.typeParameters === undefined ? '' : `类型参数 ${node.typeParameters.map(item => code(flat(item))).join('、')}。`
}

/** 接口的说明与成员表；omit 里的成员不列出。 */
function interfaceSection(file, name, level = '###', intro = '', omit = []) {
  const { node } = declaration(file, name)
  const members = interfaceMembers(file, name).filter(member => !omit.includes(member.name))
  const heritage = heritageOf(node)
  const methods = members.filter(member => member.kind === 'method')
  return [
    `${level} ${name} {#${anchorOf(name)}}`,
    blockDoc(jsdoc(node)),
    intro,
    typeParametersLine(node),
    heritage.length > 0 ? `继承 ${heritage.map(item => code(item)).join('、')}。` : '',
    memberTable(members),
    methodTable(methods),
  ].filter(Boolean).join('\n\n')
}

function eventTable(file, name) {
  return table(['事件', 'detail', '说明'], interfaceMembers(file, name).map((member) => {
    const detail = /^CustomEvent<(.*)>$/.exec(member.type)?.[1] ?? member.type
    return [code(member.name, true), code(detail, true), cellDoc(member.doc)]
  }))
}

function elementSections(file, className, eventMap) {
  const { properties, accessors, methods } = classMembers(file, className)
  return [
    '### 属性',
    table(['属性', 'attribute', '类型', '说明'], properties.map(property => [
      code(property.name, true),
      property.attribute === undefined ? '—' : code(property.attribute, true),
      code(property.type, true),
      cellDoc(property.doc),
    ])),
    accessors.length > 0 ? '### 存取器' : '',
    table(['属性', '读写', '类型', '说明'], accessors.map(accessor => [
      code(accessor.name, true),
      accessor.writable ? '可读写' : '只读',
      code(accessor.type, true),
      cellDoc(accessor.doc ?? ''),
    ])),
    '### 方法',
    methodTable(methods),
    '### 事件',
    '事件都是冒泡的 `CustomEvent`。',
    eventTable(file, eventMap),
  ].filter(Boolean).join('\n\n')
}

/** 函数签名写成 TypeScript 代码块。 */
function fence(text) {
  return `\`\`\`ts\ndeclare function ${text}\n\`\`\``
}

function functionSection(file, name) {
  const { signature: text, doc } = functionSignature(file, name)
  return [`### ${name}() {#${anchorOf(name)}}`, fence(text), blockDoc(doc)].filter(Boolean).join('\n\n')
}

// —— 全部导出 ——

function resolveModule(fromFile, specifier) {
  const base = join(dirname(fromFile), specifier)
  for (const candidate of [`${base}.ts`, join(base, 'index.ts')]) {
    if (existsSync(candidate))
      return candidate
  }
  throw new Error(`[gen-reference] cannot resolve ${specifier} from ${fromFile}`)
}

const KIND_NAMES = {
  [ts.SyntaxKind.FunctionDeclaration]: '函数',
  [ts.SyntaxKind.ClassDeclaration]: '类',
  [ts.SyntaxKind.InterfaceDeclaration]: '接口',
  [ts.SyntaxKind.TypeAliasDeclaration]: '类型',
  [ts.SyntaxKind.VariableDeclaration]: '常量',
}

/** 注释的第一句。 */
function summary(doc) {
  const first = docBlocks(doc)[0] ?? ''
  const stop = first.indexOf('。')
  return stop >= 0 ? first.slice(0, stop + 1) : first
}

/** 入口文件导出的全部名字，按来源模块分组；转导出的外部包标注来源。 */
function exportIndex(entry) {
  const groups = new Map()
  const add = (module, name, info) => {
    const list = groups.get(module) ?? []
    if (!list.some(item => item.name === name))
      list.push({ name, ...info })
    groups.set(module, list)
  }
  const describe = (file, name) => {
    const found = declarationsOf(sourceFile(file)).get(name)
    if (found === undefined)
      return { kind: '—', doc: '' }
    return { kind: KIND_NAMES[found.node.kind] ?? '—', doc: summary(jsdoc(found.node.kind === ts.SyntaxKind.VariableDeclaration ? found.statement : found.node)) }
  }
  const collect = (file, module) => {
    const source = sourceFile(file)
    for (const statement of source.statements) {
      if (ts.isExportDeclaration(statement)) {
        const specifier = statement.moduleSpecifier?.text
        if (specifier === undefined)
          continue
        if (!specifier.startsWith('.')) {
          for (const element of statement.exportClause?.elements ?? [])
            add(module, element.name.text, { kind: '类型', doc: `转导出自 ${specifier}` })
          continue
        }
        const target = resolveModule(file, specifier)
        const targetModule = target.slice(entry.root.length + 1).replace(/\\/g, '/').replace(/\.ts$/, '')
        if (statement.exportClause === undefined) {
          collect(target, targetModule)
          continue
        }
        for (const element of statement.exportClause.elements)
          add(targetModule, element.name.text, describe(target, (element.propertyName ?? element.name).text))
        continue
      }
      if (!isExported(statement))
        continue
      if (ts.isVariableStatement(statement)) {
        for (const item of statement.declarationList.declarations)
          add(module, item.name.getText(), { kind: '常量', doc: summary(jsdoc(statement)) })
        continue
      }
      const name = nameOf(statement)
      if (name !== '')
        add(module, name, { kind: KIND_NAMES[statement.kind] ?? '—', doc: summary(jsdoc(statement)) })
    }
  }
  collect(entry.file, entry.file.slice(entry.root.length + 1).replace(/\\/g, '/').replace(/\.ts$/, ''))
  return groups
}

function exportIndexSection(title, entry) {
  const groups = exportIndex(entry)
  const parts = [`## ${title}`]
  for (const [module, items] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    parts.push(`### ${module}`)
    parts.push(table(['名称', '种类', '说明'], items.sort((a, b) => a.name.localeCompare(b.name)).map(item => [code(item.name, true), item.kind, prose(item.doc, true)])))
  }
  return parts.join('\n\n')
}

// —— 流程定义类型 ——

function schemaPage() {
  const file = packageSource('core', 'src', 'schema.ts')
  const version = constantValue(file, 'FLOW_DOCUMENT_VERSION')
  return page('流程定义类型', `流程定义（${code('FlowDocument')}）是纯 JSON，下面的类型取自 ${code('@xihan-flow/core')} 的源码。当前的版本号 ${code('FLOW_DOCUMENT_VERSION')} 是 ${code(version)}，读入版本不符的定义报 ${code('document.unsupported-version')}。怎么读入与校验见[流程定义结构](../guide/schema)。`, [
    '## 文档',
    interfaceSection(file, 'FlowDocument'),
    functionSection(file, 'createDocument'),
    '## 节点与连线',
    interfaceSection(file, 'FlowNode'),
    interfaceSection(file, 'FlowEdge'),
    interfaceSection(file, 'FlowEndpoint'),
    interfaceSection(file, 'FlowEdgeStyle'),
    '## 几何',
    interfaceSection(file, 'FlowPoint'),
    interfaceSection(file, 'FlowSize'),
    interfaceSection(file, 'FlowRect'),
  ])
}

// —— 问题码 ——

const SEVERITY_NAMES = { error: '错误', warning: '警告', info: '提示' }

/** 问题参数一律写成占位：{名字}。 */
const PLACEHOLDER_PARAMS = new Proxy({}, { get: (_, key) => (typeof key === 'string' ? `{${key}}` : undefined) })

/** 中文语言包给这个问题码的说明，节点类型名原样写出。 */
function issueMessage(issueCode) {
  const designer = flowZhCN.translations['xh-flow-designer']
  return designer.issue({ code: issueCode, path: [], severity: 'error', params: PLACEHOLDER_PARAMS }, { nodeType: type => type })
}

function issuesPage() {
  const codes = Object.keys(DEFAULT_ISSUE_SEVERITY)
  return page('问题码', `${code('readDocument')} 读入与 ${code('validateDocument')} 校验给出的问题都带问题码、从文档根算起的路径、所在对象与严重程度，不带文案；设计器的问题列表与属性面板按语言包把问题码换成说明。说明里花括号括起的是问题参数。`, [
    '## 校验',
    `${code('validateDocument')} 按节点类型、属性描述与扩展的规则检查流程定义。下表列出内置的问题码、缺省严重程度与中文语言包的说明；严重程度可以经 ${code('FlowValidateOptions.severity')} 按问题码改写，写 ${code('off')} 即不报告。不带点号的问题码（${codes.filter(item => !item.includes('.')).map(item => code(item)).join('、')}）来自属性的检查，路径落在那个属性上。`,
    table(['问题码', '缺省严重程度', '说明'], codes.map(item => [code(item, true), SEVERITY_NAMES[DEFAULT_ISSUE_SEVERITY[item]], prose(issueMessage(item), true)])),
    '扩展登记的规则自带问题码（如预设的 `xihan-workflow.*`），说明由扩展的 `issueText` 给出。',
    '## 读入',
    `${code('readDocument')} 把未知输入读成流程定义：结构问题用 XiHan.UI ${code('@xihan-ui/designer-kit')} 的通用问题码（取值类型不对、缺少必填字段、多出不认识的字段等），见 [designer-kit 的问题形状](https://ui.docs.xihanfun.com/runtime/designer-kit)。流程自己的读入问题码只有一个：`,
    table(['问题码', '说明'], [[code('document.unsupported-version', true), `${code('version', true)} 不是当前支持的版本；参数 ${code('version', true)} 是读到的版本，${code('supported', true)} 是支持的版本`]]),
  ])
}

// —— 模型层 ——

function corePage() {
  const root = packageSource('core', 'src')
  return page('模型层 core', `${code('@xihan-flow/core')} 是纯 TypeScript 的模型层：流程定义的类型、读入检查、校验、编辑操作、连线几何、节点类型登记与扩展合并，不依赖 DOM，浏览器、Node.js 与其它 JavaScript 运行环境里都能用。流程定义的字段见[流程定义类型](./schema)，问题码见[问题码](./issues)。下表按源码模块列出全部导出。`, [
    exportIndexSection('全部导出', { root, file: join(root, 'index.ts') }),
  ])
}

// —— 查看器 ——

/** 类型别名写成 TypeScript 代码块。 */
function typeSection(file, name) {
  const { node } = declaration(file, name)
  const parameters = node.typeParameters === undefined ? '' : `<${node.typeParameters.map(flat).join(', ')}>`
  return [`### ${name} {#${anchorOf(name)}}`, `\`\`\`ts\ntype ${name}${parameters} = ${flat(node.type)}\n\`\`\``, blockDoc(jsdoc(node))].filter(Boolean).join('\n\n')
}

function viewerPage() {
  const root = packageSource('runtime', 'src')
  const viewer = join(root, 'flow-viewer.ts')
  const extensions = join(root, 'extensions.ts')
  const router = join(root, 'router.ts')
  return page('查看器', `${code('<xh-flow-viewer>')} 在业务页面里显示流程与运行状态，类在 ${code('@xihan-flow/runtime')} 里导出为 ${code('XhFlowViewer')}，调用 ${code('defineFlowViewer()')} 注册。用法见[查看器](../guide/viewer)。`, [
    '## 元素 xh-flow-viewer',
    elementSections(viewer, 'XhFlowViewer', 'FlowViewerEventMap'),
    '## 注册',
    functionSection(viewer, 'defineFlowViewer'),
    '## 节点渲染',
    typeSection(viewer, 'FlowNodeRenderer'),
    interfaceSection(viewer, 'FlowNodeRenderContext'),
    functionSection(join(root, 'node-renderer.ts'), 'defaultNodeRenderer'),
    interfaceSection(extensions, 'FlowRuntimeExtension'),
    functionSection(extensions, 'createFlowRuntimeModel'),
    '## 导出图片',
    typeSection(join(root, 'image-export.ts'), 'FlowImageFormat'),
    interfaceSection(join(root, 'image-export.ts'), 'FlowImageExportOptions'),
    functionSection(join(root, 'image-export.ts'), 'exportFlowImage'),
    functionSection(join(root, 'image-export.ts'), 'flowImageSvg'),
    interfaceSection(join(root, 'image-export.ts'), 'FlowImageSource'),
    '## 连线路由',
    functionSection(router, 'createOrthogonalRouter'),
    interfaceSection(router, 'OrthogonalRouterOptions'),
    '## 文案',
    interfaceSection(join(root, 'translations.ts'), 'FlowViewerTranslations'),
    exportIndexSection('语言包', { root, file: join(root, 'locale', 'index.ts') }),
    exportIndexSection('全部导出', { root, file: join(root, 'index.ts') }),
  ])
}

// —— 设计器 ——

/** 快捷键：Mod 写成 Ctrl / ⌘。 */
function shortcutText(keys) {
  return keys.map(key => (key === 'Mod' ? 'Ctrl / ⌘' : key)).join(' + ')
}

/**
 * designer-shell 的内置命令：...designerShellCommands({ frame, openSettings, helpUrl, startTour, icons }) 给了哪个选项就有哪几条，文案在共用一桶里；
 * 给了 frame 时除「面板」外还有显示或隐藏所有面板、还原面板显隐与恢复默认布局三条（快捷键与 designer-shell 的一致）。
 */
const SHELL_COMMANDS = [
  { id: 'panels', label: 'panels', option: 'frame', shortcut: [] },
  { id: 'panels-toggle-all', label: 'panelsToggleAll', option: 'frame', shortcut: ['Mod', '\\'] },
  { id: 'panels-restore', label: 'panelsRestore', option: 'frame', shortcut: ['Mod', 'Shift', '\\'] },
  { id: 'layout-reset', label: 'layoutReset', option: 'frame', shortcut: [] },
  { id: 'settings', label: 'settings', option: 'openSettings', shortcut: [] },
  { id: 'help', label: 'help', option: 'helpUrl', shortcut: [] },
  { id: 'start-tour', label: 'startTour', option: 'startTour', shortcut: [] },
]

function shellCommands(call) {
  const options = new Map(call.arguments[0].properties.map(property => [nameOf(property), property.initializer]))
  const icons = new Map((options.get('icons')?.properties ?? []).map(property => [nameOf(property), flat(property.initializer)]))
  return SHELL_COMMANDS
    .filter(command => options.has(command.option))
    .map(command => ({ id: command.id, label: command.label, bucket: 'xh-designer-commands', icon: icons.get(command.id), shortcut: command.shortcut, readonly: true }))
}

/** 面板的名字：物料与小地图取设计器文案，属性与问题取那两个零件的标题。 */
const PANEL_TITLES = {
  palette: ['xh-flow-designer', 'palette'],
  minimap: ['xh-flow-designer', 'minimap'],
  properties: ['xh-designer-properties', 'title'],
  issues: ['xh-designer-issues', 'title'],
}

/** ...designerPanelCommands({ panels: Object.values(FLOW_PANELS) })：FLOW_PANELS 里每块面板一条 panel:<面板 id>，名字取面板的标题。 */
function panelCommands(file) {
  const { node } = declaration(file, 'FLOW_PANELS')
  const literal = node.initializer.expression ?? node.initializer
  return literal.properties.map((property) => {
    const id = property.initializer.text
    const title = PANEL_TITLES[id]
    if (!title)
      throw new Error(`[gen-reference] FLOW_PANELS 里的 ${id} 没有对应的面板标题`)
    return { id: `panel:${id}`, label: title[1], bucket: title[0], icon: undefined, shortcut: [], readonly: true }
  })
}

/** BUILTIN_COMMANDS 里展开的一项：designerShellCommands 或 designerPanelCommands。 */
function spreadCommands(element, file) {
  const call = element.expression
  const name = flat(call)
  if (name.startsWith('designerShellCommands'))
    return shellCommands(call)
  if (name.startsWith('designerPanelCommands'))
    return panelCommands(file)
  throw new Error(`[gen-reference] BUILTIN_COMMANDS 里展开的不是 designerShellCommands 或 designerPanelCommands：${flat(element)}`)
}

/**
 * 内置命令：从 BUILTIN_COMMANDS 的字面量里取 id、文案键、图标与快捷键；文案写 text(键) 的取设计器文案，写 shared(键) 的
 * 取 designer-shell 的共用命令文案；enabled 由 editable 包着的只读时不可用。展开的 designerShellCommands 按选项列出，
 * designerPanelCommands 按 FLOW_PANELS 列出。
 */
function builtinCommands(file) {
  const { node } = declaration(file, 'BUILTIN_COMMANDS')
  return node.initializer.elements.flatMap((element) => {
    if (element.properties === undefined)
      return spreadCommands(element, file)
    const fields = new Map(element.properties.map(property => [nameOf(property), property.initializer]))
    const id = fields.get('id').text
    const match = /^(text|shared)\('(\w+)'\)$/.exec(flat(fields.get('label')))
    if (!match)
      throw new Error(`[gen-reference] command ${id} has no text() or shared() label`)
    const icon = fields.get('icon')
    const shortcut = fields.get('shortcut')
    const enabled = fields.get('enabled')
    return {
      id,
      label: match[2],
      bucket: match[1] === 'text' ? 'xh-flow-designer' : 'xh-designer-commands',
      icon: icon === undefined ? undefined : flat(icon),
      shortcut: shortcut === undefined ? [] : shortcut.elements.map(item => item.text),
      readonly: enabled === undefined || !flat(enabled).startsWith('editable('),
    }
  })
}

function commandTable(file) {
  return table(['命令', '名称', '图标', '快捷键', '只读时'], builtinCommands(file).map(command => [
    code(command.id, true),
    flowZhCN.translations[command.bucket][command.label],
    command.icon === undefined ? '—' : code(command.icon, true),
    command.shortcut.length === 0 ? '—' : code(shortcutText(command.shortcut), true),
    command.readonly ? '可用' : '不可用',
  ]))
}

/** 常量写成 TypeScript 代码块，带上它的说明。 */
function constSection(file, name) {
  const { node } = declaration(file, name)
  return [`### ${name} {#${anchorOf(name)}}`, `\`\`\`ts\nconst ${name} = ${flat(node.initializer)}\n\`\`\``, blockDoc(jsdoc(node))].filter(Boolean).join('\n\n')
}

/** 命令排列常量：每组一行。 */
function layoutSection(file, name) {
  const { node } = declaration(file, name)
  return [
    `### ${name} {#${anchorOf(name)}}`,
    blockDoc(jsdoc(node.parent.parent)),
    table(['组', '命令'], node.initializer.elements.map((group, index) => [
      String(index + 1),
      group.elements.map(item => code(item.text, true)).join(' '),
    ])),
  ].filter(Boolean).join('\n\n')
}

function designerPage() {
  const root = packageSource('designer', 'src')
  const designer = join(root, 'flow-designer.ts')
  const editor = join(root, 'editor.ts')
  const extensions = join(root, 'extensions.ts')
  return page('设计器', `${code('<xh-flow-designer>')} 编辑流程定义，类在 ${code('@xihan-flow/designer')} 里导出为 ${code('XhFlowDesigner')}，调用 ${code('defineFlowDesigner()')} 注册。用法见[设计器](../guide/designer)。`, [
    '## 元素 xh-flow-designer',
    elementSections(designer, 'XhFlowDesigner', 'FlowDesignerEventMap'),
    '## 注册',
    functionSection(designer, 'defineFlowDesigner'),
    '## 内置命令',
    `内置命令登记在 ${code('FLOW_DESIGNER_EXTENSION')} 里，工具栏、右键菜单与 ${code('commandLayout')} 都按 id 引用。名称取自中文语言包；快捷键在画布有焦点时生效，Ctrl / ⌘ 在 macOS 上是 ⌘，其它系统是 Ctrl。`,
    commandTable(extensions),
    layoutSection(extensions, 'FLOW_TOOLBAR_LAYOUT'),
    functionSection(extensions, 'flowToolbarLayout'),
    functionSection(extensions, 'flowMenuLayout'),
    typeSection(extensions, 'FlowMenuSubject'),
    '## 类型',
    typeSection(designer, 'FlowSchemaChangeKind'),
    constSection(extensions, 'FLOW_PANELS'),
    interfaceSection(editor, 'FlowSelection'),
    interfaceSection(editor, 'FlowClipboard'),
    interfaceSection(editor, 'FlowAutoLayoutOptions'),
    '## 文案',
    interfaceSection(packageSource('runtime', 'src', 'translations.ts'), 'FlowDesignerTranslations'),
    interfaceSection(packageSource('runtime', 'src', 'designer-locale.ts'), 'FlowDesignerLocale'),
    typeSection(packageSource('runtime', 'src', 'designer-locale.ts'), 'FlowIssueMessage'),
    typeSection(packageSource('runtime', 'src', 'designer-locale.ts'), 'FlowBuiltinPropertyKey'),
    exportIndexSection('全部导出', { root, file: join(root, 'index.ts') }),
  ])
}

// —— 扩展 ——

/** 已安装的 @xihan-ui 包里声明了 name 的类型声明文件。 */
function uiDeclaration(pkg, name) {
  const dir = join(docsDir, 'node_modules', '@xihan-ui', pkg, 'dist')
  for (const file of readdirSync(dir).filter(item => item.endsWith('.d.ts')).sort()) {
    const path = join(dir, file)
    if (declarationsOf(sourceFile(path)).has(name))
      return path
  }
  throw new Error(`[gen-reference] ${name} not found in @xihan-ui/${pkg}`)
}

function extensionsPage() {
  const core = packageSource('core', 'src')
  const coreExtensions = join(core, 'extensions.ts')
  const registry = join(core, 'registry.ts')
  const designer = packageSource('designer', 'src')
  const designerExtensions = join(designer, 'extensions.ts')
  const properties = join(designer, 'panels', 'properties.ts')
  const kit = name => uiDeclaration('designer-kit', name)
  const shell = name => uiDeclaration('designer-shell', name)
  const inherited = name => `${code(name)} 从 XiHan.UI 继承的字段。`
  return page('扩展', `扩展分三层：core 层登记节点类型、属性、编辑方式与规则，校验与编辑操作只读这一层；运行时层再加节点内容的渲染，见[查看器参考](./viewer#flowruntimeextension)；设计器层再加属性编辑器、命令、面板、导入器、导出器与 ${code('setup')}。下层的扩展对象可以直接交给上层的元素。用法见[扩展](../guide/extensions)。`, [
    '## core 层',
    interfaceSection(coreExtensions, 'FlowCoreExtension'),
    interfaceSection(kit('DesignerExtensionCore'), 'DesignerExtensionCore', '###', inherited('FlowCoreExtension')),
    typeSection(kit('SchemaRule'), 'SchemaRule'),
    interfaceSection(coreExtensions, 'FlowRuleContext'),
    interfaceSection(kit('ControlKind'), 'ControlKind'),
    functionSection(coreExtensions, 'createFlowModel'),
    interfaceSection(coreExtensions, 'FlowModel'),
    '## 节点类型',
    interfaceSection(registry, 'FlowNodeTypeDefinition'),
    typeSection(registry, 'FlowPortPreset'),
    interfaceSection(registry, 'FlowPortDefinition'),
    typeSection(registry, 'FlowPortDirection'),
    typeSection(registry, 'FlowPortSide'),
    interfaceSection(registry, 'FlowConnectionRule'),
    interfaceSection(registry, 'FlowNodeDefaults'),
    interfaceSection(registry, 'FlowEdgeStyleRule'),
    '## 属性描述',
    typeSection(registry, 'FlowPropertyDescriptor'),
    typeSection(registry, 'FlowPropertyControl'),
    interfaceSection(kit('PropertyDescriptor'), 'PropertyDescriptor'),
    typeSection(kit('PropertyCondition'), 'PropertyCondition'),
    '## 设计器层',
    interfaceSection(designerExtensions, 'FlowDesignerExtension'),
    interfaceSection(kit('DesignerExtensionBase'), 'DesignerExtensionBase', '###', `${inherited('FlowDesignerExtension')}${code('importers')}、${code('exporters')} 由流程收窄了结果与上下文的类型，见上表。`, ['importers', 'exporters']),
    interfaceSection(shell('DesignerShellExtension'), 'DesignerShellExtension', '###', inherited('FlowDesignerExtension')),
    interfaceSection(designerExtensions, 'FlowDesignerContext'),
    functionSection(designerExtensions, 'createFlowDesignerModel'),
    interfaceSection(designerExtensions, 'FlowDesignerModel'),
    '## 命令',
    typeSection(designerExtensions, 'FlowDesignerCommand'),
    interfaceSection(kit('DesignerCommand'), 'DesignerCommand'),
    typeSection(kit('DesignerCommandPlacement'), 'DesignerCommandPlacement'),
    '## 导入与导出',
    typeSection(designerExtensions, 'FlowDesignerImporter'),
    typeSection(designerExtensions, 'FlowImportResult'),
    interfaceSection(designerExtensions, 'FlowImportFragment'),
    interfaceSection(designerExtensions, 'FlowImportDocument'),
    interfaceSection(kit('DesignerImporter'), 'DesignerImporter'),
    interfaceSection(kit('DesignerImportSource'), 'DesignerImportSource'),
    typeSection(designerExtensions, 'FlowDesignerExporter'),
    interfaceSection(designerExtensions, 'FlowExportContext'),
    interfaceSection(kit('DesignerExporter'), 'DesignerExporter'),
    '## 面板',
    interfaceSection(shell('DesignerPanel'), 'DesignerPanel'),
    interfaceSection(shell('DesignerPanelInstance'), 'DesignerPanelInstance'),
    interfaceSection(shell('DesignerFrameRegion'), 'DesignerFrameRegion'),
    typeSection(shell('DesignerFramePosition'), 'DesignerFramePosition'),
    '## 属性编辑器',
    typeSection(properties, 'FlowPropertyEditor'),
    typeSection(properties, 'FlowPropertyEditorContext'),
    typeSection(properties, 'FlowPropertyEditorInstance'),
    typeSection(properties, 'FlowPropertyTarget'),
    interfaceSection(kit('PropertyEditorTable'), 'PropertyEditorTable'),
    interfaceSection(kit('PropertyEditorContext'), 'PropertyEditorContext'),
    interfaceSection(kit('PropertyEditorInstance'), 'PropertyEditorInstance'),
    interfaceSection(shell('DesignerPropertyTarget'), 'DesignerPropertyTarget'),
  ])
}

// —— XiHan 工作流引擎预设 ——

/** @xihan-ui/icons 里图标的导出名：play → PlayIcon。 */
function iconExportName(name) {
  return `${name.replace(/(^|-)(\w)/g, (_, __, letter) => letter.toUpperCase())}Icon`
}

const PORT_NAMES = { in: '左侧入口', out: '右侧出口', both: '左侧入口、右侧出口', none: '没有端口' }

/** 节点类型的个数与可达性要求。 */
function nodeTypeTraits(type) {
  const traits = []
  if (type.entry)
    traits.push('可达性的起点，不要求入线')
  if (type.terminal)
    traits.push('不要求出线')
  if (type.minCount !== undefined && type.minCount === type.maxCount)
    traits.push(`恰好 ${type.minCount} 个`)
  else if (type.minCount !== undefined || type.maxCount !== undefined)
    traits.push([type.minCount === undefined ? '' : `至少 ${type.minCount} 个`, type.maxCount === undefined ? '' : `至多 ${type.maxCount} 个`].filter(Boolean).join('、'))
  return traits.join('；') || '—'
}

/** 编辑方式：种类，下拉的写出选项。 */
function controlText(control) {
  if (control.kind !== 'select')
    return code(control.kind, true)
  const options = control.options.map(option => `${prose(option.label ?? String(option.value), true)}（${code(String(option.value), true)}）`)
  return `${code('select', true)}：${options.join('、')}`
}

function descriptorTable(descriptors, groups) {
  return table(['属性', '路径', '编辑方式', '分组', '必填'], descriptors.map(descriptor => [
    prose(descriptor.label ?? '', true),
    code(formatJsonPath(descriptor.path), true),
    controlText(descriptor.control),
    descriptor.group === undefined ? '—' : groups[descriptor.group] ?? descriptor.group,
    descriptor.required ? '是' : '—',
  ]))
}

/** 预设规则给出的问题码与严重程度：取 rules.ts 里 issue('码', '严重程度', …) 的调用。 */
function workflowRuleSeverities(file) {
  const found = new Map()
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'issue') {
      const [issueCode, severity] = node.arguments
      if (issueCode && severity && ts.isStringLiteral(issueCode) && ts.isStringLiteral(severity))
        found.set(issueCode.text, severity.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile(file))
  return found
}

function xihanWorkflowPage() {
  const root = packageSource('core', 'src', 'presets', 'xihan-workflow')
  const definition = join(root, 'definition.ts')
  const preset = createXihanWorkflow({ texts: xihanWorkflowZhCN })
  const { categories, groups, issues } = xihanWorkflowZhCN
  const severities = workflowRuleSeverities(join(root, 'rules.ts'))
  // 文案的键里，规则给出严重程度的是问题码，其余是同一条问题随预设选项换用的说明
  const issueCodes = Object.keys(issues).filter(key => severities.has(key))
  const variants = Object.keys(issues).filter(key => !severities.has(key))
  const sections = [
    '## 节点类型',
    `下表与各节点类型的属性取自中文文案的预设（${code('createXihanWorkflow({ texts: xihanWorkflowZhCN })')}）。类型名就是引擎的活动类型。`,
    table(['类型', '名称', '类别', '图标', '端口', '个数与可达性'], preset.nodeTypes.map(type => [
      `[${code(type.type, true)}](#${anchorOf(type.type)})`,
      type.label,
      categories[type.category] ?? type.category,
      type.icon ? code(iconExportName(type.icon.name), true) : '—',
      PORT_NAMES[type.ports] ?? '具名端口',
      nodeTypeTraits(type),
    ])),
  ]
  for (const type of preset.nodeTypes) {
    sections.push(`### ${type.type} · ${type.label} {#${anchorOf(type.type)}}`)
    sections.push(descriptorTable(type.properties ?? [], groups))
    if ((type.outgoingEdges ?? []).length > 0)
      sections.push('从它连出的连线：', descriptorTable(type.outgoingEdges, groups))
    else if (type.ports === 'out' || type.ports === 'both')
      sections.push('从它连出的连线没有额外属性。')
  }
  sections.push(
    '## 流程定义级属性',
    '什么都没选中时属性面板编辑这些属性，换成引擎定义时写在定义的顶层。',
    descriptorTable(preset.documentProperties, groups),
    '## 规则',
    `规则检查引擎发布定义时把关、通用校验覆盖不到的约束。说明取自中文文案，严重程度可以经 ${code('validateOptions.severity')} 改写。`,
    table(['问题码', '严重程度', '说明'], issueCodes.map(issueCode => [
      code(issueCode, true),
      SEVERITY_NAMES[severities.get(issueCode)] ?? '—',
      prose(issues[issueCode], true),
    ])),
    ...(variants.length === 0
      ? []
      : [
          `下面的文案键不是问题码，是 ${code('legacyAssignees: false')} 时同一条问题换用的说明（只提受理人规则）。`,
          table(['文案键', '用于问题码', '说明'], variants.map(key => [
            code(key, true),
            code(issueCodes.find(issueCode => key.startsWith(`${issueCode}-`)) ?? '—', true),
            prose(issues[key], true),
          ])),
        ]),
    '## 预设',
    functionSection(join(root, 'index.ts'), 'createXihanWorkflow'),
    interfaceSection(join(root, 'index.ts'), 'CreateXihanWorkflowOptions'),
    interfaceSection(join(root, 'texts.ts'), 'XihanWorkflowTexts'),
    '## 与引擎定义互转',
    functionSection(definition, 'toWorkflowDefinition'),
    functionSection(definition, 'fromWorkflowDefinition'),
    interfaceSection(definition, 'FromWorkflowDefinitionOptions'),
    interfaceSection(definition, 'XihanWorkflowDefinition'),
    interfaceSection(definition, 'XihanWorkflowNode'),
    interfaceSection(definition, 'XihanWorkflowTransition'),
    exportIndexSection('全部导出', { root, file: join(root, 'index.ts') }),
  )
  return page('XiHan 工作流引擎预设', `${code('@xihan-flow/core/presets/xihan-workflow')} 是 XiHan.Framework 工作流引擎的节点预设：引擎的每种活动对应一个节点类型，属性键与引擎读的一致，并能与引擎定义 JSON 互转。用法见 [XiHan 工作流引擎预设](../guide/xihan-workflow)。`, sections)
}

// —— 输出 ——

const pages = {
  'reference/schema.md': schemaPage(),
  'reference/issues.md': issuesPage(),
  'reference/viewer.md': viewerPage(),
  'reference/designer.md': designerPage(),
  'reference/extensions.md': extensionsPage(),
  'reference/xihan-workflow.md': xihanWorkflowPage(),
  'reference/core.md': corePage(),
}

const stale = []
for (const [relative, content] of Object.entries(pages)) {
  const target = join(docsDir, relative)
  const current = existsSync(target) ? await readFile(target, 'utf8') : undefined
  if (current === content)
    continue
  stale.push(relative)
  if (!checkOnly) {
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, content)
  }
}

if (checkOnly && stale.length > 0) {
  console.error(`参考页与源码不一致，在 docs/ 运行 pnpm gen 重新生成：\n${stale.map(item => `  ${item}`).join('\n')}`)
  process.exit(1)
}
console.log(stale.length === 0 ? '参考页已是最新' : `已生成：${stale.join('、')}`)
