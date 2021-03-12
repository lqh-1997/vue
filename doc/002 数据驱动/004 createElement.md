## createElement

createElement方法主要是用来virtualDom的

该函数定义于`src/core/vdom/create-element`

```javascript
/**
 * 这部分主要是对传进来的参数进行一层处理
 * @param context vm实例
 * @param tag 标签
 * @param data vnode.data
 * @param children 子节点
 * @param normalizationType
 * @param alwaysNormalize
 * @returns {VNode|Array<VNode>}
 */
export function createElement (
  context: Component,
  tag: any,
  data: any,
  children: any,
  normalizationType: any,
  alwaysNormalize: boolean
): VNode | Array<VNode> {
  // data这个参数可以为空 所以判断data如果是一个数组或者是一个基本类型，就去掉data，其他参数往前移一位
  if (Array.isArray(data) || isPrimitive(data)) {
    normalizationType = children
    children = data
    data = undefined
  }
  if (isTrue(alwaysNormalize)) {
    normalizationType = ALWAYS_NORMALIZE
  }
  // 真正的去创建一个vnode
  return _createElement(context, tag, data, children, normalizationType)
}
```

_createElement方法如下

```javascript
export function _createElement (
  context: Component,
  tag?: string | Class<Component> | Function | Object,
  data?: VNodeData,
  children?: any,
  normalizationType?: number
): VNode | Array<VNode> {
  // 这个data是响应式的就报警告 返回一个EmptyVNode
  if (isDef(data) && isDef((data: any).__ob__)) {
    ...
  }
  //判断component :is属性 将tag置为is
  if (isDef(data) && isDef(data.is)) {
    tag = data.is
  }
  // 防止component :is设置为false
  if (!tag) {
    return createEmptyVNode()
  }
  // key不是基础类型就警告
  if (process.env.NODE_ENV !== 'production' &&
    isDef(data) && isDef(data.key) && !isPrimitive(data.key)
  ) {
    if (!__WEEX__ || !('@binding' in data.key)) {
      warn(
        'Avoid using non-primitive value as key, ' +
        'use string/number value instead.',
        context
      )
    }
  }
  // support single function children as default scoped slot
  if (Array.isArray(children) &&
    typeof children[0] === 'function'
  ) {
    data = data || {}
    data.scopedSlots = { default: children[0] }
    children.length = 0
  }
  // 处理children
  if (normalizationType === ALWAYS_NORMALIZE) {
    children = normalizeChildren(children)
  } else if (normalizationType === SIMPLE_NORMALIZE) {
    children = simpleNormalizeChildren(children)
  }
  ...
}
```

通过normalizationType来决定是使用normalizeChildren还是simpleNormalizeChildren

这两个方法定义在`src/vdom/helpers/normalize-children`里面

```javascript
// 模板编译器试图通过在编译时静态分析模板来最大程度地减少标准化需求
// The template compiler attempts to minimize the need for normalization by
// statically analyzing the template at compile time.
// 对于纯HTML标记，可以完全跳过规范化，因为可以保证生成的渲染函数返回Array <VNode>。而在两种情况下，需要额外的规范化：
// For plain HTML markup, normalization can be completely skipped because the
// generated render function is guaranteed to return Array<VNode>. There are
// two cases where extra normalization is needed:
// 当子节点中包含组件 因为函数化组件可能返回的是一个Array而不是一个根节点 这种情况下 只需要simple normalization
// 如果任一子节点是一个数组 我们通过Array.prototype.concat将其拍平 因为函数化组件已经normalize它们的子节点 所以将保证该数组只有一层的深度
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
```

normalizeArrayChildren是一个递归函数 最终将会返回一个一维的vNode数组

```javascript
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
        // 递归该数组
        c = normalizeArrayChildren(c, `${nestedIndex || ''}_${i}`)
        // merge adjacent text nodes
        // 优化 如果c[0]和res[lastIndex]两个都为文本节点 我就将这两个节点合并成一个
        if (isTextNode(c[0]) && isTextNode(last)) {
          res[lastIndex] = createTextVNode(last.text + (c[0]: any).text)
          c.shift()
        }
        res.push.apply(res, c)
      }
      // 如果是一个基本类型
    } else if (isPrimitive(c)) {
      // 合并
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
```

然后看createElement的后半部分

```javascript
export function _createElement (
  context: Component,
  tag?: string | Class<Component> | Function | Object,
  data?: VNodeData,
  children?: any,
  normalizationType?: number
): VNode | Array<VNode> {
  
  ...
    
  let vnode, ns
  // tag可以为组件或者是string
  if (typeof tag === 'string') {
    let Ctor
    ns = (context.$vnode && context.$vnode.ns) || config.getTagNamespace(tag)
    // 如果是平台的保留标签
    if (config.isReservedTag(tag)) {
      // platform built-in elements
      if (process.env.NODE_ENV !== 'production' && isDef(data) && isDef(data.nativeOn)) {
        warn(
          `The .native modifier for v-on is only valid on components but it was used on <${tag}>.`,
          context
        )
      }
      // 用平台的保留标签实例化一个vNode
      vnode = new VNode(
        config.parsePlatformTagName(tag), data, children,
        undefined, undefined, context
      )
      // 如果是组件
    } else if ((!data || !data.pre) && isDef(Ctor = resolveAsset(context.$options, 'components', tag))) {
      // component
      vnode = createComponent(Ctor, data, context, children, tag)
    } else {
      // unknown or unlisted namespaced elements
      // check at runtime because it may get assigned a namespace when its
      // parent normalizes children
      // 不认识的节点就直接创建一个vNode
      vnode = new VNode(
        tag, data, children,
        undefined, undefined, context
      )
    }
  } else {
    // direct component options / constructor
    vnode = createComponent(tag, data, context, children)
  }

  if (Array.isArray(vnode)) {
    return vnode
  } else if (isDef(vnode)) {
    if (isDef(ns)) applyNS(vnode, ns)
    if (isDef(data)) registerDeepBindings(data)
    return vnode
  } else {
    return createEmptyVNode()
  }
}
```

所以上一节中`vnode = render.call(vm._renderProxy, vm.$createElement)`返回的最终结果就是此处返回的vnode

最终就是作为`vm._update`的参数`vm._update(vm._render(), ...)`