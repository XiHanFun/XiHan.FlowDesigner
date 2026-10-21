/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import type { DefaultTheme } from 'vitepress'
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineXiHanConfig } from '@xihanfun/vitepress-theme/config'

const title = '曦寒流程设计器文档'
const description = '框架无关的流程设计器，以 Web Components 交付，自带 XiHan 工作流引擎的节点预设'
const keywords = '曦寒,曦寒懿,流程设计器,流程图,审批流,工作流,Web Components,XiHanFun,XiHan.FlowDesigner'

const sourceRoot = fileURLToPath(new URL('../', import.meta.url))

/** 读一份 package.json。 */
function manifest(path: string): { version: string, dependencies?: Record<string, string>, peerDependencies?: Record<string, string> } {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
}

// 流程各包的 @xihan-ui/* 是 peerDependencies，由站点装唯一的一份：经 link: 引入的流程包也从站点根目录解析，页面上只有一份 UI。
// 站点没装流程包的哪个 peer，构建就报错
const uiPackages = Object.keys(manifest('../package.json').dependencies ?? {}).filter(name => name.startsWith('@xihan-ui/'))
for (const pkg of ['core', 'runtime', 'designer']) {
  const missing = Object.keys(manifest(`../../flow/packages/${pkg}/package.json`).peerDependencies ?? {}).filter(name => !uiPackages.includes(name))
  if (missing.length > 0)
    throw new Error(`[docs] package.json is missing peers of @xihan-flow/${pkg}: ${missing.join(', ')}`)
}

const guideSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: '开始',
    collapsed: false,
    items: [
      { text: '介绍', link: '/introduction' },
      { text: '快速开始', link: '/quickstart' },
    ],
  },
  {
    text: '指南',
    collapsed: false,
    items: [
      { text: '流程定义结构', link: '/guide/schema' },
      { text: '查看器', link: '/guide/viewer' },
      { text: '设计器', link: '/guide/designer' },
      { text: '扩展', link: '/guide/extensions' },
      { text: 'XiHan 工作流引擎预设', link: '/guide/xihan-workflow' },
      { text: '与宿主集成', link: '/guide/host' },
    ],
  },
]

// 参考页由 scripts/gen-reference.mjs 从源码生成
const referenceSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: '流程定义',
    collapsed: false,
    items: [
      { text: '流程定义类型', link: '/reference/schema' },
      { text: '问题码', link: '/reference/issues' },
    ],
  },
  {
    text: 'API',
    collapsed: false,
    items: [
      { text: '查看器', link: '/reference/viewer' },
      { text: '设计器', link: '/reference/designer' },
      { text: '扩展', link: '/reference/extensions' },
      { text: 'XiHan 工作流引擎预设', link: '/reference/xihan-workflow' },
      { text: '模型层 core', link: '/reference/core' },
    ],
  },
]

// 每个顶部导航板块各自一份侧栏，由路径前缀决定用哪一份；首页是 layout: home，不落任何一份。
const sidebar: DefaultTheme.Sidebar = {
  '/reference/': referenceSidebar,
  '/': guideSidebar,
}

const nav: DefaultTheme.NavItem[] = [
  { text: '指南', link: '/introduction', activeMatch: '^/(introduction|quickstart|guide/.*)$' },
  { text: '参考', link: '/reference/schema', activeMatch: '^/reference/' },
  {
    text: '生态',
    items: [
      {
        text: '官方生态',
        items: [
          { text: '开发框架', link: 'https://framework.docs.xihanfun.com' },
          { text: '视图组件', link: 'https://ui.docs.xihanfun.com' },
          { text: '基础应用', link: 'https://basicapp.docs.xihanfun.com' },
        ],
      },
      {
        text: '设计器',
        items: [
          { text: '打印设计器', link: 'https://print.docs.xihanfun.com' },
          { text: '流程设计器', link: '/' },
          { text: '表单设计器', link: 'https://form.docs.xihanfun.com' },
          { text: '报表设计器', link: 'https://report.docs.xihanfun.com' },
        ],
      },
    ],
  },
  {
    text: '支持',
    items: [
      { text: '公约', link: 'https://docs.xihanfun.com/cosmos/code-of-conduct' },
      { text: '参与', link: 'https://docs.xihanfun.com/cosmos/contributing' },
      { text: '赞助', link: 'https://docs.xihanfun.com/cosmos/sponsor' },
    ],
  },
  // 三个包锁步同版，版本号取 core 的
  {
    text: `v${manifest('../../flow/packages/core/package.json').version}`,
    items: [{ text: '更新日志', link: '/changelog' }],
  },
]

/** 取代码文件里 `#region name` 与 `#endregion name` 之间的行，去掉公共缩进。 */
function region(source: string, name: string): string {
  const lines = source.split(/\r?\n/)
  const start = lines.findIndex(line => new RegExp(`#region ${name}\\b`).test(line))
  const end = lines.findIndex((line, index) => index > start && new RegExp(`#endregion ${name}\\b`).test(line))
  if (start < 0 || end < 0)
    throw new Error(`[docs] region ${name} not found`)
  const picked = lines.slice(start + 1, end)
  const indent = Math.min(...picked.filter(line => line.trim() !== '').map(line => /^ */.exec(line)![0].length))
  return picked.map(line => line.slice(indent)).join('\n')
}

/** 机读正文：`<<< @/路径#片段` 换成代码块，示例舞台去掉。 */
async function machineReadable(body: string): Promise<string> {
  const out: string[] = []
  for (const line of body.split(/\r?\n/)) {
    const snippet = /^<<< @\/([^\s#]+)(?:#(\S+))?/.exec(line)
    if (snippet !== null) {
      const [, path, name] = snippet
      const source = await readFile(`${sourceRoot}${path}`, 'utf8')
      const code = name === undefined ? source.trimEnd() : region(source, name)
      out.push(`\`\`\`${extname(path!).slice(1)}`, code, '```')
      continue
    }
    if (/^<FlowDemo\b.*\/>\s*$/.test(line))
      continue
    out.push(line)
  }
  return out.join('\n')
}

export default defineXiHanConfig({
  title,
  description,
  keywords,
  repo: 'XiHan.FlowDesigner',
  llms: {
    title: '曦寒流程设计器',
    summary:
      '框架无关的流程设计器：以原生 Web Components 交付，流程定义是纯 JSON；查看器显示流程与运行状态，设计器可视化编辑；节点类型、属性、规则、命令与面板都经扩展登记，自带 XiHan 工作流引擎的节点预设，能与引擎定义互转。',
    site: 'https://flow.docs.xihanfun.com',
    sections: [
      { dir: '.', label: '开始' },
      { dir: 'guide', label: '指南' },
      { dir: 'reference', label: '参考' },
    ],
    bundles: [
      { name: 'guide', label: '指南', dirs: ['guide'] },
      { name: 'reference', label: '参考', dirs: ['reference'] },
    ],
    transform: machineReadable,
  },
  vite: {
    resolve: {
      dedupe: uiPackages,
    },
  },
  // Vue 示例里的 xh- 标签都是自定义元素，不当作 Vue 组件解析
  vue: {
    template: {
      compilerOptions: {
        isCustomElement: tag => tag.startsWith('xh-'),
      },
    },
  },
  themeConfig: {
    nav,
    sidebar,
  },
})
