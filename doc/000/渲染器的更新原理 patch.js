function patch(prevVNode, nextVNode, container) {
    const nextFlags = nextVNode.flags;
    const prevFlags = prevVNode.flags;

    // 第一个判断的方法就是判断类型 如果类型不同直接使用replaceVNode函数进行替换
    // 如果类型相同 再根据类型进行不同的比对函数
    if (prevFlags !== nextFlags) {
        replaceVNode(prevVNode, nextVNode, container);
    } else if (nextFlags & VNodeFlags.ELEMENT) {
        patchElement(prevVNode, nextVNode, container);
    } else if (nextFlags & VNodeFlags.COMPONENT) {
        patchComponent(prevVNode, nextVNode, container);
    } else if (nextFlags & VNodeFlags.TEXT) {
        patchText(prevVNode, nextVNode);
    } else if (nextFlags & VNodeFlags.FRAGMENT) {
        patchFragment(prevVNode, nextVNode, container);
    } else if (nextFlags & VNodeFlags.PORTAL) {
        patchPortal(prevVNode, nextVNode);
    }
}

function replaceVNode(prevVNode, nextVNode, container) {
    container.removeChild(prevVNode.el);
    // 如果将要被移除的 VNode 类型是组件，则需要调用该组件实例的 unmounted 钩子函数
    if (prevVNode.flags & VNodeFlags.COMPONENT_STATEFUL_NORMAL) {
        // 类型为有状态组件的 VNode，其 children 属性被用来存储组件实例对象
        const instance = prevVNode.children;
        instance.unmounted && instance.unmounted();
    }
    mount(nextVNode, container);
}

function patchElement(prevVNode, nextVNode, container) {
    // 如果描述的是不同的标签 直接调用replaceVNode 因为我们认为不同的标签渲染的内容不同
    if (prevVNode.tag !== nextVNode.tag) {
        replaceVNode(prevVNode, nextVNode, container);
        return;
    }

    // 如果是相同的标签的话 现在VNode之间的差异就只会体现在VNodeData和children上了
    // 比对更新VNodeData
    const el = (nextVNode.el = prevVNode.el);
    const prevData = prevVNode.data;
    const nextData = nextVNode.data;
    // 遍历新的data，类似mount进行遍历赋值
    if (nextData) {
        for (let key in nextData) {
            const prevValue = prevData[key];
            const nextValue = nextData[key];
            // 因为mount中也有类似的操作 所以我们将操作封装起来叫做patchData
            patchData(el, key, prevValue, nextValue);
        }
    }
    // 遍历旧的data数据，不存在的就删掉
    if (prevData) {
        for (let key in prevData) {
            const prevValue = prevData[key];
            if (prevValue && !nextData.hasOwnProperty(key)) {
                // 第四个参数为null， 代表新参数不存在，删除
                patchData(el, key, prevValue, null);
            }
        }
    }

    // 最后就是比对更新children 调用一个递归函数
    patchChildren(
        prevVNode.childFlags,
        nextVNode.childFlags,
        prevVNode.children,
        nextVNode.children,
        // 当前标签元素，即这些子节点的父节点
        el
    );
}

function patchText(prevVNode, nextVNode) {
    const el = (nextVNode.el = prevVNode.el);
    // 只有当新旧文本内容不一致时才有必要更新
    if (nextVNode.children !== prevVNode.children) {
        el.nodeValue = nextVNode.children;
    }
}

function patchFragment(prevVNode, nextVNode, container) {
    // 对fragment的更新时机上时简化版的标签元素的更新
    // 因为fragment没有包裹元素，只有子节点，所以实际上就是对'子节点'的更新
    patchChildren(
        prevVNode.childFlags,
        nextVNode.childFlags,
        prevVNode.children,
        nextVNode.children,
        container
    );

    switch (nextVNode.childFlags) {
        case ChildrenFlags.SINGLE_VNODE:
            // 单个子节点意味着children的值就是VNode对象 所以直接将children.el赋值给nextVNode.el
            nextVNode.el = nextVNode.children.el;
            break;
        case ChildrenFlags.NO_CHILDREN:
            // 没有子节点的片段我们会使用一个空的文本节点占位
            // 而prevVNode就是引用的该空文本节点？
            // http://hcysun.me/vue-design/zh/renderer-patch.html#%E6%9B%B4%E6%96%B0-fragment
            // 这里不太理解为什么prevVNode就是空文本节点
            nextVNode.el = prevVNode.el;
            break;
        default:
            // 多个子节点 我们会引用数组的第一个元素
            nextVNode.el = nextVNode.children[0].el;
    }
}

function patchPortal(prevVNode, nextVNode) {
    // 直接根据children的不同去修改原dom
    patchChildren(
        prevVNode.childFlags,
        nextVNode.childFlags,
        prevVNode.children,
        nextVNode.children,
        // 注意这里是元素的旧的container，先将元素更新到旧的container上
        prevVNode.tag
    );

    // 直接获取旧的元素DOM
    nextVNode.el = prevVNode.el;

    // 如果新旧容器位置不同，就搬运元素DOM
    if (nextVNode.tag !== prevVNode.tag) {
        // 获取要新挂载的节点的位置
        const container =
            typeof nextVNode.tag === "string"
                ? document.querySelector(nextVNode.tag)
                : nextVNode.tag;
        switch (nextVNode.childFlags) {
            case ChildrenFlags.SINGLE_VNODE:
                // 如果新的 Portal 是单个子节点，就把该节点搬运到新容器中
                container.appendChild(nextVNode.children.el);
                break;
            case ChildrenFlags.NO_CHILDREN:
                // 新的 Portal 没有子节点，不需要搬运
                break;
            default:
                // 如果新的 Portal 是多个子节点，遍历逐个将它们搬运到新容器中
                for (let i = 0; i < nextVNode.children.length; i++) {
                    container.appendChild(nextVNode.children[i].el);
                }
                break;
        }
    }
}

function patchComponent(prevVNode, nextVNode, container) {
    // tag 属性的值是组件类，通过比较新旧组件类是否相等来判断是否是相同的组件
    if (nextVNode.tag !== prevVNode.tag) {
        replaceVNode(prevVNode, nextVNode, container);
    } else if (nextVNode.flags & VNodeFlags.COMPONENT_STATEFUL_NORMAL) {
        // 1、获取组件实例
        const instance = (nextVNode.children = prevVNode.children);
        // 2、更新 props
        instance.$props = nextVNode.data;
        // 3、更新组件
        instance._update();
    }
}

/**
 * 用来比对子节点不同的部分
 * @param {*} prevChildFlags
 * @param {*} nextChildFlags
 * @param {*} prevChildren
 * @param {*} nextChildren
 * @param {*} container
 */
function patchChildren(
    prevChildFlags,
    nextChildFlags,
    prevChildren,
    nextChildren,
    container
) {
    // 外层判断旧子节点类型 内层判断新子节点类型 一共有九种可能
    switch (prevChildFlags) {
        // 旧的子节点是一个单子结点就执行这里的case语句块
        case ChildFlags.SINGLE_VNODE:
            switch (nextChildFlags) {
                case ChildrenFlags.SINGLE_VNODE:
                    // 新旧都是单节点 就相当于两个子节点的比较 直接调用patch函数即可
                    patch(prevChildren, nextChildren, container);
                    break;
                case ChildrenFlags.NO_CHILDREN:
                    // 新的木有 旧的为单节点
                    container.removeChild(prevChildren.el);
                    break;
                default:
                    // 新的好多个 旧的为一个
                    // 思路就是将旧的一个移除掉 然后再将新的多个挂载上去
                    container.removeChild(prevChildren.el);
                    for (let i = 0; i < nextChildren.length; i++) {
                        mount(nextChildren[i], container);
                    }
                    break;
            }
            break;
        // 旧的 children 中没有子节点时，会执行该 case 语句块
        case ChildrenFlags.NO_CHILDREN:
            switch (nextChildFlags) {
                case ChildrenFlags.SINGLE_VNODE:
                    // 新的 children 是单个子节点时，会执行该 case 语句块
                    mount(nextChildren, container);
                    break;
                case ChildrenFlags.NO_CHILDREN:
                    // 新旧都没有 什么都不用做即可
                    break;
                default:
                    // 新的 children 中有多个子节点时，会执行该 case 语句块
                    for (let i = 0; i < nextChildren.length; i++) {
                        mount(nextChildren[i], container);
                    }
                    break;
            }
            break;
        // 旧的 children 中有多个子节点时，会执行该 case 语句块
        default:
            switch (nextChildFlags) {
                case ChildrenFlags.SINGLE_VNODE:
                    // 旧的好多个 新的一个 遍历删除后添加
                    for (let i = 0; i < prevChildren.length; i++) {
                        container.removeChild(prevChildren[i].el);
                    }
                    mount(nextChildren, container);
                    break;
                case ChildrenFlags.NO_CHILDREN:
                    // 旧的好多个 新的没有 遍历删除
                    for (let i = 0; i < prevChildren.length; i++) {
                        container.removeChild(prevChildren[i].el);
                    }
                    break;
                default:
                    // 新旧都是多节点 可以采用旧删除 新添加的思路 但是这样所有DOM更新毫无复用可言
                    // 所以这里会使用到diff算法
                    const preLen = prevChildren.length;
                    const nextLen = nextChildren.length;
                    const commonLength = prevLen > nextLen ? nextLen : prevLen;
                    for (let i = 0; i < commonLength; i++) {
                        patch(prevChildren[i], nextChildren[i], container);
                    }
                    // 如果 nextLen > prevLen，将多出来的元素添加
                    if (nextLen > prevLen) {
                        for (let i = commonLength; i < nextLen; i++) {
                            mount(nextChildren[i], container);
                        }
                    } else if (prevLen > nextLen) {
                        // 如果 prevLen > nextLen，将多出来的元素移除
                        for (let i = commonLength; i < prevLen; i++) {
                            container.removeChild(prevChildren[i].el);
                        }
                    }
                    break;
            }
            break;
    }
}

/**
 * patchElement调用 用来比较不同的props(VNodeData)
 * @param {*} el
 * @param {*} key
 * @param {*} prevValue
 * @param {*} nextValue
 */
function patchData(el, key, prevValue, nextValue) {
    switch (key) {
        case "style":
            for (let k in nextValue) {
                el.style[k] = nextValue[k];
            }
            for (let k in prevValue) {
                if (!nextValue.hasOwnProperty(k)) {
                    el.style[k] = "";
                }
            }
            break;
        case "class":
            el.className = nextValue;
            break;
        default:
            if (key[0] === "o" && key[1] === "n") {
                // 根据传入的参数移除旧时间 添加新事件
                if (prevValue) {
                    el.removeEventListener(key.slice(2), prevValue);
                }
                if (nextValue) {
                    el.addEventListener(key.slice(2), nextValue);
                }
            } else if (domPropsRE.test(key)) {
                // 当作 DOM Prop 处理
                el[key] = nextValue;
            } else {
                // 当作 Attr 处理
                el.setAttribute(key, nextValue);
            }
            break;
    }
}
