```javascript
Vue.component('HelloWorld', () => {
    // 在webpack下 这种写法就会返回一个promise对象
    () => import('./components/HelloWorld.vue')
})
```

源码

```javascript
if (isObject(res)) {
    if (isPromise(res)) {
        // () => Promise
        // 第一次没有resolved
        if (isUndef(factory.resolved)) {
            // 然后执行then 然后就和工厂函数一样 去执行上面的resolve
            res.then(resolve, reject)
        }
    } else if (isPromise(res.component)) {
        ...
    }
}
```

