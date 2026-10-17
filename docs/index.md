---
layout: home
title: 曦寒流程设计器
titleTemplate: 框架无关的流程图查看与设计

hero:
  name: 曦寒流程设计器
  text: 框架无关的流程设计器
  tagline: 原生 Web Components · 流程定义即 JSON · 运行状态可视化 · XiHan 工作流引擎预设
  image:
    src: /images/logo.png
    alt: 曦寒流程设计器
  actions:
    - theme: brand
      text: 快速开始
      link: /quickstart

    - theme: alt
      text: 介绍
      link: /introduction

features:
  - title: 框架无关
    icon: 🧩
    details: 以原生 Web Components 交付，Vue、React、Angular 或不用框架的页面都能直接使用；同一页面放多个实例互不影响。
    link: /introduction
    linkText: 了解设计原则

  - title: 流程定义即数据
    icon: 📄
    details: 流程定义是纯 JSON：节点、连线、折点与业务数据，读入时逐项检查，不含也不执行任何代码。
    link: /guide/schema
    linkText: 了解流程定义

  - title: 查看运行状态
    icon: 🗺️
    details: 查看器按节点类型画出流程，标出每个节点的运行状态与高亮，支持缩放、平移、定位节点与右键事件。
    link: /guide/viewer
    linkText: 了解查看器

  - title: 可视化设计器
    icon: 🎨
    details: 物料拖放、连线与改连、对齐吸附、属性面板、问题列表、小地图、撤销重做与系统剪贴板；流程定义的保存交给宿主。
    link: /guide/designer
    linkText: 了解设计器

  - title: 一切经扩展登记
    icon: 🧱
    details: 节点类型、属性、校验规则、渲染、命令与面板都由按实例传入的扩展登记，冲突当场报错，去掉扩展即撤掉它带来的一切。
    link: /guide/extensions
    linkText: 了解扩展

  - title: XiHan 工作流引擎预设
    icon: ⚙️
    details: 自带与 XiHan.Framework 工作流引擎活动一一对应的节点预设，流程定义与引擎定义可以互相转换。
    link: /guide/xihan-workflow
    linkText: 了解预设
---
