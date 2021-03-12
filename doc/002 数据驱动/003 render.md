## render

通过模板生成vue项目的时候 在main.js中会生成如下的代码

```javascript
import App from './App.vue'
new Vue({
    render: (h) => {
        return h(App)
    }
}).$mount('#app')
```

同时vue也可以通过render函数生成各式的组件

```javascript
var app = new Vue({
    el: '#app',
    render(createElement) {
        // 实际这里就是在创建vnode
        return createElement('div', {
            attrs: {
                id: 'app'
            }
        }, this.message)
    },
    data() {
        return {
            message: 123
        }
    }
})
```

实际上调用render函数就会返回一个vnode

那么vue是如何通过render函数将template模板生成vnode的呢

首先查看`src/core/instance/render` 在这里Vue的原型上定义了一个_render函数

```javascript
Vue.prototype._render = function (): VNode {
    const vm: Component = this
    // 从$options拿到render函数 由用户输入或者编译产生
    const { render, _parentVnode } = vm.$options

    ...
    
    let vnode
    try {
      // There's no need to maintain a stack because all render fns are called
      // separately from one another. Nested component's render fns are called
      // when parent component is patched.
      currentRenderingInstance = vm
      // vm._renderProxy在生产环境下实际就是vm本身，开发环境可能是proxy对象(也是在init.js里面定义的，查看如下解释) 
      // 最终的结果就是通过createElement() 创建的 vnode
      vnode = render.call(vm._renderProxy, vm.$createElement)
    } catch (e) {
      ...
  }
```

init.js中定义的_renderProxy

```javascript
if (process.env.NODE_ENV !== 'production') {
    initProxy(vm)
} else {
    vm._renderProxy = vm
}
```

initProxy是在`src/core/instance/proxy`里面定义的

这部分实际上就是使用Proxy对vm进行元编程，修改它的get(拦截对属性的读取proxy.foo和proxy[foo])或者has(拦截key in proxy操作，返回一个布尔值)，方便在读取到不合理的属性的时候进行必要的报错提醒，所以这部分代码在生产模式下是不会执行的

```javascript
initProxy = function initProxy (vm) {
    // 判断浏览器是否支持Proxy
    if (hasProxy) {
        // determine which proxy handler to use
        const options = vm.$options
        // 判断使用哪一个handler
        const handlers = options.render && options.render._withStripped
        ? getHandler
        : hasHandler
        vm._renderProxy = new Proxy(vm, handlers)
    } else {
        vm._renderProxy = vm
    }
}

const hasHandler = {
    has (target, key) {
        // target有这个键
        const has = key in target
        // 不是全局预留关键字 或者 是字符串且第一项为_且没在$data中使用
        const isAllowed = allowedGlobals(key) ||
              (typeof key === 'string' && key.charAt(0) === '_' && !(key in target.$data))
        // 不满足以下其中一个(全局属性、_字符串且不在target.$data属性中)
        if (!has && !isAllowed) {
            // 如果在$data里面由就报命名出现_或$的警告
            if (key in target.$data) warnReservedPrefix(target, key)
            // 报使用了没有在data中定义的值的警告
            else warnNonPresent(target, key)
        }
        return has || !isAllowed
    }
}

const getHandler = {
    get (target, key) {
        if (typeof key === 'string' && !(key in target)) {
            if (key in target.$data) warnReservedPrefix(target, key)
            else warnNonPresent(target, key)
        }
        return target[key]
    }
}
```

所以能够知道_render函数中vm._renderProxy 指的为 vm或者是一个proxy

然后再来查看render的第二个参数vm.$createElement

该属性就定义在render.js的initRender()里面

```javascript
// bind the createElement fn to this instance
// so that we get proper render context inside it.
// args order: tag, data, children, normalizationType, alwaysNormalize
// internal version is used by render functions compiled from templates
// 编译生成的render函数所使用的创建vnode的方法
vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false)
// 手写render的方法创建vnode的方法
// 我们手写render函数传进来的参数就作为createElement的实参
vm.$createElement = (a, b, c, d) => createElement(vm, a, b, c, d, true)
```

