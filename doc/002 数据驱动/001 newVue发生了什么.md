## new Vue 发生了什么

### 组件为何能通过this访问到data和method中的值

1. 首先组件会通过`initState`将上述的属性挂载在`vm._data`上
2. 然后再通过比对data，method，prop的值防止重复
3. 最后通过`proxy`函数，通过`defineProperty`的方式改写vm上的这些属性，通过重写getter和setter去获取`vm._data`上相应的属性

### 详细分析

```javascript
new Vue({
    el: '#app',
    data: {
        msg: 123
    }
})
```

首先找到Vue的构造函数 `src/core/instance/index.js`

```javascript
// 首先定义Vue对象
function Vue (options) {
  // 如果不是生产模式且不是Vue的实例的话就报警告
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  // 进行初始化， 该方法在initMixin里面定义了
  this._init(options)
}

initMixin(Vue)
stateMixin(Vue)
eventsMixin(Vue)
lifecycleMixin(Vue)
renderMixin(Vue)

export default Vue
```

第十行中进行初始化`src/core/instance/init.js`

```javascript
Vue.prototype._init = function (options?: Object) {
    // 如果是new出来的对象`new Vue()._init()` this指向new出来的对象 也就是当前的Vue实例
    // 如果是直接调用prototype上的方法`Vue.prototype._init()` this指向Vue.prototype
    const vm: Component = this
    // a uid
    vm._uid = uid++

    ...
    
    // a flag to avoid this being observed
    vm._isVue = true
    // 合并options options为new Vue()中传递的对象
    if (options && options._isComponent) {
      
        ...
        
    } else {
      // 通过mergeOptions 将 option merge 到 $options上
      // 然后我们就能通过$options.el访问到我们传入的el 通过$options.data访问到传入的data
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      )
    }
    
    ...
    
    // 把vm挂载在Vue._self中 然后初始化
    vm._self = vm
    initLifecycle(vm)
    initEvents(vm)
    initRender(vm)
    callHook(vm, 'beforeCreate')
    initInjections(vm) // resolve injections before data/props
    // 初始化props method data
    initState(vm)
    initProvide(vm) // resolve provide after data/props
    callHook(vm, 'created')

    ...

    // 这里就判断$options有没有我们传入的那个el
    // https://cn.vuejs.org/v2/guide/instance.html#生命周期图示
    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
```

重点先看initState这个方法 它初始化了props method 和data `src/core/instance/state`

```javascript
export function initState (vm: Component) {
  vm._watchers = []
  const opts = vm.$options
  // 初始化props methods data
  if (opts.props) initProps(vm, opts.props)
  if (opts.methods) initMethods(vm, opts.methods)
  if (opts.data) {
    initData(vm)
  } else {
    observe(vm._data = {}, true /* asRootData */)
  }
  if (opts.computed) initComputed(vm, opts.computed)
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
}
```

initData做了什么呢

```javascript
function initData (vm: Component) {
  // 获得data
  let data = vm.$options.data
  // 如果data是一个对象就调用getData
  // getData 实际上就是 `return data.call(vm)` 用来vm调用data函数 
  // 实际getData中间还涉及了数据监听的部分，这里暂时省略
  data = vm._data = typeof data === 'function'
    ? getData(data, vm)
    : data || {}
  // 如果最终结果不是对象就报一个警告
  if (!isPlainObject(data)) {
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }
  // 获取keys props methods 的键名
  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length
  while (i--) {
    const key = keys[i]
    if (process.env.NODE_ENV !== 'production') {
      // hasOwn实际上就是hasOwnProperty 判断methods对象里面有没有和data命名冲突的
      if (methods && hasOwn(methods, key)) {
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    // 判断props对象里面有没有和data命名冲突的
    if (props && hasOwn(props, key)) {
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
      // 如果是不存在_ 或者 $开头的key 就通过proxy挂载在vm上
    } else if (!isReserved(key)) {
      proxy(vm, `_data`, key)
    }
  }
  ...
}
```

上面主要做的就是判断命名有没有冲突 然后调用proxy

```javascript
export function proxy (target: Object, sourceKey: string, key: string) {
  // initData的时候sourceKey为`_data`, _data在 initData中被赋值了
  sharedPropertyDefinition.get = function proxyGetter () {
    return this[sourceKey][key]
  }
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val
  }
  // Object.defineProperty在对象上定义一个新属性 或者修改一个现有属性 然后返回此对象 第三个参数为要定义或修改的属性描述符
  // 现在vm上面就挂载了传进来的key 并且getter和setter被重写了
  Object.defineProperty(target, key, sharedPropertyDefinition)
}
```

现在Vue实例上面就挂载了options 里面传入的data method 和 props 了

vm._data也能获取到这些属性 但是\_开头的一般都被认为是私有属性 不去访问

最终通过vm[xxx]去获取