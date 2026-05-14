# 定时闹钟 Web 程序 — 产品实施计划

> **文档版本**: v1.0  
> **创建日期**: 2026-05-14  
> **角色视角**: 产品经理 + 技术架构师  

---

## 目录

1. [产品目标](#1-产品目标)
2. [用户旅程](#2-用户旅程)
3. [信息架构](#3-信息架构)
4. [数据模型](#4-数据模型)
5. [UI / 交互设计](#5-ui--交互设计)
6. [技术方案](#6-技术方案)
7. [文件清单](#7-文件清单)
8. [TDD / 验收标准](#8-tdd--验收标准)
9. [部署方案](#9-部署方案)

---

## 1. 产品目标

### 1.1 产品定位

一个**纯浏览器端运行的定时闹钟 Web 应用**，打开即用、无需注册、无需后端。所有数据持久化在浏览器本地存储中。支持桌面端与移动端自适应布局，可通过 Docker 一键部署为静态站点。

### 1.2 核心价值主张

| 维度 | 描述 |
|------|------|
| **零门槛** | 浏览器打开即用，无需安装 App，无需注册账号 |
| **全离线** | 所有数据存于浏览器端（IndexedDB），无需后端服务 |
| **策略丰富** | 一次性、重复、贪睡、倒计时等多种闹钟策略 |
| **可靠提醒** | 浏览器内音频 + 视觉 + Notification API 三重提醒 |
| **多端适配** | 响应式设计，桌面大屏与手机小屏体验一致 |
| **可部署** | Docker 镜像 + docker-compose，一键部署到任意 VM |

### 1.3 非目标（明确排除）

- ❌ 用户系统 / 登录注册
- ❌ 云端同步 / 多端数据同步
- ❌ 闹钟数据跨设备迁移
- ❌ 后台 Service Worker 离线提醒（浏览器关闭后无法触发）
- ❌ 第三方通知推送（如邮件、短信）
- ❌ 国际化（仅支持中文）

### 1.4 成功指标

- 用户首次打开页面到创建闹钟 ≤ 30 秒
- 闹钟触发延迟 ≤ 1 秒（相对于设定时间）
- 移动端（320px 宽）可用，无横向滚动条
- Lighthouse Performance Score ≥ 90
- Docker 镜像大小 ≤ 50MB（压缩后）

---

## 2. 用户旅程

### 2.1 核心用户故事

| ID | 用户故事 | 优先级 |
|----|---------|--------|
| U1 | 打开页面，看到当前实时时间 | P0 |
| U2 | 快速创建一次性闹钟（选时间 → 保存） | P0 |
| U3 | 闹钟到点，浏览器发出声音 + 弹出通知 | P0 |
| U4 | 创建每日重复闹钟（如每天早上 7:00） | P0 |
| U5 | 创建工作日闹钟（周一到周五） | P1 |
| U6 | 创建周末闹钟（周六、周日） | P1 |
| U7 | 创建指定星期闹钟（如每周二、四） | P1 |
| U8 | 贪睡 / 稍后提醒（Snooze） | P1 |
| U9 | 设置倒计时 / 计时器 | P1 |
| U10 | 为闹钟添加标签 / 备注 | P2 |
| U11 | 启用 / 禁用闹钟（不删除） | P0 |
| U12 | 删除闹钟 | P0 |
| U13 | 关闭浏览器后重新打开，闹钟数据仍在 | P0 |

### 2.2 典型场景流程

#### 场景 A：快速设置闹钟（核心路径）

```
打开页面 → 看到当前时间 → 点击「+ 添加闹钟」
→ 选择时间（滚轮或输入框）→ 选择策略（默认：一次性）
→ 点击保存 → 闹钟列表出现新条目（默认启用）
→ 到达时间 → 全屏提醒弹窗 + 铃声响起 + 浏览器通知
→ 点击「关闭」→ 提醒消失
```

#### 场景 B：工作日闹钟

```
打开页面 → 点击「+ 添加闹钟」
→ 选择时间 07:00 → 选择策略「工作日」
→ 添加标签「起床上班」→ 保存
→ 每个工作日 07:00 自动提醒
→ 周末静默
```

#### 场景 C：贪睡

```
闹钟响起 → 点击「稍后提醒（5分钟）」
→ 提醒消失 → 5分钟后再次响起
→ 可重复贪睡（最多 3 次）
→ 点击「关闭」→ 彻底结束本次提醒
```

#### 场景 D：倒计时

```
打开页面 → 切换到「计时器」Tab
→ 输入 25:00（番茄钟）→ 点击「开始」
→ 实时显示剩余时间 → 倒计时结束 → 提醒
→ 点击「重置」可重新开始
```

---

## 3. 信息架构

### 3.1 页面结构

```
App
├── Header
│   ├── Logo / 标题
│   └── 当前时间（实时更新）
├── TabBar（闹钟 / 计时器）
│   ├── 闹钟列表 Tab
│   └── 计时器 Tab
├── 闹钟列表（主视图）
│   ├── 闹钟卡片（循环渲染）
│   │   ├── 时间显示
│   │   ├── 标签 / 备注
│   │   ├── 策略描述（每日/工作日/…）
│   │   ├── 启用/禁用开关
│   │   └── 删除按钮
│   └── 空状态（无闹钟时）
├── 添加/编辑闹钟弹窗（Modal）
│   ├── 时间选择器
│   ├── 策略选择器（Radio Group）
│   ├── 贪睡设置（可选）
│   ├── 标签输入
│   └── 保存 / 取消
├── 闹钟提醒弹窗（全屏覆盖层）
│   ├── 当前时间
│   ├── 闹钟标签
│   ├── 关闭按钮
│   └── 贪睡按钮
└── 计时器面板
    ├── 时间显示（HH:MM:SS）
    ├── 快捷预设（5min / 15min / 25min / 自定义）
    ├── 开始 / 暂停 / 重置按钮
    └── 倒计时进度环
```

### 3.2 状态转换

```
闹钟生命周期：
  [创建] → 启用 → [等待触发] → 触发中 → [关闭 | 贪睡]
                         ↓
                      禁用（跳过触发）
                         ↓
                      启用（重新进入等待）
                         ↓
                      [删除] → 移除

计时器生命周期：
  [设置时间] → 运行中 → [暂停] → 继续运行
                         ↓
                      触发 → [重置 | 关闭]
```

---

## 4. 数据模型

### 4.1 核心实体

```typescript
// ===== 闹钟 =====
interface Alarm {
  id: string;                    // UUID v4
  type: 'alarm';                 // 区分闹钟/计时器
  time: string;                  // "HH:mm" 格式，如 "07:00"
  strategy: AlarmStrategy;       // 触发策略
  label: string;                 // 标签/备注
  enabled: boolean;              // 是否启用
  snooze: SnoozeConfig;          // 贪睡配置
  createdAt: number;             // Unix timestamp
  updatedAt: number;             // Unix timestamp
}

type AlarmStrategy =
  | { kind: 'once'; date?: string }           // 一次性（可选指定日期）
  | { kind: 'daily' }                         // 每日
  | { kind: 'weekdays' }                      // 工作日（周一~周五）
  | { kind: 'weekends' }                      // 周末（周六、周日）
  | { kind: 'custom'; days: number[] }        // 指定星期（0=周日, 1=周一,...,6=周六）

interface SnoozeConfig {
  enabled: boolean;             // 是否启用贪睡
  intervalMinutes: number;      // 贪睡间隔（分钟），默认 5
  maxCount: number;             // 最大贪睡次数，默认 3
}

// ===== 计时器 =====
interface Timer {
  id: string;                   // UUID v4
  type: 'timer';
  name: string;                 // 计时器名称
  totalSeconds: number;         // 总秒数
  remainingSeconds: number;     // 剩余秒数
  status: 'idle' | 'running' | 'paused' | 'finished';
  createdAt: number;
}

// ===== 全局状态 =====
interface AppState {
  alarms: Alarm[];
  timers: Timer[];
  activeAlert: ActiveAlert | null;   // 当前正在触发的提醒
}

interface ActiveAlert {
  alarmId: string;
  alarmLabel: string;
  snoozeRemaining: number;      // 剩余贪睡次数
  startedAt: number;            // 提醒开始时间
}
```

### 4.2 存储方案

- **存储引擎**: IndexedDB（通过 Dexie.js 封装）
- **数据库名**: `AlarmClockDB`
- **表 / Object Store**:
  - `alarms` — 主键 `id`，索引 `enabled`, `createdAt`
  - `timers` — 主键 `id`，索引 `status`
  - `settings` — 主键 `key`（存储用户偏好，如音量、主题）

### 4.3 触发逻辑伪代码

```
每秒钟检查一次（setInterval 1000ms）：
  now = new Date()
  for each alarm in alarms WHERE enabled = true:
    if alarm.time === now.formatted("HH:mm"):
      if shouldTriggerToday(alarm.strategy, now):
        triggerAlert(alarm)
  
  for each timer in timers WHERE status = 'running':
    timer.remainingSeconds -= 1
    if timer.remainingSeconds <= 0:
      timer.status = 'finished'
      triggerTimerAlert(timer)

shouldTriggerToday(strategy, now):
  match strategy.kind:
    'once'     → strategy.date ? (strategy.date === today) : true
    'daily'    → true
    'weekdays' → now.getDay() in [1,2,3,4,5]
    'weekends' → now.getDay() in [0,6]
    'custom'  → now.getDay() in strategy.days
```

---

## 5. UI / 交互设计

### 5.1 设计系统

| 属性 | 值 |
|------|-----|
| 设计哲学 | 简洁、直观、高对比度 |
| 配色 | 深色背景（#1a1a2e）+ 霓虹强调色（#00d2ff） |
| 字体 | 系统字体栈：`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` |
| 圆角 | 卡片 12px，按钮 8px |
| 间距 | 基础单位 8px，使用 4/8/16/24/32px 倍率 |
| 断点 | 移动端 < 640px，平板 640-1024px，桌面 > 1024px |

### 5.2 关键界面线框

#### 主界面（闹钟列表）
```
┌──────────────────────────────────┐
│  ⏰ 闹钟中心        当前 14:35:22 │  ← Header（固定顶栏）
├──────────────────────────────────┤
│  [闹钟列表]  [计时器]            │  ← TabBar
├──────────────────────────────────┤
│  ┌────────────────────────────┐  │
│  │ ⏰ 07:00       [启用 ✓]    │  │  ← 闹钟卡片
│  │ 每日 · 起床上班       🗑️  │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │ ⏰ 08:30       [禁用 ○]    │  │
│  │ 工作日 · 出门提醒      🗑️  │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │ ⏰ 14:00       [启用 ✓]    │  │
│  │ 仅一次 · 会议提醒      🗑️  │  │
│  └────────────────────────────┘  │
│                                  │
│         [+ 添加闹钟]             │  ← FAB（固定右下）
└──────────────────────────────────┘
```

#### 添加闹钟弹窗
```
┌──────────────────────────────────┐
│  新建闹钟                    ✕   │
├──────────────────────────────────┤
│                                  │
│       [ 07 ] : [ 00 ]           │  ← 时间滚轮
│                                  │
│  策略：                          │
│  ○ 一次性   ● 每日              │
│  ○ 工作日   ○ 周末              │  ← Radio Group
│  ○ 自定义 → [周一][周三][周五]   │
│                                  │
│  贪睡： [✓] 间隔 [5] 分钟       │  ← 可选配置
│         最多 [3] 次              │
│                                  │
│  标签：[________________]        │  ← 文本输入
│                                  │
│       [取消]    [保存]           │
└──────────────────────────────────┘
```

#### 闹钟提醒全屏覆盖
```
┌──────────────────────────────────┐
│                                  │
│                                  │
│           🔔 叮叮叮！            │  ← 动画图标
│                                  │
│            14:00                 │  ← 大号时间
│          会议提醒                │  ← 闹钟标签
│                                  │
│   [稍后提醒 (5分钟)]  [关闭]     │  ← 操作按钮
│                                  │
│                                  │
└──────────────────────────────────┘
```

#### 计时器面板
```
┌──────────────────────────────────┐
│  ⏰ 闹钟中心        当前 14:35:22│
├──────────────────────────────────┤
│  [闹钟列表]  [计时器]            │
├──────────────────────────────────┤
│                                  │
│         ⭕ 24:59                 │  ← 进度环 + 剩余时间
│                                  │
│   预设：[5min][15min][25min]     │
│                                  │
│   自定义：[_25_] 分钟            │
│                                  │
│       [▶ 开始]  [↺ 重置]        │
│                                  │
└──────────────────────────────────┘
```

### 5.3 交互细节

| 交互 | 行为 |
|------|------|
| 时间显示 | 每秒更新，大号字体，始终可见 |
| 添加闹钟 | FAB 按钮或顶部「+」，弹出 BottomSheet（移动端）/ Modal（桌面端） |
| 编辑闹钟 | 点击闹钟卡片 → 弹出编辑弹窗 |
| 启用/禁用 | 点击开关切换，即时生效，无需确认 |
| 删除闹钟 | 点击 🗑️ → 确认弹窗（防止误删） |
| 提醒触发 | 全屏覆盖层，阻止其他操作；播放音频 + 振动（移动端） |
| 贪睡 | 提醒弹窗中点击「稍后提醒」→ 覆盖层消失，倒计时后再次触发 |
| 关闭提醒 | 点击「关闭」→ 音频停止、覆盖层消失 |
| 空状态 | 无闹钟时显示插画 + 「还没有闹钟，点击下方按钮创建」 |
| 移动端适配 | 表格布局，卡片 100% 宽度，弹窗用 BottomSheet，FAB 固定右下 |

---

## 6. 技术方案

### 6.1 技术栈选型

| 层级 | 技术 | 版本 | 选型理由 |
|------|------|------|---------|
| 框架 | React | 18.x | 生态成熟，状态管理方案丰富 |
| 语言 | TypeScript | 5.x | 类型安全，提升代码可维护性 |
| 构建工具 | Vite | 5.x | 极速 HMR，开箱即用 TS 支持 |
| 样式方案 | Tailwind CSS | 3.x | 原子化 CSS，响应式工具类内建 |
| 状态管理 | Zustand | 4.x | 轻量（< 1KB），API 简洁，无 Boilerplate |
| 持久化 | Dexie.js | 4.x | IndexedDB 封装，Promise 风格 API |
| 日期处理 | date-fns | 3.x | Tree-shakable，函数式 API |
| 音频 | Web Audio API | - | 浏览器原生，支持自定义音效 |
| 通知 | Notification API | - | 浏览器原生桌面通知 |
| UUID | nanoid | 5.x | 轻量 UUID 生成 |
| 单元测试 | Vitest + Testing Library | latest | 与 Vite 生态一致 |
| E2E 测试 | Playwright | latest | 多浏览器支持，截图对比 |
| Web 服务器 | Nginx | 1.25-alpine | 轻量、高性能静态文件服务 |
| 容器化 | Docker + docker-compose | latest | 一键部署 |
| CI/CD | GitHub Actions | - | 免费额度，与 GitHub 深度集成 |

### 6.2 项目结构

```
alarm-clock/
├── public/
│   ├── favicon.svg
│   └── audio/
│       └── alarm.mp3              # 闹钟音效文件
├── src/
│   ├── main.tsx                   # 入口
│   ├── App.tsx                    # 根组件
│   ├── index.css                  # Tailwind 入口
│   ├── vite-env.d.ts
│   │
│   ├── components/                # 可复用组件
│   │   ├── Header.tsx             # 顶栏（标题 + 实时时钟）
│   │   ├── TabBar.tsx             # 闹钟/计时器切换
│   │   ├── AlarmCard.tsx          # 闹钟卡片
│   │   ├── AlarmList.tsx          # 闹钟列表（含空状态）
│   │   ├── AlarmForm.tsx          # 添加/编辑闹钟弹窗
│   │   ├── TimerPanel.tsx         # 计时器面板
│   │   ├── AlertOverlay.tsx       # 闹钟提醒全屏覆盖
│   │   ├── TimePicker.tsx         # 时间选择器
│   │   ├── StrategyPicker.tsx     # 策略选择器
│   │   ├── ConfirmDialog.tsx      # 确认弹窗
│   │   └── EmptyState.tsx         # 空状态组件
│   │
│   ├── hooks/                     # 自定义 Hooks
│   │   ├── useCurrentTime.ts      # 实时时钟（每秒更新）
│   │   ├── useAlarmChecker.ts     # 闹钟触发检查逻辑
│   │   ├── useTimer.ts            # 计时器逻辑
│   │   ├── useAudio.ts            # 音频播放控制
│   │   └── useNotification.ts     # 浏览器通知
│   │
│   ├── store/                     # Zustand Store
│   │   ├── alarmStore.ts          # 闹钟状态管理
│   │   ├── timerStore.ts          # 计时器状态管理
│   │   └── alertStore.ts          # 提醒状态管理
│   │
│   ├── db/                        # IndexedDB 持久化层
│   │   └── database.ts            # Dexie 数据库定义 + CRUD
│   │
│   ├── types/                     # TypeScript 类型定义
│   │   └── index.ts               # 全部类型导出
│   │
│   └── utils/                     # 工具函数
│       ├── time.ts                # 时间格式化、策略判断
│       ├── audio.ts               # Web Audio API 封装
│       └── id.ts                  # ID 生成
│
├── tests/
│   ├── unit/                      # 单元测试
│   │   ├── time.test.ts
│   │   ├── alarmStore.test.ts
│   │   └── components/
│   └── e2e/                       # E2E 测试
│       └── alarm.spec.ts
│
├── index.html                     # HTML 入口
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── Dockerfile                     # 多阶段构建
├── docker-compose.yml             # 生产部署编排
├── nginx.conf                     # Nginx 配置
├── .github/
│   └── workflows/
│       └── deploy.yml             # CI/CD 流水线
└── README.md
```

### 6.3 核心架构决策

#### 6.3.1 状态管理方案

```
┌─────────────────────────────────────────┐
│               Zustand Store              │
│                                          │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐  │
│  │ alarmStore│ │timerStore│ │alertStore│  │
│  │          │ │          │ │         │  │
│  │ alarms[] │ │ timers[] │ │ active  │  │
│  │ add/edit │ │ start    │ │ trigger │  │
│  │ toggle   │ │ pause    │ │ dismiss │  │
│  │ remove   │ │ reset    │ │ snooze  │  │
│  └────┬─────┘ └────┬─────┘ └────┬────┘  │
│       │             │            │       │
│       └──────┬──────┘            │       │
│              ↓                   │       │
│       useAlarmChecker ───────────┘       │
│       (每秒轮询，检测触发)                │
└─────────────────────────────────────────┘
         ↕ (subscribe + persist 中间件)
┌─────────────────────────────────────────┐
│           Dexie.js (IndexedDB)           │
│  alarms / timers / settings ObjectStore  │
└─────────────────────────────────────────┘
```

**关键点**:
- Zustand 的 `persist` 中间件 + 自定义 `storage` 适配器对接 Dexie.js
- 闹钟触发逻辑放在 `useAlarmChecker` hook 中，不放入 Store
- `alertStore` 不持久化（提醒状态只在内存中）

#### 6.3.2 闹钟触发机制

```typescript
// useAlarmChecker.ts 核心逻辑
function useAlarmChecker() {
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const currentTime = format(now, 'HH:mm');
      
      // 检查闹钟
      alarms.filter(a => a.enabled).forEach(alarm => {
        if (alarm.time === currentTime) {
          if (shouldTriggerToday(alarm.strategy, now)) {
            triggerAlert(alarm);
          }
        }
      });
      
      // 检查计时器
      timers.filter(t => t.status === 'running').forEach(timer => {
        if (timer.remainingSeconds <= 0) {
          finishTimer(timer);
          triggerTimerAlert(timer);
        }
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [alarms, timers]);
}
```

**性能优化**:
- 使用 `useMemo` 对 `alarms` 按 `enabled + time` 预过滤
- 只在整分钟边界做策略判断（`now.getSeconds() === 0`）
- 用 `requestAnimationFrame` 更新计时器显示而非 `setInterval`

#### 6.3.3 音频方案

```typescript
// useAudio.ts
function useAudio() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  
  const playAlarm = () => {
    // 方法1：播放音频文件（优先）
    const audio = new Audio('/audio/alarm.mp3');
    audio.loop = true;
    audio.play();
    return audio;
    
    // 方法2：程序化生成（备选，无需音频文件）
    // const ctx = new AudioContext();
    // const osc = ctx.createOscillator();
    // osc.connect(ctx.destination);
    // osc.start();
    // osc.stop(ctx.currentTime + 5);
  };
  
  return { playAlarm };
}
```

---

## 7. 文件清单

### 7.1 完整文件清单

```
alarm-clock/
│
├── public/
│   ├── favicon.svg                          # 图标
│   └── audio/
│       └── alarm.mp3                        # 提醒音效
│
├── src/
│   ├── main.tsx                             # React 入口
│   ├── App.tsx                              # 根组件，路由/布局
│   ├── index.css                            # Tailwind 指令
│   ├── vite-env.d.ts                        # Vite 类型声明
│   │
│   ├── components/
│   │   ├── Header.tsx                       # 顶栏 + 实时时钟
│   │   ├── TabBar.tsx                       # 闹钟/计时器切换
│   │   ├── AlarmList.tsx                    # 闹钟列表 + 空状态
│   │   ├── AlarmCard.tsx                    # 闹钟卡片组件
│   │   ├── AlarmForm.tsx                    # 闹钟表单弹窗
│   │   ├── TimerPanel.tsx                   # 计时器面板
│   │   ├── AlertOverlay.tsx                 # 提醒全屏覆盖
│   │   ├── TimePicker.tsx                   # 时间选择器
│   │   ├── StrategyPicker.tsx               # 闹钟策略选择器
│   │   ├── ConfirmDialog.tsx                # 确认弹窗
│   │   └── EmptyState.tsx                   # 空状态占位
│   │
│   ├── hooks/
│   │   ├── useCurrentTime.ts                # 实时时钟
│   │   ├── useAlarmChecker.ts               # 闹钟触发检测
│   │   ├── useTimer.ts                      # 计时器逻辑
│   │   ├── useAudio.ts                      # 音频控制
│   │   └── useNotification.ts               # 浏览器通知
│   │
│   ├── store/
│   │   ├── alarmStore.ts                    # 闹钟 Zustand Store
│   │   ├── timerStore.ts                    # 计时器 Zustand Store
│   │   └── alertStore.ts                    # 提醒 Zustand Store
│   │
│   ├── db/
│   │   └── database.ts                      # Dexie DB + CRUD
│   │
│   ├── types/
│   │   └── index.ts                         # 类型导出
│   │
│   └── utils/
│       ├── time.ts                          # 时间工具函数
│       ├── audio.ts                         # Web Audio 封装
│       └── id.ts                            # ID 生成（nanoid）
│
├── tests/
│   ├── setup.ts                             # 测试全局配置
│   ├── unit/
│   │   ├── time.test.ts                     # 时间工具测试
│   │   ├── alarmStore.test.ts               # 闹钟状态测试
│   │   ├── timerStore.test.ts               # 计时器状态测试
│   │   └── components/
│   │       ├── AlarmCard.test.tsx            # 卡片组件测试
│   │       ├── AlarmForm.test.tsx            # 表单组件测试
│   │       ├── TimerPanel.test.tsx           # 计时器面板测试
│   │       └── AlertOverlay.test.tsx         # 提醒覆盖层测试
│   └── e2e/
│       ├── alarm-lifecycle.spec.ts           # 闹钟生命周期 E2E
│       ├── timer-lifecycle.spec.ts           # 计时器生命周期 E2E
│       └── responsive.spec.ts               # 响应式测试
│
├── index.html                               # HTML 入口
├── package.json                             # 依赖 + 脚本
├── tsconfig.json                            # TypeScript 配置
├── tsconfig.node.json                       # Node 环境 TS 配置
├── vite.config.ts                           # Vite 配置
├── tailwind.config.js                       # Tailwind 配置
├── postcss.config.js                        # PostCSS 配置
├── vitest.config.ts                         # Vitest 配置
├── playwright.config.ts                     # Playwright 配置
│
├── Dockerfile                               # 多阶段构建
├── docker-compose.yml                       # 生产部署
├── nginx.conf                               # Nginx 配置
├── .dockerignore                            # Docker 忽略
├── .gitignore                               # Git 忽略
│
├── .github/
│   └── workflows/
│       └── deploy.yml                       # CI/CD
│
└── README.md                                # 项目说明
```

---

## 8. TDD / 验收标准

### 8.1 测试策略

| 层级 | 工具 | 覆盖目标 | 策略 |
|------|------|---------|------|
| 单元测试 | Vitest + Testing Library | 工具函数 + Store 逻辑 | **TDD**（先写测试，再写实现） |
| 组件测试 | Vitest + Testing Library | 所有组件 | **TDD**（测试驱动组件开发） |
| E2E 测试 | Playwright | 核心用户流程 | 功能完成后补充（非 TDD） |

### 8.2 TDD 开发顺序与验收标准

#### Phase 1：基础设施 + 时间工具

| # | 任务 | 测试文件 | 验收标准 |
|---|------|---------|---------|
| 1 | 时间格式化工具 | `tests/unit/time.test.ts` | `formatTime(new Date(2026,0,1,7,5))` → `"07:05"` |
| 2 | 策略判断：`shouldTriggerToday` | `tests/unit/time.test.ts` | 周一：weekdays→true, weekends→false; 周六：weekends→true, weekdays→false |
| 3 | ID 生成 | `tests/unit/time.test.ts` | 每次生成唯一 ID，不为空 |
| 4 | Dexie DB 初始化 | `tests/unit/database.test.ts` | DB 正确创建，包含 alarms/timers/settings 表 |

#### Phase 2：状态管理（Store TDD）

| # | 任务 | 测试文件 | 验收标准 |
|---|------|---------|---------|
| 5 | alarmStore — 添加闹钟 | `tests/unit/alarmStore.test.ts` | 添加后 `alarms.length` +1，字段完整 |
| 6 | alarmStore — 编辑闹钟 | `tests/unit/alarmStore.test.ts` | 修改 label 后 get 到新值 |
| 7 | alarmStore — 切换启用 | `tests/unit/alarmStore.test.ts` | toggle → `enabled` 翻转 |
| 8 | alarmStore — 删除闹钟 | `tests/unit/alarmStore.test.ts` | 删除后 `alarms.length` -1，ID 不存在 |
| 9 | alarmStore — 持久化 | `tests/unit/alarmStore.test.ts` | 新建闹钟 → 刷新页面 → 数据仍在 |
| 10 | timerStore — 开始/暂停/重置 | `tests/unit/timerStore.test.ts` | 开始→running，暂停→paused，重置→idle+remaining=total |
| 11 | timerStore — 倒计时到零 | `tests/unit/timerStore.test.ts` | remainingSeconds → 0 时 status → finished |
| 12 | alertStore — 触发/关闭/贪睡 | `tests/unit/alertStore.test.ts` | trigger→activeAlert 非 null; dismiss→null; snooze→snoozeRemaining-1 |

#### Phase 3：组件（Component TDD）

| # | 任务 | 测试文件 | 验收标准 |
|---|------|---------|---------|
| 13 | Header — 显示当前时间 | `tests/unit/components/Header.test.tsx` | 渲染当前时分秒 |
| 14 | AlarmCard — 显示闹钟信息 | `tests/unit/components/AlarmCard.test.tsx` | 显示时间、标签、策略描述、开关状态 |
| 15 | AlarmCard — 切换启用/禁用 | `tests/unit/components/AlarmCard.test.tsx` | 点击开关 → 状态翻转 + 视觉反馈 |
| 16 | AlarmCard — 删除确认 | `tests/unit/components/AlarmCard.test.tsx` | 点击删除 → 弹出确认 → 确认后删除 |
| 17 | AlarmForm — 创建闹钟 | `tests/unit/components/AlarmForm.test.tsx` | 填写表单 → 保存 → onSave 回调含正确数据 |
| 18 | AlarmForm — 验证必填 | `tests/unit/components/AlarmForm.test.tsx` | 时间未填 → 保存按钮 disabled |
| 19 | AlarmList — 列表渲染 | `tests/unit/components/AlarmList.test.tsx` | 3 条闹钟 → 3 张卡片 |
| 20 | AlarmList — 空状态 | `tests/unit/components/AlarmList.test.tsx` | 0 条闹钟 → 显示空状态占位 |
| 21 | StrategyPicker — 策略切换 | `tests/unit/components/StrategyPicker.test.tsx` | 选择「工作日」→ 输出 weekdays |
| 22 | AlertOverlay — 提醒显示 | `tests/unit/components/AlertOverlay.test.tsx` | 收到 activeAlert → 显示覆盖层 + 标签 |
| 23 | AlertOverlay — 关闭提醒 | `tests/unit/components/AlertOverlay.test.tsx` | 点击关闭 → onDismiss 被调用 |
| 24 | AlertOverlay — 贪睡 | `tests/unit/components/AlertOverlay.test.tsx` | 点击贪睡 → onSnooze 被调用 |
| 25 | TimerPanel — 计时器交互 | `tests/unit/components/TimerPanel.test.tsx` | 开始 → 显示倒计时；暂停 → 停止；重置 → 恢复初始值 |

#### Phase 4：E2E（功能完成后）

| # | 场景 | 测试文件 | 验收标准 |
|---|------|---------|---------|
| 26 | 闹钟完整生命周期 | `tests/e2e/alarm-lifecycle.spec.ts` | 创建→列表出现→到点触发→覆盖层出现→关闭→覆盖层消失 |
| 27 | 贪睡流程 | `tests/e2e/alarm-lifecycle.spec.ts` | 闹钟响→点贪睡→5分钟后再次触发 |
| 28 | 计时器完整流程 | `tests/e2e/timer-lifecycle.spec.ts` | 设置时间→开始→倒计时→结束提醒→重置 |
| 29 | 数据持久化 | `tests/e2e/alarm-lifecycle.spec.ts` | 创建闹钟→刷新页面→闹钟仍在列表中 |
| 30 | 响应式布局 | `tests/e2e/responsive.spec.ts` | 320px→无横向滚动条；1024px→卡片排列正确 |

### 8.3 非功能验收标准

| 指标 | 阈值 | 验证方式 |
|------|------|---------|
| Lighthouse Performance | ≥ 90 | Chrome DevTools 手动审计 |
| 首次内容绘制 (FCP) | ≤ 1.5s | Lighthouse 报告 |
| 最大内容绘制 (LCP) | ≤ 2.5s | Lighthouse 报告 |
| 累积布局偏移 (CLS) | ≤ 0.1 | Lighthouse 报告 |
| Docker 镜像大小 | ≤ 50MB | `docker images` |
| 闹钟提醒延迟 | ≤ 1s | 手动测试 + 日志 |
| TypeScript 严格模式 | 零错误 | `tsc --noEmit` |

---

## 9. 部署方案

### 9.1 整体架构

```
┌─────────────┐    git push    ┌──────────────────┐
│   Developer  │ ─────────────→ │  GitHub (main)   │
└─────────────┘                └────────┬─────────┘
                                        │ trigger
                                        ↓
                               ┌──────────────────┐
                               │  GitHub Actions   │
                               │  deploy.yml       │
                               │                   │
                               │  1. lint + test   │
                               │  2. build (Vite)  │
                               │  3. docker build  │
                               │  4. push to GHCR  │
                               └────────┬─────────┘
                                        │
                                        ↓
                               ┌──────────────────┐
                               │  GitHub Container │
                               │  Registry (GHCR)  │
                               │  ghcr.io/user/    │
                               │  alarm-clock:latest│
                               └────────┬─────────┘
                                        │ docker pull
                                        ↓
                               ┌──────────────────┐
                               │  VM (目标服务器)  │
                               │                   │
                               │  docker compose   │
                               │  up -d            │
                               │                   │
                               │  nginx:80 → Web   │
                               └──────────────────┘
```

### 9.2 Docker 多阶段构建（Dockerfile）

```dockerfile
# ===== Stage 1: Build =====
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ===== Stage 2: Runtime =====
FROM nginx:1.25-alpine
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 9.3 Nginx 配置（nginx.conf）

```nginx
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    sendfile      on;
    keepalive_timeout 65;
    gzip          on;
    gzip_types    text/plain text/css application/json application/javascript text/xml;

    server {
        listen       80;
        server_name  localhost;
        root         /usr/share/nginx/html;
        index        index.html;

        # SPA fallback
        location / {
            try_files $uri $uri/ /index.html;
        }

        # Cache static assets
        location /assets/ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
```

### 9.4 Docker Compose（docker-compose.yml）

```yaml
version: "3.8"
services:
  alarm-clock:
    image: ghcr.io/${GITHUB_REPOSITORY}:latest
    container_name: alarm-clock
    ports:
      - "8080:80"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:80/"]
      interval: 30s
      timeout: 5s
      retries: 3
```

### 9.5 GitHub Actions CI/CD（.github/workflows/deploy.yml）

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:  # 手动触发

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test-and-build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run typecheck

      - name: Unit tests
        run: npm run test:unit

      - name: Build
        run: npm run build

      - name: E2E tests
        run: npm run test:e2e

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Docker metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=sha,prefix=,format=short
            type=ref,event=branch
            latest

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### 9.6 VM 部署步骤（运维手册）

```bash
# 1. SSH 到目标 VM
ssh user@your-vm-ip

# 2. 安装 Docker（如未安装）
curl -fsSL https://get.docker.com | sh

# 3. 创建部署目录
mkdir -p /opt/alarm-clock && cd /opt/alarm-clock

# 4. 下载 docker-compose.yml
wget https://raw.githubusercontent.com/<user>/<repo>/main/docker-compose.yml

# 5. 登录 GHCR（需要 Personal Access Token with read:packages）
echo $CR_PAT | docker login ghcr.io -u <username> --password-stdin

# 6. 拉取镜像并启动
docker compose pull && docker compose up -d

# 7. 验证
curl http://localhost:8080

# 8. 配置 Nginx 反向代理（可选，用于 HTTPS + 域名）
# 或直接使用 Caddy/Traefik
```

### 9.7 关键 package.json 脚本

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "lint": "eslint src/ --ext .ts,.tsx",
    "typecheck": "tsc --noEmit",
    "test:unit": "vitest run",
    "test:unit:watch": "vitest",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

---

## 附录 A：技术风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 浏览器标签页后台时 setInterval 降频 | 闹钟触发延迟 | 使用 Web Worker 保持精确计时 |
| IndexedDB 浏览器兼容性 | 部分浏览器不可用 | 降级到 localStorage（Dexie 不支持自动降级，需手动处理） |
| 用户关闭浏览器后闹钟不触发 | 体验受限 | 产品说明中明确告知；可考虑未来加入 Service Worker |
| Notification API 需用户授权 | 通知不弹出 | 首次使用时引导授权；视觉提醒始终可用作为保底 |
| 音频自动播放被浏览器阻止 | 无声提醒 | 首次用户交互后初始化 AudioContext；提供视觉提醒保底 |

---

## 附录 B：未来版本规划（V2+）

- Service Worker 离线闹钟（PWA）
- 闹钟模板/预设
- 多个计时器并行
- 番茄钟模式
- 深色/浅色主题切换
- 数据导入/导出（JSON）
- 国际化（i18n）
- 闹钟统计（关闭延迟率等）
