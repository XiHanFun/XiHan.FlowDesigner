/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

/** 生成不在 taken 中的 id，形如 `${prefix}${n}`，n 取已有同前缀正整数序号的最大值加一。 */
export function nextFreeId(prefix: string, taken: ReadonlySet<string>): string {
  let max = 0
  for (const id of taken) {
    if (!id.startsWith(prefix))
      continue
    const rest = id.slice(prefix.length)
    if (/^[1-9]\d*$/.test(rest))
      max = Math.max(max, Number(rest))
  }
  return `${prefix}${max + 1}`
}
