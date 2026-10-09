# Q-learning Cliff Walking Lab

一个用于练习表格型 Q-learning 的实时可视化实验台。项目已经提供悬崖行走环境、Q 表、epsilon-greedy 动作选择、训练调度、利用模式和数据面板，核心 Q 值更新函数留给学习者实现。

## 启动

```bash
npm install
npm run dev
```

生产构建与检查：

```bash
npm test
npm run build
npm run lint
```

## 你的练习文件

打开：

```text
src/exercise/update-q-value.ts
```

只需要完成 `updateQValue`。函数已经收到：

- state、action、reward、nextState、done
- oldQ、nextMaxQ
- alpha、gamma

完成后返回 `newQ`、`tdTarget`、`tdError`，并把 `implemented` 设置为 `true`。项目没有包含 Q-learning 更新公式。

## 页面能力

- 4 x 12 标准 Cliff Walking 环境
- 单步、运行一回合、连续运行、暂停和重置
- 训练模式与纯利用模式
- alpha、gamma、epsilon、epsilon 衰减、最大步数、回合数和播放速度
- 状态、动作来源、奖励、TD 数据和累计回报实时显示
- 48 x 4 完整 Q 表、贪心策略、回报曲线和回合记录
- TensorFlow.js 运行版本与后端状态展示
- 桌面和移动端响应式布局

TensorFlow.js 已作为 npm 依赖接入，但不会替你实现表格型 Q-learning。当前 Q 表使用 `Float64Array`，便于观察和调试每一次更新。

## 已验证

- 单元和组件测试：14 项
- TypeScript 生产构建
- ESLint
- 真实浏览器桌面交互
- 390px 移动端无横向溢出
- 浏览器控制台零错误

