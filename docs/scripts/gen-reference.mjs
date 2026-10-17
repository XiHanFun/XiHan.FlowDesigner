/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 从源码生成 reference/ 下的参考页：类型、元素的属性、方法与事件取自 flow/packages 的 TypeScript 源码与注释，
// 问题码与缺省严重程度取自 @xihan-flow/core，问题的中文说明取自 flowZhCN。
// 带 --check 时只比对，与已提交的页面不一致就列出并以非零退出。

import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { DEFAULT_ISSUE_SEVERITY } from '@xihan-flow/core'
import { flowZhCN } from '@xihan-flow/runtime/locale'
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

function flat(node) {
  return node.getText().replace(/\s+/g, ' ').trim()
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

function interfaceSection(file, name, level = '###', intro = '') {
  const { node } = declaration(file, name)
  const members = interfaceMembers(file, name)
  const heritage = heritageOf(node)
  const methods = members.filter(member => member.kind === 'method')
  return [
    `${level} ${name} {#${anchorOf(name)}}`,
    blockDoc(jsdoc(node)),
    intro,
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
  return [`### ${name} {#${anchorOf(name)}}`, `\`\`\`ts\ntype ${name} = ${flat(node.type)}\n\`\`\``, blockDoc(jsdoc(node))].filter(Boolean).join('\n\n')
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
    interfaceSection(extensions, 'FlowRuntimeExtension'),
    functionSection(extensions, 'createFlowRuntimeModel'),
    '## 连线路由',
    functionSection(router, 'createOrthogonalRouter'),
    interfaceSection(router, 'OrthogonalRouterOptions'),
    '## 文案',
    interfaceSection(join(root, 'translations.ts'), 'FlowViewerTranslations'),
    exportIndexSection('全部导出', { root, file: join(root, 'index.ts') }),
  ])
}

// —— 输出 ——

const pages = {
  'reference/schema.md': schemaPage(),
  'reference/issues.md': issuesPage(),
  'reference/viewer.md': viewerPage(),
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
