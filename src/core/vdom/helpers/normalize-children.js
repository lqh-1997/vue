/* @flow */

import VNode, { createTextVNode } from 'core/vdom/vnode'
import { isFalse, isTrue, isDef, isUndef, isPrimitive } from 'shared/util'

// 模板编译器试图通过在编译时静态分析模板来最大程度地减少标准化需求
// The template compiler attempts to minimize the need for normalization by
// statically analyzing the template at compile time.
// 对于纯HTML标记，可以完全跳过规范化，因为可以保证生成的渲染函数返回Array <VNode>。而在两种情况下，需要额外的规范化：
// For plain HTML markup, normalization can be completely skipped because the
// generated render function is guaranteed to return Array<VNode>. There are
// two cases where extra normalization is needed:
// 当子节点中包含组件 因为函数化组件可能返回的是一个Array而不是一个根节点 这种情况下 只需要simple normalization
// 如果任一子节点是一个数组 我们通过Array.prototype.concat将其拍平 因为函数式组件已经normalize它们的子节点 所以将保证该数组只有一层的深度
// 1. When the children contains components - because a functional component
// may return an Array instead of a single root. In this case, just a simple
// normalization is needed - if any child is an Array, we flatten the whole
// thing with Array.prototype.concat. It is guaranteed to be only 1-level deep
// because functional components already normalize their own children.

// 将数组拍平成一维数组(这里只处理一层) 例子[[1], 2] => [1, 2]
export function simpleNormalizeChildren (children: any) {
  for (let i = 0; i < children.length; i++) {
    if (Array.isArray(children[i])) {
      return Array.prototype.concat.apply([], children)
    }
  }
  return children
}

// 当子节点始终生成嵌套数组的结构的时候 比如说<template>, <slot>, v-for, 又或者用户手写的render JSX中提供的子节点
// 这种情况下需要full normalization来满足所有的可能型
// 2. When the children contains constructs that always generated nested Arrays,
// e.g. <template>, <slot>, v-for, or when the children is provided by user
// with hand-written render functions / JSX. In such cases a full normalization
// is needed to cater to all possible types of children values.
export function normalizeChildren (children: any): ?Array<VNode> {
  // 基础类型就直接创建一个[VNode]传入text 非基础类型就判断是不是数组，是就调用normalizeArrayChildren
  return isPrimitive(children)
    ? [createTextVNode(children)]
    : Array.isArray(children)
      ? normalizeArrayChildren(children)
      : undefined
}

function isTextNode (node): boolean {
  return isDef(node) && isDef(node.text) && isFalse(node.isComment)
}

// 生成一个一维的vnode数组 如果遇到连续两个textVNode就合并
function normalizeArrayChildren (children: any, nestedIndex?: string): Array<VNode> {
  // 返回值
  const res = []
  let i, c, lastIndex, last
  // 遍历所有children
  for (i = 0; i < children.length; i++) {
    c = children[i]
    if (isUndef(c) || typeof c === 'boolean') continue
    lastIndex = res.length - 1
    last = res[lastIndex]
    //  nested
    // 如果当前child是一个数组就递归
    if (Array.isArray(c)) {
      if (c.length > 0) {
        // `${nestedIndex || ''}_${i}`  '_0', '_0_0'
        // 递归该数组 返回一个VNode数组
        c = normalizeArrayChildren(c, `${nestedIndex || ''}_${i}`)
        // merge adjacent text nodes
        // res中的最后一个和当前处理的children[0]如果都是TextNode 为了优化就直接将它们进行合并并直接放入res尾部 然后将children[0]中的该项删掉
        if (isTextNode(c[0]) && isTextNode(last)) {
          res[lastIndex] = createTextVNode(last.text + (c[0]: any).text)
          c.shift()
        }
        res.push.apply(res, c)
      }
      // 如果是一个基本类型
    } else if (isPrimitive(c)) {
      // 和最后一个进行比较是不是text
      if (isTextNode(last)) {
        // merge adjacent text nodes
        // this is necessary for SSR hydration because text nodes are
        // essentially merged when rendered to HTML strings
        res[lastIndex] = createTextVNode(last.text + c)
        // 直接生成一个textNode
      } else if (c !== '') {
        // convert primitive to vnode
        res.push(createTextVNode(c))
      }
    } else {
      if (isTextNode(c) && isTextNode(last)) {
        // merge adjacent text nodes
        res[lastIndex] = createTextVNode(last.text + c.text)
      } else {
        // default key for nested array children (likely generated by v-for)
        if (isTrue(children._isVList) &&
          isDef(c.tag) &&
          isUndef(c.key) &&
          isDef(nestedIndex)) {
          c.key = `__vlist${nestedIndex}_${i}__`
        }
        res.push(c)
      }
    }
  }
  return res
}
