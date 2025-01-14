/* @flow */

import { mergeOptions } from '../util/index'

export function initMixin (Vue: GlobalAPI) {
  Vue.mixin = function (mixin: Object) {
    // 通过mergeOptions 来合并配置
    this.options = mergeOptions(this.options, mixin)
    return this
  }
}

// Vue.mixin({
//   created() {}
// })
