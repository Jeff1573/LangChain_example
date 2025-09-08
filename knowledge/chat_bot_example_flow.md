在 JavaScript 中，**迭代器（Iterator）** 是一个特殊的对象，它提供了一种统一的、按顺序访问集合中各个元素的方式，而无需了解其内部实现细节。

这个概念是在 ES6 中引入的，用于遍历一系列的值，通常是某种集合。

### 核心概念

#### 1. 迭代器协议 (Iterator Protocol)

该协议定义了迭代器的标准行为。一个对象如果被认为是迭代器，它必须实现一个 `next()` 方法。 这个 `next()` 方法是一个无参数的函数，它返回一个具有以下两个属性的对象：

*   `value`: 迭代序列中的下一个值。
*   `done`: 一个布尔值，如果迭代已经完成，则为 `true`；否则为 `false`。

当 `done` 为 `true` 时，`value` 属性可以省略。

**示例：**
```javascript
// 一个简单的自定义迭代器
function makeRangeIterator(start = 0, end = Infinity, step = 1) {
  let nextIndex = start;
  let iterationCount = 0;

  const rangeIterator = {
    next: function() {
      let result;
      if (nextIndex < end) {
        result = { value: nextIndex, done: false };
        nextIndex += step;
        iterationCount++;
        return result;
      }
      return { value: iterationCount, done: true };
    }
  };
  return rangeIterator;
}

const it = makeRangeIterator(1, 4);

console.log(it.next()); // { value: 1, done: false }
console.log(it.next()); // { value: 2, done: false }
console.log(it.next()); // { value: 3, done: false }
console.log(it.next()); // { value: 3, done: true }
```

#### 2. 可迭代协议 (Iterable Protocol)

该协议规定了一个对象要成为“可迭代的”，它必须实现一个 `[Symbol.iterator]` 方法。 这个方法是一个无参数的函数，它返回一个遵循迭代器协议的对象（即一个迭代器）。

当一个对象是可迭代的，它就能够被一些 JavaScript 语法结构所使用，最常见的就是 `for...of` 循环和展开语法 (`...`)。

### 内置的可迭代对象

JavaScript 中许多内置类型都默认实现了可迭代协议，包括：

*   `Array` (数组)
*   `String` (字符串)
*   `Map`
*   `Set`
*   函数的 `arguments` 对象
*   `NodeList` 等 DOM 集合类型

这意味着你可以直接在这些类型的实例上使用 `for...of` 循环。

**示例：**
```javascript
// 遍历数组
const arr = ['a', 'b', 'c'];
for (const val of arr) {
  console.log(val); // 'a', 'b', 'c'
}

// 遍历字符串
const str = 'hello';
for (const char of str) {
  console.log(char); // 'h', 'e', 'l', 'l', 'o'
}

// 遍历 Map
const map = new Map([['key1', 'value1'], ['key2', 'value2']]);
for (const [key, value] of map) {
  console.log(`${key}: ${value}`); // "key1: value1", "key2: value2"
}
```

### 迭代器是如何工作的？

当像 `for...of` 这样的语法作用于一个可迭代对象时，会发生以下过程：

1.  首先调用该可迭代对象的 `[Symbol.iterator]()` 方法，获取一个迭代器对象。
2.  然后，循环会重复调用这个迭代器对象的 `next()` 方法。
3.  每一次调用 `next()` 返回的对象中，如果 `done` 是 `false`，则将其 `value` 属性的值赋给循环变量。
4.  当 `next()` 返回的对象中 `done` 为 `true` 时，循环终止。

### 为什么使用迭代器？

*   **统一的遍历接口**：为各种不同的数据结构提供了一套统一的访问机制。
*   **惰性求值**：迭代器只在需要时才生成下一个值，这使得它可以用来表示无限大的序列，而不会消耗大量内存。
*   **增强的控制力**：开发者可以精确控制迭代的流程。

总而言之，迭代器是 JavaScript 中一种强大的特性，它为数据遍历提供了标准化的协议，并是 `for...of` 循环、展开语法和生成器等现代 JavaScript 功能的基础。