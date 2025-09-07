import BabelCore from '@babel/core'
import type { CallExpression, ExportAllDeclaration, ExportNamedDeclaration, ImportDeclaration } from '@babel/types'
import type { NodePath } from '@babel/traverse'
import { PluginOptions } from '../types'

/**
 * 检查相对路径的深度，如果超过最大允许深度则报告错误
 * @param sourceValue - 导入源路径
 * @param path - Babel AST path 对象
 * @param report - 报告函数
 * @param maxDepth - 最大允许的深度
 */
function checkRelativePath(
  sourceValue: string,
  path: NodePath<ImportDeclaration> | NodePath<CallExpression> | NodePath<ExportNamedDeclaration> | NodePath<ExportAllDeclaration>,
  maxDepth: number,
  report: PluginOptions['report']
): void {
  // 只检查相对路径
  if (sourceValue.startsWith('.')) {
    // 计算路径深度：通过计算 "../" 的出现次数
    const depth = (sourceValue.match(/\.\.\//g) || []).length

    if (depth > maxDepth) {
      report<ImportDeclaration | CallExpression | ExportNamedDeclaration | ExportAllDeclaration>(
        path,
        `导入/导出路径 "${sourceValue}" 不能超过最大层级（${maxDepth}：层）`
      )
    }
  }
}

// 导出Babel插件函数
export default function (api: typeof BabelCore, options: PluginOptions) {
  const { types: t } = api
  const maxDepth = 2
  // 从插件参数中获取 report 方法，如果没有提供则使用默认的 console.error
  const { report } = options

  return {
    name: 'no-deep-relative-imports',
    visitor: {
      // 处理静态导入语句
      ImportDeclaration(path: NodePath<ImportDeclaration>) {
        const sourceValue = path.node.source.value
        if (typeof sourceValue === 'string') {
          checkRelativePath(sourceValue, path, maxDepth, report)
        }
      },
      // 处理动态 import() 语句和 require() 调用
      CallExpression(path: NodePath<CallExpression>) {
        // 检查是否是 import() 调用
        if (t.isImport(path.node.callee)) {
          const firstArg = path.node.arguments[0]
          // 确保第一个参数是字符串字面量
          if (firstArg && t.isStringLiteral(firstArg)) {
            const sourceValue = firstArg.value
            checkRelativePath(sourceValue, path, maxDepth, report)
          }
        }
        // 检查是否是 require() 调用
        else if (
          t.isIdentifier(path.node.callee, { name: 'require' }) ||
          (t.isMemberExpression(path.node.callee) &&
            t.isIdentifier(path.node.callee.object, { name: 'require' }))
        ) {
          const firstArg = path.node.arguments[0]
          // 确保第一个参数是字符串字面量
          if (firstArg && t.isStringLiteral(firstArg)) {
            const sourceValue = firstArg.value
            checkRelativePath(sourceValue, path, maxDepth, report)
          }
        }
      },
      // 处理命名导出（export { ... } from 'module'）
      ExportNamedDeclaration(path: NodePath<ExportNamedDeclaration>) {
        if (path.node.source) {
          const sourceValue = path.node.source.value
          if (typeof sourceValue === 'string') {
            checkRelativePath(sourceValue, path, maxDepth, report)
          }
        }
      },
      // 处理全部导出（export * from 'module'）
      ExportAllDeclaration(path: NodePath<ExportAllDeclaration>) {
        const sourceValue = path.node.source.value
        if (typeof sourceValue === 'string') {
          checkRelativePath(sourceValue, path, maxDepth, report)
        }
      }
    },
  }
}
