## createComponent

回到之前说过的_createElement这个方法 `core/vdom/create-element`

```javascript
export function _createElement (
  context: Component,
  tag?: string | Class<Component> | Function | Object,
  data?: VNodeData,
  children?: any,
  normalizationType?: number
): VNode | Array<VNode> {
  // tag可以为组件或者是string
  if (typeof tag === 'string') {
      
    ...
    
  } else {
    // direct component options / constructor
    // 是组件的话就调用createComponent
    vnode = createComponent(tag, data, context, children)
  }

  ...
```

该方法就定义在同级层目录下的create-component.js文件里

```javascript
export function createComponent (
  Ctor: Class<Component> | Function | Object | void,
  data: ?VNodeData,
  // vm实例
  context: Component,
  children: ?Array<VNode>,
  tag?: string
): VNode | Array<VNode> | void {
  if (isUndef(Ctor)) {
    return
  }

  // Vue
  const baseCtor = context.$options._base

  // plain options object: turn it into a constructor
  // 如果Ctor是一个对象，就会使用Vue.extend 返回一个函数
  if (isObject(Ctor)) {
    Ctor = baseCtor.extend(Ctor)
  }

  // if at this stage it's not a constructor or an async component factory,
  // reject.
  // 不是函数 就报警告
  if (typeof Ctor !== 'function') {
    if (process.env.NODE_ENV !== 'production') {
      warn(`Invalid Component definition: ${String(Ctor)}`, context)
    }
    return
  }

  ...

  // install component management hooks onto the placeholder node
  // 安装组件的钩子
  installComponentHooks(data)

  // return a placeholder vnode
  const name = Ctor.options.name || tag
  // 创建vNode children text elm为undefined 但是第七个参数componentOptions里面包含了children等信息
  const vnode = new VNode(
    `vue-component-${Ctor.cid}${name ? `-${name}` : ''}`,
    data, undefined, undefined, undefined, context,
    { Ctor, propsData, listeners, tag, children },
    asyncFactory
  )

  ...

  return vnode
}
```

首先看一下baseCtor.extend(Ctor) 实际上baseCtor在这里就是指的Vue

`src/core/global-api/index.js` 中的 initGlobalAPI 函数有这么一段

```javascript
Vue.options._base = Vue
```

Vue 原型上的 _init 函数中有这么一段

```javascript
// 这样就把Vue上的一些option扩展靠了vm.$option上 比如说_base
// 这样vm.$options._base也就是Vue构造函数了
vm.$options = mergeOptions(
  resolveConstructorOptions(vm.constructor),
  options || {},
  vm
)
```

所以baseCtor.extend相当于调用了Vue的静态方法extend

```javascript
Vue.extend = function (extendOptions: Object): Function {
    extendOptions = extendOptions || {}
    const Super = this
    const SuperId = Super.cid
    const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {})
    // 缓存优化 如果SuperId相同说明是同一个父构造器 直接返回即可
    if (cachedCtors[SuperId]) {
      return cachedCtors[SuperId]
    }

    // 拿到组件name并做一层校验(比如说不能是html内置标签 还有一些命名规则之类的)
    const name = extendOptions.name || Super.options.name
    if (process.env.NODE_ENV !== 'production' && name) {
      validateComponentName(name)
    }

    // 以下内容就是让Sub拥有Vue的能力
    const Sub = function VueComponent (options) {
      this._init(options)
    }
    Sub.prototype = Object.create(Super.prototype)
    Sub.prototype.constructor = Sub
    // 唯一确定的id
    Sub.cid = cid++
    Sub.options = mergeOptions(
      Super.options,
      extendOptions
    )
    Sub['super'] = Super

    // For props and computed properties, we define the proxy getters on
    // the Vue instances at extension time, on the extended prototype. This
    // avoids Object.defineProperty calls for each instance created.
    if (Sub.options.props) {
      initProps(Sub)
    }
    if (Sub.options.computed) {
      initComputed(Sub)
    }

    // allow further extension/mixin/plugin usage
    Sub.extend = Super.extend
    Sub.mixin = Super.mixin
    Sub.use = Super.use

    // create asset registers, so extended classes
    // can have their private assets too.
    ASSET_TYPES.forEach(function (type) {
      Sub[type] = Super[type]
    })
    // enable recursive self-lookup
    if (name) {
      Sub.options.components[name] = Sub
    }

    // keep a reference to the super options at extension time.
    // later at instantiation we can check if Super's options have
    // been updated.
    Sub.superOptions = Super.options
    Sub.extendOptions = extendOptions
    Sub.sealedOptions = extend({}, Sub.options)

    // cache constructor
    cachedCtors[SuperId] = Sub
    return Sub
  }
}
```

然后回到原方法中执行installComponentHooks

```javascript
// 组件默认的钩子
const componentVNodeHooks = {
    init(){}
    prepatch(){}
	insert(){}
	destroy(){}
}

const hooksToMerge = Object.keys(componentVNodeHooks)

// 将componentVNodeHooks merge到组件hooks上
function installComponentHooks (data: VNodeData) {
  const hooks = data.hook || (data.hook = {})
  // 遍历组件上的钩子 本文件最上面
  for (let i = 0; i < hooksToMerge.length; i++) {
    const key = hooksToMerge[i]
    const existing = hooks[key]
    const toMerge = componentVNodeHooks[key]
    if (existing !== toMerge && !(existing && existing._merged)) {
      // data.hook上存在该属性吗 存在就merge 不存在直接赋值
      hooks[key] = existing ? mergeHook(toMerge, existing) : toMerge
    }
  }
}

function mergeHook (f1: any, f2: any): Function {
  const merged = (a, b) => {
    // flow complains about extra args which is why we use any
    f1(a, b)
    f2(a, b)
  }
  merged._merged = true
  return merged
}
```

然后又回到createComponent生成一个VNode

```javascript
export function createComponent (
  Ctor: Class<Component> | Function | Object | void,
  data: ?VNodeData,
  // vm实例
  context: Component,
  children: ?Array<VNode>,
  tag?: string
): VNode | Array<VNode> | void {
  
    ...
    
  // 创建vNode children text elm为undefined 但是第七个参数componentOptions里面包含了children等信息
    // 这里就是组件VNode和普通VNode的区别，没有childern等参数，但是多了一个componentOptions的参数
  const vnode = new VNode(
    `vue-component-${Ctor.cid}${name ? `-${name}` : ''}`,
    data, undefined, undefined, undefined, context,
    { Ctor, propsData, listeners, tag, children },
    asyncFactory
  )

  ...

  return vnode
}
```

