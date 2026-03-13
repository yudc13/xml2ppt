# Sentry 接入实施方案（Next.js 16 + App Router）

## 1. 目标
- 为项目接入统一的错误监控，覆盖浏览器、Node 服务端、Edge 运行时。
- 保持最小改动，避免影响现有业务逻辑。
- 先完成错误上报 MVP，再逐步扩展性能与回放能力。

## 2. 输入信息
- Sentry DSN：已提供
- Organization：`yudc`
- Project：`ppt-nextjs`
- 接入方式：SaaS（非自建）

## 3. 实施步骤
1. 安装依赖
- 使用 `bun add @sentry/nextjs`。

2. 初始化三端 SDK
- `instrumentation-client.ts`：浏览器端初始化。
- `sentry.server.config.ts`：Node 端初始化。
- `sentry.edge.config.ts`：Edge 端初始化。
- 通过 `instrumentation.ts` 在服务端/边缘运行时按环境加载对应配置。

3. 构建配置接入
- 在 `next.config.ts` 使用 `withSentryConfig` 包装 Next 配置。
- 先采用保守配置，避免在本地开发产生过多噪音。

4. 环境变量与示例
- 在 `.env.example` 增加 Sentry 所需变量：
  - `NEXT_PUBLIC_SENTRY_DSN`
  - `SENTRY_ORG`
  - `SENTRY_PROJECT`
  - `SENTRY_AUTH_TOKEN`（仅 CI/CD 使用）

5. 验证
- 本地执行 `bun run lint` 进行静态检查。
- 启动开发环境后手动制造一次前端/服务端异常，确认事件能进入 Sentry。

## 4. 约束与原则
- 不修改无关业务文件。
- 不在代码中硬编码 Token 等敏感信息。
- 只提交和 Sentry 接入直接相关的最小改动。

## 5. 后续增强（可选）
- 按环境设置 `tracesSampleRate` 与 `replaysSessionSampleRate`。
- 在登录态注入用户上下文（需脱敏策略）。
- CI 统一 release 版本并上传 source map，提升堆栈可读性。

## 6. GitHub Actions 配置
- 工作流文件：`.github/workflows/docker-build.yml`
- 需要在 GitHub 仓库中配置以下项：
  - `Secrets`
    - `SENTRY_AUTH_TOKEN`
  - `Variables`
    - `SENTRY_ORG`（示例：`yudc`）
    - `SENTRY_PROJECT`（示例：`ppt-nextjs`）
    - `NEXT_PUBLIC_SENTRY_DSN`
    - `SENTRY_DSN`
- 工作流会将 `SENTRY_RELEASE` 设置为 `${{ github.sha }}`，用于 source map 与错误版本关联。
