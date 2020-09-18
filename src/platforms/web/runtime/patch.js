/* @flow */

import * as nodeOps from 'web/runtime/node-ops'
import { createPatchFunction } from 'core/vdom/patch'
import baseModules from 'core/vdom/modules/index'
import platformModules from 'web/runtime/modules/index'

// the directive module should be applied last, after all
// built-in modules have been applied.
const modules = platformModules.concat(baseModules)

// modules是和平台相关的 nodeOps里面都是一些操作dom的方法 函数柯里化
export const patch: Function = createPatchFunction({ nodeOps, modules })
