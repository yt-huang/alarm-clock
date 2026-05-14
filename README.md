# TimePilot 定时闹钟

一个产品化的浏览器定时闹钟应用，支持当前时间展示、多种闹钟策略、倒计时、贪睡、本地持久化、声音和视觉提醒。

## 功能

- 实时展示当前时间与日期
- 闹钟策略：一次性、每日、工作日、周末、指定星期、倒计时/计时器、循环休息
- 循环休息：例如每专注 60 分钟提醒休息 10 分钟，休息结束后自动进入下一轮专注
- 标签/备注、启用/禁用、删除、试听铃声
- 贪睡：可设置贪睡分钟和最大次数
- 浏览器声音提醒、视觉弹窗提醒、可选系统通知
- localStorage 本地持久化，无需后端即可使用
- 响应式布局，适配桌面和移动端
- Docker + GitHub Actions + GHCR + VM 部署

## 本地开发

```bash
npm install
npm test
npm run dev
```

访问：

- Local: <http://localhost:5173/>
- LAN: 使用 `npm run dev -- --host 0.0.0.0` 后访问本机局域网 IP 的 5173 端口

## 构建

```bash
npm run build
npm run preview
```

## Docker

```bash
docker compose up -d --build
```

默认端口：<http://localhost:8025/>

## 部署

GitHub Actions 会在推送 `main` 后：

1. 安装依赖并运行测试
2. 构建静态资源
3. 构建 Docker 镜像并推送到 GHCR
4. SSH 到 VM 执行 `docker compose pull && docker compose up -d`

需要仓库 secrets：

- `SERVER_HOST`
- `SERVER_USER`
- `SERVER_SSH_KEY`

## 验收清单

- [x] 首页显示当前时间并每秒更新
- [x] 能创建一次性/每日/工作日/周末/指定星期/倒计时/循环休息闹钟
- [x] 循环休息支持“每 N 分钟专注 + M 分钟休息”并自动交替提醒
- [x] 闹钟到期弹出视觉提醒并播放铃声
- [x] 支持贪睡、试听、禁用、删除
- [x] 刷新后闹钟仍保留
- [x] `npm test` 与 `npm run build` 通过
