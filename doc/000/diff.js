function react() {
    let lastIndex = 0;
    for (let i = 0; i < nextChildren.length; i++) {
        const nextVNode = nextChildren[i];
        let j = 0;
        let find = false;
        for (j; j < prevChildren.length; j++) {
            const prevVNode = prevChildren[j];
            if (nextVNode.key === prevVNode.key) {
                find = true;
                patch(prevVNode, nextVNode, container);
                if (j < lastIndex) {
                    const refNode = nextChildren[i - 1].el.nextSibling;
                    container.insertBefore(prevVNode.el, refNode);
                    break;
                } else {
                    lastIndex = j;
                }
            }
        }
        // 如果旧的VNode不存在该key 则通过mount添加到DOM上
        if (!find) {
            const refNode =
                i - 1 < 0
                    ? prevChildren[0].el
                    : nextChildren[i - 1].el.nextSibling;
            // 这里第四个参数表示挂载时使用insertBefore而不是appendChild
            // 实现的初版mount没有体现这个参数
            mountElement(nextVNode, container, false, refNode);
        }
    }
    // 移除已经不存在的节点
    for (let i = 0; i < prevChildren.length; i++) {
        const prevVNode = prevChildren[i];
        // 拿着旧的VNode去新的children里面寻找key相同的节点
        const has = nextChildren.find(
            (nextVNode) => nextVNode.key === prevVNode.key
        );
        if (!has) {
            container.removeChild(prevVNode.el);
        }
    }
}

function vue2() {
    // 获取新旧最前和最后的节点
    let oldStartIdx = 0;
    let oldEndIdx = prevChildren.length - 1;
    let newStartIdx = 0;
    let newEndIdx = nextChildren.length - 1;
    let oldStartVNode = prevChildren[oldStartIdx];
    let oldEndVNode = prevChildren[oldEndIdx];
    let newStartVNode = nextChildren[newStartIdx];
    let newEndVNode = nextChildren[newEndIdx];
    // 只要任意一个end的index小于start就终止循环
    while (oldStartIdx <= oldEndIdx && nextStartIdx <= newEndIdx) {
        if (!oldStartVNode) {
            // 后面的操作可能带来undefined 直接跳过 并且更新索引
            oldStartVNode = prevChildren[++oldStartIdx];
        } else if (!oldEndVNode) {
            // 同上
            oldEndVNode = prevChildren[--oldEndIdx];
        } else if (oldStartVNode.key === newStartVNode.key) {
            // 比较旧节点开头 和 新节点开头
            // 先patch
            patch(oldStartVNode, newStartVNode, container);
            // 不需要改变位置 直接更新索引
            oldStartVNode = prevChildren[++oldStartIdx];
            newStartVNode = nextChildren[++newStartIdx];
        } else if (oldEndVNode.key === newEndVNode.key) {
            // 比较旧节点末尾 和 新节点末尾
            // 先patch
            patch(oldEndVNode, newEndVNode, container);
            // 不需要改变位置 直接更新索引
            oldEndVNode = prevChildren[--oldEndIdx];
            newEndVNode = nextChildren[--newEndIdx];
        } else if (oldStartVNode.key === newEndVNode.key) {
            // 比较旧节点开头 和 新节点末尾
            // 先patch
            patch(oldEndVNode, newStartVNode, container);
            // 将容器中的第一个节点 放到 最后面
            container.insertBefore(
                oldStartVNode.el,
                oldEndVNode.el.nextSibling
            );
            // 更新索引
            oldStartVNode = prevChildren[++oldStartIdx];
            newEndVNode = nextChildren[--newEndIdx];
        } else if (oldEndVNode.key === newStartVNode.key) {
            // 比较旧节点末尾 和 新节点开头
            // 先patch
            patch(oldEndVNode, newStartVNode, container);
            // 将容器中的最后一个节点移到最前面 使其成为第一个子节点
            container.insertBefore(oldEndVNode.el, oldStartVNode.el);
            // 更新索引
            oldEndVNode = prevChildren[--oldEndIdx];
            newStartVNode = nextChildren[++newStartIdx];
        } else {
            // 假如这一轮啥都没匹配到 就遍历旧的子列表 试图寻找与newStart相同的key节点
            const idxInOld = prevChildren.findIndex(
                (node) => node.key === newStartVNode.key
            );
            // 如果找到了
            if (idxInOld >= 0) {
                // 获取那个旧的VNode
                const vnodeToMove = prevChildren[indInOld];
                // patch更新
                patch(vnodeToMove, newStartVNode, container);
                // 然后把他移到该轮最前面 也就是oldStartVNode.el的前面
                container.insertBefore(vnodeToMove.el, oldStartVNode.el);
                // 由于旧children 该位置的真实DOM已经被移动 所以将其设置成undefined
                // 因为带来了undefined 而 oldStartVNode和oldEndVNode可能访问到
                // 所以要在前面加上对VNode值的判断
                prevChildren[idxInOld] = undefined;
            } else {
                // 没找到就用mount挂载
                // 挂载位置 很明显由于他是第一个(newStart) 所以只需要挂载在当前oldStartVNode前面一位即可
                mount(newStartVNode, container, false, oldStartVNode.el);
            }
            // 将 新列表的指针后移
            newStartVNode = nextChildren[++newStartVNode];
        }
    }
    // 循环结束了 新的children还有可能含有没被处理的全新节点 遍历该区间范围 一一挂载
    if (oldEndIdx < oldStartIdx) {
        // 添加新节点
        for (let i = newStartIdx; i <= newEndIdx; i++) {
            mount(nextChildren[i], container, false, oldStartVNode.el);
        }
    } else if (newEndIdx < newStartIdx) {
        // 旧的children也还可能存在没被删掉的旧节点 遍历该区间范围 删除
        for (let i = oldStartIdx; i <= oldEndIdx; i++) {
            container.removeChild(prevChildren[i].el);
        }
    }
}

function vue3() {
    // 向后遍历 直到遇到key不同的就停下来
    let j = 0;
    let prevVNode = prevChildren[i];
    let nextVNode = nextChildren[i];
    // while (prevVNode.key === nextVNode.key) {
    //     patch(prevVNode, nextVNode, container);
    //     j++;
    //     prevVNode = prevChildren[j];
    //     nextVNode = nextChildren[j];
    // }

    // 向前遍历 直到遇到key不同的就停下来
    let prevEnd = prevChildren.length - 1;
    let nextEnd = nextChildren.length - 1;
    prevVNode = prevChildren[prevEnd];
    nextVNode = nextChildren[nextEnd];
    // while (prevVNode.key === nextVNode.key) {
    //     patch(prevVNode, nextVNode, container);
    //     prevEnd--;
    //     nextEnd--;
    //     prevVNode = prevChildren[prevEnd];
    //     nextVNode = nextChildren[nextEnd];
    // }

    outer: {
        while (prevVNode.key === nextVNode.key) {
            patch(prevVNode, nextVNode, container);
            j++;
            // 一旦j大于prevEnd 就代表旧children所有节点都参与了patch
            // 一旦j大于nextEnd 就代表新children所有节点都参与了patch
            // 跳出label 减少多余的操作
            if (j > prevEnd || j > nextEnd) {
                break outer;
            }
            prevVNode = prevChildren[j];
            nextVNode = nextChildren[j];
        }
        // 更新相同的后缀节点
        prevVNode = prevChildren[prevEnd];
        nextVNode = nextChildren[nextEnd];
        while (prevVNode.key === nextVNode.key) {
            patch(prevVNode, nextVNode, container);
            prevEnd--;
            nextEnd--;
            if (j > prevEnd || j > nextEnd) {
                break outer;
            }
            prevVNode = prevChildren[prevEnd];
            nextVNode = nextChildren[nextEnd];
        }
    }

    // 满足条件，则说明从 j -> nextEnd 之间的节点应作为新节点插入
    if (j > prevEnd && j <= nextEnd) {
        // 所有新节点应该插入到位于 nextPos 位置的节点的前面
        const nextPos = nextEnd + 1;
        const refNode =
            nextPos < nextChildren.length ? nextChildren[nextPos.el] : null;
        while (j <= nextEnd) {
            mount(nextChildren[j++], container, false, refNode);
        }
    } else if (j > nextEnd) {
        while (j <= prevEnd) {
            container.removeChild(prevChildren[j++].el);
        }
    } else {
        // j既不大于prevEnd也不大于nextEnd
        // 构建一个新的数组存放新children在经过预处理后剩余的未处理的节点数量
        // 数组初始值为-1
        const nextLeft = nextEnd - j + 1;
        const source = [];
        for (let i = 0; i < nextLeft; i++) {
            source.push(-1);
        }
        const prevStart = j;
        const nextStart = j;
        let moved = false;
        let pos = 0;
        // for (let i = prevStart; i <= prevEnd; i++) {
        //     const prevVNode = prevChildren[i];
        //     for (let k = nextStart; k <= nextEnd; k++) {
        //         const nextVNode = nextChildren[k];
        //         if (prevVNode.key === nextVNode.key) {
        //             patch(prevVNode, nextVNode, container);
        //             source[k - nextStart] = i;
        //             if (k < pos) {
        //                 moved = true;
        //             } else {
        //                 pos = k;
        //             }
        //         }
        //     }
        // }
        const keyIndex = {};
        for (let i = nextStart; i <= nextEnd; i++) {
            keyIndex[nextChildren[i].key] = i;
        }
        let patched = 0;

        for (let i = prevStart; i <= prevEnd; i++) {
            prevVNode = prevChildren[i];
            if (patched < nextLeft) {
                const k = keyIndex[prevVNode.key];
                if (typeof k !== "undefined") {
                    nextVNode = nextChildren[k];
                    patch(prevVNode, nextVNode, container);
                    patched++;
                    source[k - nextStart] = i;
                    if (k < pos) {
                        moved = true;
                    } else {
                        pos = k;
                    }
                } else {
                    // 没找到，说明旧节点在新 children 中已经不存在了，应该移除
                    container.removeChild(prevVNode.el);
                }
            } else {
                container.removeChild(prevVNode.el);
            }
        }
    }
}
