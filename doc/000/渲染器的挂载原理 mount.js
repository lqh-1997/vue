const domPropsRE = /\[A-Z]|^(?:value|checked|selected|muted)$/;

function mountElement(vnode, container, isSVG) {
    isSVG = isSVG || vnode.flags & VNodeFlags.ELEMENT_SVG;
    const el = isSVG
        ? document.createElementNS("http://www.w3.org/2000/svg", vnode.tag)
        : document.createElement(vnode.tag);
    vnode.el = el;

    const data = vnode.data;
    if (data) {
        for (let key in data) {
            switch (key) {
                case "style":
                    for (let k in data.style) {
                        el.style[k] = data.style[k];
                    }
                    break;
                case "class":
                    if (isSVG) {
                        el.setAttribute("class", data[key]);
                    } else {
                        el.className = data[key];
                    }
                    break;
                default:
                    // 注册事件
                    if (key[0] === "o" && key[1] === "n") {
                        el.addEventListener(key.slice(2), data[key]);
                    } else if (domPropsRE.test(key)) {
                        // 只能设置true和false的特殊props
                        el[key] = data[key];
                    } else {
                        el.setAttribute(key, data[key]);
                    }
                    break;
            }
        }
    }

    const childFlags = vnode.childFlags;
    const children = vnode.children;
    if (childFlags !== children.NO_CHILDREN) {
        if (childFlags & ChildrenFlags.SINGLE_VNODE) {
            mount(children, el, isSVG);
        } else if (childFlags & ChildrenFlags.MULTIPLE_VNODES) {
            for (let i = 0; i < children.length; i++) {
                mount(children[i], el, isSVG);
            }
        }
    }

    container.appendChild(el);
}

function mountText(vnode, container) {
    const el = document.createTextNode(vnode, children);
    vnode.el = el;
    container.appendChild(el);
}

function mountFragment(vnode, container, isSVG) {
    const { children, childFlags } = vnode;
    switch (childFlags) {
        case ChildrenFlags.SINGLE_VNODE:
            // 如果只有单个子节点 直接调用 mount
            mount(children, container, isSVG);
            vnode.el = children.el;
            break;
        case ChildrenFlags.NO_CHILDREN:
            // 如果没有子节点 就创建一个空的文本节点进行占位 当patch的时候可以保证位置正确
            const placeholder = createTextVNode("");
            mountText(placeholder, container);
            vnode.el = placeholder.el;
            break;
        default:
            // 如果多个子节点 直接遍历挂载
            for (let i = 0; i < children.length; i++) {
                mount(children[i], container, isSVG);
            }
            vnode.el = children[0].el;
    }
}

function mountPortal(vnode, container) {
    const { tag, children, childFlags } = vnode;

    // Portal中tag就代表要挂载的节点 可能是一个字符串或者对象
    const target = typeof tag === "string" ? document.querySelector(tag) : tag;

    if (childFlags & ChildrenFlags.SINGLE_VNODE) {
        // 通过mount 传递children和要挂载的节点的方式 直接挂载在target上
        mount(children, target);
    } else if (childrenFlags & ChildrenFlags.MULTIPLE_VNODES) {
        for (let i = 0; i < children.length; i++) {
            mount(children[i], target);
        }
    }

    // 那么对于 Portal 类型的 VNode 其 el 属性应该指向谁呢？
    // 应该指向挂载点元素吗？实际上虽然 Portal 所描述的内容可以被挂载到任何位置，
    // 但仍然需要一个占位元素，并且 Portal 类型的 VNode 其 el 属性应该指向该占位元素，
    // 为什么这么设计呢？
    // 这是因为 Portal 的另外一个特性：
    // 虽然 Portal 的内容可以被渲染到任意位置，但它的行为仍然像普通的DOM元素一样，
    // 如事件的捕获/冒泡机制仍然按照代码所编写的DOM结构实施。
    // 要实现这个功能就必须需要一个占位的DOM元素来承接事件。
    const placeholder = createTextVNode("");
    // 我们创建了一个空文本节点，并将它挂载到 container 下(注意不是挂载到target下)
    mountText(placeholder, container, null);
    vnode.el = placeholder.el;
}

function mountComponent(vnode, container, isSVG) {
    if (vnode.flags & VNodeFlags.COMPONENT_STATEFUL) {
        // 有状态组件
        mountStatefulComponent(vnode, container, isSVG);
    } else {
        // 函数式组件
        mountFunctionalComponent(vnode, container, isSVG);
    }
}

function mountStatefulComponent(vnode, container, isSVG) {
    // 通过new关键字可以创建组件实例
    const instance = (vnode.children = new vnode.tag());

    // 这里简化了 $props并不全是data 但是现在我们已经可以通过this.$props.xx访问到传入的props了
    instance.$props = vnode.data;

    instance._update = function () {
        // mounted为真 代表组件已经挂载 该执行更新操作
        if (instance._mounted) {
            // 拿到旧的vnode
            const prevVNode = instance.$vnode;
            // 渲染新的vnode
            const nextVNode = (instance.$vnode = instance.render());
            // patch更新
            patch(prevVNode, nextVNode, prevVNode.el.parentNode);
            // 更新el和$el
            instance.$el = vnode.el = instance.$vnode.el;
        } else {
            // 通过render函数获取该组件要渲染的vnode
            instance.$vnode = instance.render();
            // 获得了VNode 则直接将其挂载到container即可
            mount(instance.$vnode, container, isSVG);
            // 3、组件已挂载的标识
            instance._mounted = true;
            // instance.$vnode.el可以获得组件的根DOM元素 然后就可以将该DOM指向组件实例的$el和vnode.el
            instance.$el = vnode.el = instance.$vnode.el;
            // 5、调用 mounted 钩子
            instance.mounted && instance.mounted();
        }
    };
    instance._update();
}

function mountFunctionalComponent(vnode, container, isSVG) {
    // 获取VNODE
    const $vnode = vnode.tag();
    mount($vnode, container, isSVG);
    vnode.el = $vnode.el;
}
