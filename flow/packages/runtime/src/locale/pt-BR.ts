/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 流程的巴西葡萄牙语语言包。

import type { XhConfig } from '@xihan-ui/web-components'
import { designerShellPtBR } from '@xihan-ui/designer-shell/locale'
import { flowLocale } from './types'

/** 流程的巴西葡萄牙语文案：查看器、设计器与 designer-shell 零件。 */
export const flowPtBR: XhConfig = /* @__PURE__ */ flowLocale(designerShellPtBR, {
  viewer: { label: 'Diagrama de fluxo' },
  designer: {
    label: 'Designer de fluxos',
    openFile: 'Abrir arquivo',
    autoLayout: 'Organizar automaticamente',
    clearVertices: 'Remover pontos de dobra',
    exportPng: 'Exportar PNG',
    exportSvg: 'Exportar SVG',
    exportImage: 'Imagem do fluxo',
    palette: 'Nós',
    paletteUncategorized: 'Outros',
    propertiesEmpty: 'Selecione nós ou conexões para editar suas propriedades',
    propertiesMultiple: count => `${count} itens selecionados`,
    edge: 'Conexão',
    propertyIssue: (property, message) => `${property}: ${message}`,
    issuesEmpty: 'Nenhum problema',
    paletteHelp: 'Arraste um nó para a tela ou clique nele para colocá-lo no centro da visualização.',
    propertiesHelp: 'Edite os nós ou conexões selecionados. Sem nada selecionado, edite a definição do fluxo.',
    issuesHelp: 'Problemas encontrados ao verificar a definição do fluxo. Clique em um para selecionar o nó ou a conexão em que ele está.',
    settingsCanvas: 'Tela',
    settingsLayoutDirection: 'Direção da organização automática',
    settingsLayoutDirectionHint: 'A organização automática dispõe os nós em camadas nesta direção.',
    settingsLayoutDirections: { TB: 'De cima para baixo', BT: 'De baixo para cima', LR: 'Da esquerda para a direita', RL: 'Da direita para a esquerda' },
    settingsNodeGap: 'Espaço entre nós',
    settingsNodeGapHint: 'Espaço entre nós vizinhos da mesma camada.',
    settingsLayerGap: 'Espaço entre camadas',
    settingsLayerGapHint: 'Espaço entre camadas vizinhas.',
    settingsMinimap: 'Minimapa',
    settingsMinimapHint: 'Mostrar o minimapa no canto inferior direito da tela.',
    settingsSnap: 'Alinhar aos nós',
    settingsSnapHint: 'Ao arrastar, alinhar a outros nós e mostrar guias de alinhamento.',
    flow: 'Fluxo',
    startVariableColumns: { name: 'Nome', required: 'Obrigatório', defaultValue: 'Valor padrão', description: 'Descrição' },
    startVariableAdd: 'Adicionar variável',
    startVariableCell: (row, column) => `${column} da variável ${row}`,
    propertyLabels: { 'label': 'Nome', 'style.dashed': 'Tracejada' },
    issues: {
      'document.unsupported-version': text => `A versão ${text('version')} da definição de fluxo não é suportada`,
      'node.duplicate-id': text => `O id de nó "${text('id')}" está repetido`,
      'node.unknown-type': text => `O tipo de nó "${text('type')}" não está registrado`,
      'edge.duplicate-id': text => `O id de conexão "${text('id')}" está repetido`,
      'edge.dangling': text => `A conexão aponta para o nó inexistente "${text('node')}"`,
      'edge.unknown-port': text => `A porta "${text('port')}" não existe`,
      'edge.invalid-direction': () => 'A direção da porta não permite esta conexão',
      'edge.self-loop': () => 'Um nó não pode se conectar a si mesmo',
      'edge.target-not-allowed': (_, type) => `"${type('sourceType')}" não pode se conectar a "${type('targetType')}"`,
      'edge.source-not-allowed': (_, type) => `"${type('targetType')}" não aceita conexões de "${type('sourceType')}"`,
      'node.max-incoming': text => `No máximo ${text('max')} conexões de entrada; há ${text('count')}`,
      'node.max-outgoing': text => `No máximo ${text('max')} conexões de saída; há ${text('count')}`,
      'port.max-connections': text => `A porta "${text('port')}" aceita no máximo ${text('max')} conexões; há ${text('count')}`,
      'type.min-count': (text, type) => `São necessários pelo menos ${text('min')} "${type('type')}"; há ${text('count')}`,
      'type.max-count': (text, type) => `São permitidos no máximo ${text('max')} "${type('type')}"; há ${text('count')}`,
      'node.isolated': () => 'Sem conexões',
      'node.missing-incoming': () => 'Falta a conexão de entrada',
      'node.missing-outgoing': () => 'Falta a conexão de saída',
      'node.unreachable': () => 'Não é alcançável a partir de um nó de início',
      'required': () => 'Obrigatório',
      'invalid-type': () => 'Tipo de valor incorreto',
      'invalid-value': () => 'Valor inválido',
      'out-of-range': () => 'Fora do intervalo permitido',
      'not-integer': () => 'Deve ser um número inteiro',
      'invalid-option': () => 'Não é uma das opções',
      'invalid-color': () => 'Não é uma cor válida',
      'empty': () => 'Não pode ficar vazio',
      'unknown-key': () => 'Contém um campo desconhecido',
      'duplicate-key': () => 'Contém uma chave repetida',
      'duplicate-id': () => 'Contém um id repetido',
      'unknown-control': () => 'Tipo de editor desconhecido',
    },
  },
})
