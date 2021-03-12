## update

Vue的 _update 是，它被调用的时机有 2 个，一个是首次渲染，一个是数据更新的时候；由于我们这一章节只分析首次渲染部分，数据更新部分会在之后分析响应式原理的时候涉及。update 方法的作用是把 VNode 渲染成真实的 DOM，它的定义在 `src/core/instance/lifecycle.js` 中：

```javascript
Vue.prototype._update = function (vnode: VNode, hydrating?: boolean) {
    const vm: Component = this
    // 数据更新前的el vnode
    const prevEl = vm.$el
    const prevVnode = vm._vnode
    const restoreActiveInstance = setActiveInstance(vm)
    vm._vnode = vnode
    // Vue.prototype.__patch__ is injected in entry points
    // based on the rendering backend used.
    if (!prevVnode) {
      // 如果不存在更新前的vnode 初始化render
      // __patch__在入口定义`src/platforms/web/runtime/index` 第一个参数为真实的dom，第二个为vDom
      vm.$el = vm.__patch__(vm.$el, vnode, hydrating, false /* removeOnly */)
    } else {
      // updates
      vm.$el = vm.__patch__(prevVnode, vnode)
    }
    restoreActiveInstance()
    // update __vue__ reference
    if (prevEl) {
      prevEl.__vue__ = null
    }
    if (vm.$el) {
      vm.$el.__vue__ = vm
    }
    // if parent is an HOC, update its $el as well
    if (vm.$vnode && vm.$parent && vm.$vnode === vm.$parent._vnode) {
      vm.$parent.$el = vm.$el
    }
    // updated hook is called by the scheduler to ensure that children are
    // updated in a parent's updated hook.
  }
```

由于关注的为首次渲染 所以prevVnode可以视为不存在

此时逻辑会走到第13行 vm.\__patch__

```javascript
// 判断是不是浏览器环境 不是的话就将__patch__置为一个空函数
Vue.prototype.__patch__ = inBrowser ? patch : noop
```

如果是浏览器环境 就会置成同一个文件夹目录下的path.js方法中的path

```javascript
// modules是和平台相关的内容 nodeOps里面都是一些操作dom的方法 这里运用了函数柯里化
export const patch: Function = createPatchFunction({ nodeOps, modules })
```

这里调用了createPatchFunction 返回的还是一个函数

```javascript
export function createPatchFunction (backend) {
  let i, j
  const cbs = {}

  const { modules, nodeOps } = backend

  // cbs拿到所有模块的钩子 比如说attr的create和update钩子
  // 所以在patch执行的时候就会去执行相对于的模块的钩子函数
  for (i = 0; i < hooks.length; ++i) {
    cbs[hooks[i]] = []
    for (j = 0; j < modules.length; ++j) {
      if (isDef(modules[j][hooks[i]])) {
        cbs[hooks[i]].push(modules[j][hooks[i]])
      }
    }
  }

  ...

  return function patch (oldVnode, vnode, hydrating, removeOnly) {
    if (isUndef(vnode)) {
      if (isDef(oldVnode)) invokeDestroyHook(oldVnode)
      return
    }

    let isInitialPatch = false
    const insertedVnodeQueue = []

    if (isUndef(oldVnode)) {
      // empty mount (likely as component), create new root element
      isInitialPatch = true
      createElm(vnode, insertedVnodeQueue)
    } else {
      const isRealElement = isDef(oldVnode.nodeType)
      if (!isRealElement && sameVnode(oldVnode, vnode)) {
        // patch existing root node
        patchVnode(oldVnode, vnode, insertedVnodeQueue, null, null, removeOnly)
      } else {
        if (isRealElement) {
          // mounting to a real element
          // check if this is server-rendered content and if we can perform
          // a successful hydration.
          if (oldVnode.nodeType === 1 && oldVnode.hasAttribute(SSR_ATTR)) {
            oldVnode.removeAttribute(SSR_ATTR)
            hydrating = true
          }
          if (isTrue(hydrating)) {
            if (hydrate(oldVnode, vnode, insertedVnodeQueue)) {
              invokeInsertHook(vnode, insertedVnodeQueue, true)
              return oldVnode
            } else if (process.env.NODE_ENV !== 'production') {
              warn(
                'The client-side rendered virtual DOM tree is not matching ' +
                'server-rendered content. This is likely caused by incorrect ' +
                'HTML markup, for example nesting block-level elements inside ' +
                '<p>, or missing <tbody>. Bailing hydration and performing ' +
                'full client-side render.'
              )
            }
          }
          // either not server-rendered, or hydration failed.
          // create an empty node and replace it
          // NOTICE 将真实的node转换成vNode
          oldVnode = emptyNodeAt(oldVnode)
        }

        // replacing existing element
        const oldElm = oldVnode.elm
        const parentElm = nodeOps.parentNode(oldElm)

        // create new node
        // NOTICE 将vNode挂载在真实的dom上
        createElm(
          vnode,
          insertedVnodeQueue,
          // extremely rare edge case: do not insert if old element is in a
          // leaving transition. Only happens when combining transition +
          // keep-alive + HOCs. (#4590)
          oldElm._leaveCb ? null : parentElm,
          nodeOps.nextSibling(oldElm)
        )

        // update parent placeholder node element, recursively
        if (isDef(vnode.parent)) {
          let ancestor = vnode.parent
          const patchable = isPatchable(vnode)
          while (ancestor) {
            for (let i = 0; i < cbs.destroy.length; ++i) {
              cbs.destroy[i](ancestor)
            }
            ancestor.elm = vnode.elm
            if (patchable) {
              for (let i = 0; i < cbs.create.length; ++i) {
                cbs.create[i](emptyNode, ancestor)
              }
              // #6513
              // invoke insert hooks that may have been merged by create hooks.
              // e.g. for directives that uses the "inserted" hook.
              const insert = ancestor.data.hook.insert
              if (insert.merged) {
                // start at index 1 to avoid re-invoking component mounted hook
                for (let i = 1; i < insert.fns.length; i++) {
                  insert.fns[i]()
                }
              }
            } else {
              registerRef(ancestor)
            }
            ancestor = ancestor.parent
          }
        }

        // destroy old node
        if (isDef(parentElm)) {
          removeVnodes([oldVnode], 0, 0)
        } else if (isDef(oldVnode.tag)) {
          invokeDestroyHook(oldVnode)
        }
      }
    }

    invokeInsertHook(vnode, insertedVnodeQueue, isInitialPatch)
    return vnode.elm
  }
}

```

所以我们一开始调用的\__patch__方法实际上就是最后在这里返回的patch

这里为什么要这样写呢，因为vue本身可以运行在不同的平台上，可以运行在web上也可以运行在weex上，虽然这两者都可以生成vDom但是它们操作dom的api不一定相同，所以利用函数柯里化的技巧，简化了不同平台之间不同情况的判断于操作

回到首次渲染的情况`vm.$el = vm.__patch__(vm.$el, vnode, hydrating, false /* removeOnly */)`

```javascript
return function patch (oldVnode, vnode, hydrating, removeOnly) {
    ...

    let isInitialPatch = false
    const insertedVnodeQueue = []

    if (isUndef(oldVnode)) {
        ...
    } else {
        const isRealElement = isDef(oldVnode.nodeType) // true
        if (!isRealElement && sameVnode(oldVnode, vnode)) {
           ...
        } else {
            if (isRealElement) {
                ...
                // either not server-rendered, or hydration failed.
                // create an empty node and replace it
                // 将真实的dom转换成vNode
                oldVnode = emptyNodeAt(oldVnode)
            }

            // replacing existing element
            // 这个就是真实的dom
            const oldElm = oldVnode.elm
            // 这个就是它的父节点 此处为#app的父节点 也就是body
            const parentElm = nodeOps.parentNode(oldElm)

            // create new node
            // NOTICE 将vNode挂载在真实的dom上
            createElm(
                vnode,
                insertedVnodeQueue,
                // extremely rare edge case: do not insert if old element is in a
                // leaving transition. Only happens when combining transition +
                // keep-alive + HOCs. (#4590)
                oldElm._leaveCb ? null : parentElm,
                nodeOps.nextSibling(oldElm)
            )

            ...

            // 删除老节点
            if (isDef(parentElm)) {
                removeVnodes([oldVnode], 0, 0)
            } else if (isDef(oldVnode.tag)) {
                invokeDestroyHook(oldVnode)
            }
        }
    }

    invokeInsertHook(vnode, insertedVnodeQueue, isInitialPatch)
    return vnode.elm
}
```

```javascript
function emptyNodeAt (elm) {
    return new VNode(nodeOps.tagName(elm).toLowerCase(), {}, [], undefined, elm)
}

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
    
    const data = vnode.data
    const children = vnode.children
    const tag = vnode.tag
    if (isDef(tag)) {
        if (process.env.NODE_ENV !== 'production') {
            if (data && data.pre) {
                creatingElmInVPre++
            }
            if (isUnknownElement(vnode, creatingElmInVPre)) {
                warn(
                    'Unknown custom element: <' + tag + '> - did you ' +
                    'register the component correctly? For recursive components, ' +
                    'make sure to provide the "name" option.',
                    vnode.context
                )
            }
        }

        vnode.elm = vnode.ns
            ? nodeOps.createElementNS(vnode.ns, tag)
        : nodeOps.createElement(tag, vnode)
        setScope(vnode)

        /* istanbul ignore if */
        if (__WEEX__) {
            ...
        } else {
            // 如果vnode还有子节点就递归调用子节点createElm
            createChildren(vnode, children, insertedVnodeQueue)
            if (isDef(data)) {
                invokeCreateHooks(vnode, insertedVnodeQueue)
            }
            insert(parentElm, vnode.elm, refElm)
        }

        if (process.env.NODE_ENV !== 'production' && data && data.pre) {
            creatingElmInVPre--
        }
    } else if (isTrue(vnode.isComment)) {
        vnode.elm = nodeOps.createComment(vnode.text)
        insert(parentElm, vnode.elm, refElm)
    } else {
        vnode.elm = nodeOps.createTextNode(vnode.text)
        insert(parentElm, vnode.elm, refElm)
    }
}
```

