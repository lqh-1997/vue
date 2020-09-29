/* @flow */

import * as nodeOps from 'web/runtime/node-ops'
import { createPatchFunction } from 'core/vdom/patch'
import baseModules from 'core/vdom/modules/index'
import platformModules from 'web/runtime/modules/index'

// the directive module should be applied last, after all
// built-in modules have been applied.
const modules = platformModules.concat(baseModules)

// modules是和平台相关的 nodeOps里面都是一些操作dom的方法
// 通过createPatchFunction返回一个函数 该函数就是和平台一致的函数
// 之后的操作就不用根据不同的平台去对patch做不同的分情况讨论 闭包
export const patch: Function = createPatchFunction({ nodeOps, modules })
