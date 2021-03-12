同样组件也要经过_update和patch方法

然后在patch的时候执行了createElm方法

```javascript
function createElm (
    vnode,
    insertedVnodeQueue,
    parentElm,
    refElm,
    nested,
    ownerArray,
    index
  ) {
    
     ...
        
    // 组件的patch 会走这个逻辑
    if (createComponent(vnode, insertedVnodeQueue, parentElm, refElm)) {
      return
    }
        
     ...
}
```

createComponent

```javascript
function createComponent (vnode, insertedVnodeQueue, parentElm, refElm) {
    let i = vnode.data
    if (isDef(i)) {
      // keepAlive
      const isReactivated = isDef(vnode.componentInstance) && i.keepAlive
      // 拿到data.hook 然后执行init
      // 这里的hook就是上一节中installComponentHooks中的钩子
      if (isDef(i = i.hook) && isDef(i = i.init)) {
        i(vnode, false /* hydrating */)
      }
      // after calling the init hook, if the vnode is a child component
      // it should've created a child instance and mounted it. the child
      // component also has set the placeholder vnode's elm.
      // in that case we can just return the element and be done.
      if (isDef(vnode.componentInstance)) {
        initComponent(vnode, insertedVnodeQueue)
        insert(parentElm, vnode.elm, refElm)
        if (isTrue(isReactivated)) {
          reactivateComponent(vnode, insertedVnodeQueue, parentElm, refElm)
        }
        return true
      }
    }
  }
```

installComponentHooks中的钩子

```javascript
const componentVNodeHooks = {
  init (vnode: VNodeWithData, hydrating: boolean): ?boolean {
    if (
      vnode.componentInstance &&
      !vnode.componentInstance._isDestroyed &&
      vnode.data.keepAlive
    ) {
      // kept-alive 逻辑
      const mountedNode: any = vnode // work around flow
      componentVNodeHooks.prepatch(mountedNode, mountedNode)
    } else {
      // 第一个参数为当前vnode，第二个参数查看下面initLifecycle
      const child = vnode.componentInstance = createComponentInstanceForVnode(
        vnode,
        activeInstance
      )
      child.$mount(hydrating ? vnode.elm : undefined, hydrating)
    }
  },

  ...
}

```

会执行createComponentInstanceForVnode

```javascript
export function createComponentInstanceForVnode (
  vnode: any, // we know it's MountedComponentVNode but flow doesn't
  parent: any, // activeInstance in lifecycle st ate
): Component {
  // 将第二个_parentVnode理解成占位符VNode
  const options: InternalComponentOptions = {
    _isComponent: true,
    _parentVnode: vnode,
    parent
  }
  // check inline-template render functions
  const inlineTemplate = vnode.data.inlineTemplate
  if (isDef(inlineTemplate)) {
    options.render = inlineTemplate.render
    options.staticRenderFns = inlineTemplate.staticRenderFns
  }
  // 因为在new VNode的时候将Ctor作为componentOptions的参数传递过去了 所以Ctor是子构造器Sub
  // 这里就相当于执行了Sub的构造函数
  return new vnode.componentOptions.Ctor(options)
}

...
// 相当于执行了_init方法
const Sub = function VueComponent (options) {
    this._init(options)
}
```

在执行初始化的过程中 由于存在_isComponent属性 所以它会执行initInternalComponent方法

```javascript
if (options && options._isComponent) {
    // 优化内部组件实例 因为动态options merging很慢 并且没有一个内部组件options需要特殊处理
    // 是组件的话将会执行这个函数
    initInternalComponent(vm, options)
} else {...}
```

然后会执行到initLifecycle方法

```javascript
// 会定义一个全局的activeInstance变量
export let activeInstance: any = null
```

activeInstance每次更新是在执行_update的时候

```javascript
Vue.prototype._update = function (vnode: VNode, hydrating?: boolean) {
    const vm: Component = this
    // 数据更新前的el vnode
    const prevEl = vm.$el
    const prevVnode = vm._vnode
    const restoreActiveInstance = setActiveInstance(vm)
    vm._vnode = vnode
    
    ...
}
export function setActiveInstance(vm: Component) {
  // 用pervActiveInsatnce记录上一个activeInstance
  const prevActiveInstance = activeInstance
  activeInstance = vm
  return () => {
    activeInstance = prevActiveInstance
  }
}
```

然后返回 _init 返回的是子组件的实例

然后调用`installComponentHooks`中的$mount

```javascript
child.$mount(hydrating ? vnode.elm : undefined, hydrating)
```

最后会走到 `/platforms/web/runtime/index.js`中的$mount方法，然后执行`mountComponent`

执行updateComponent 执行_render 在执行render的过程中将vnode.$vnode指向\_parentVnode 也就是将**vnode.\$vnode**指向**占位符vnode**

然后执行_update 执行的过程中将**vm.\_vnode**指向了**渲染vnode**

所以vm._vnode和vm.parent也是父子关系

执行_update同时也就重复执行了上面的逻辑

所以整个组件创建的过程就是进行一次深度遍历

然后再_update的过程中由于含有pervVnode所以patch传入的参数不同

```javascript
// undefined, vnode, false, false
vm.$el = vm.__patch__(vm.$el, vnode, hydrating, false /* removeOnly */)
```

由于vm.$el为undefined

```javascript
// oldVnode 为vm.$el的形参
if (isUndef(oldVnode)) {
    // empty mount (likely as component), create new root element
    isInitialPatch = true
    createElm(vnode, insertedVnodeQueue)
}
```

然后执行createElm 如上判断根是不是组件 如果是则继续走上诉的逻辑

```javascript
if (createComponent(vnode, insertedVnodeQueue, parentElm, refElm)) {
    return
}
```

如果不是组件的话就类似上一章中update一样

不一样的地方是 它的parenElm为空，所以不会执行dom插入操作

所以当整个组件的path结束之后 `createComponent`方法中执行一下逻辑

```javascript
if (isDef(vnode.componentInstance)) {
    initComponent(vnode, insertedVnodeQueue)
    insert(parentElm, vnode.elm, refElm)
    if (isTrue(isReactivated)) {
        reactivateComponent(vnode, insertedVnodeQueue, parentElm, refElm)
    }
    return true
}
```

```javascript
function initComponent (vnode, insertedVnodeQueue) {
    if (isDef(vnode.data.pendingInsert)) {
      insertedVnodeQueue.push.apply(insertedVnodeQueue, vnode.data.pendingInsert)
      vnode.data.pendingInsert = null
    }
    vnode.elm = vnode.componentInstance.$el
    if (isPatchable(vnode)) {
      invokeCreateHooks(vnode, insertedVnodeQueue)
      setScope(vnode)
    } else {
      // empty component root.
      // skip all element-related modules except for ref (#3455)
      registerRef(vnode)
      // make sure to invoke the insert hook
      insertedVnodeQueue.push(vnode)
    }
  }
```

整个组件的插入顺序的应该是先子后父 因为我们在执行组件createComponent的时候 它又会递归的执行子组件的创建，render，update，patch的过程

所以最后子组件先insert，然后才轮到父组件insert

