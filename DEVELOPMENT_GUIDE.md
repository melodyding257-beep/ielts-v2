# 开发与环境排错

功能代码已实现，不再是初始骨架。先阅读 `PROJECT_STRUCTURE.md`，再修改对应的数据流。遵守 `AGENTS.md`：写 Next.js 代码前先阅读安装版本的 `node_modules/next/dist/docs/`，不要按其他版本套用接口。

## 日常运行

从项目根目录运行 `npm run dev:backend` 和 `npm run dev`。后端脚本明确选择 `backend/.venv`，不依赖当前 shell 是否激活虚拟环境。完整初始化步骤见 README。

可以使用以下命令确认 Python 环境：

```powershell
& .\backend\.venv\Scripts\python.exe -c "import sys; print(sys.executable); print(sys.prefix != sys.base_prefix)"
npm run check:backend
npm run test:backend
```

不要用全局 `pip install` 修补本项目依赖；使用虚拟环境解释器的 `-m pip`。IDE 的 Python 解释器也应选择 `backend/.venv/Scripts/python.exe`。`.env` 是配置文件，`.venv` 是解释器与依赖目录，两者作用不同。

## Supabase 网络报错

`UND_ERR_CONNECT_TIMEOUT`、`ECONNRESET` 或 `fetch failed` 先执行 `npm run net:check`，比较直连与本机代理；不要立即归因于登录密码、Python 或数据库。

探测 `/auth/v1/health` 没有携带 API key，返回 HTTP 401 只能证明有响应。它不证明用户认证成功、数据库表存在或 Storage 权限正常。

开发启动器使用 Next.js 官方环境加载器：shell → `.env.development.local` → `.env.local` → `.env.development` → `.env`。直连与代理探测都会清除继承的大小写代理变量，Next.js 子进程使用最终被选择的同一条通路；本机后端地址放在 `NO_PROXY` 中。

HTTP 探测每次最多 6 秒，启动器每个子进程另有 8 秒上限。代理切换后重启 Next.js；运行中的进程不会自动重新选择网络。

## 上传与解析失败

1. 确认 Python 后端已经启动，访问 `/` 检查模型是否已配置。
2. 确认 Next.js 的 `BACKEND_URL` 指向实际后端。只设置 `NEXT_PUBLIC_BACKEND_URL` 不能更改常规上传的地址。
3. `/parse-test` 是浏览器直接调用后端，需同时检查 HTTPS、浏览器可达地址和 `ALLOWED_ORIGINS`。
4. 在前端响应与 Python 日志中按 `runId` 对齐阶段耗时。HTTP 422 代表解析结果未通过结构验收，不等同于网络超时。
5. 已解析但保存失败时，检查 Supabase 数据库迁移和 `pdfs` Storage 策略。

后端的 `backend/.env` 会覆盖同名 shell 变量，这是现有模型切换设计。修改模型后重启 FastAPI；生产部署不要携带本地 `.env`，以免覆盖平台配置。

## 依赖安装和构建失败

Node 建议使用 `.nvmrc` 的版本；保留 `package-lock.json`，优先使用 `npm ci` 重现环境。Next.js 原生 SWC 包按操作系统选择，lockfile 中包含多个平台的 optional dependency 是正常的，不要为缩小仓库而删除它们。

Windows 出现 `EPERM ... unlink ... .node` 时，检查是否有开发服务或构建进程仍在占用原生模块，或系统文件访问限制；先正常停止对应进程，再重装依赖。不要结束所有 Node 进程，也不要删除源码或 `.env`。若只有受限工具的运行报“拒绝访问 / failed to canonicalize”，需要区分执行环境的权限限制与项目本身的构建失败。

生产构建执行 `npm run build`。Next.js 16 不自动替代独立 lint 检查，提交前同时运行 `npm run lint`、`npm run typecheck`、`npm test` 和后端测试。

## 维护边界

已删除确认无用途的旧组件、模板资源、Claude 配置和旧调试文件，详见 `CLEANUP_RESULT.md`。不要仅凭“没有 import”删除 App Router 页面、Route Handler、Proxy 或手动运行的脚本；这些文件由框架或用户直接调用。

阅读高亮按文章的文本偏移定位，包含富文本、段落标签和列表符号。修改文章渲染时，要同步核对 DOM 中的文本顺序，使用重复文本、跨格式和跨段落场景验证。高亮和笔记保留为当前练习的内存状态，刷新页面不会保存它们。

`types/practice.ts` 是前后端解析契约的前端定义；`types/database.ts` 已接入 Supabase 客户端，但来自仓库 SQL 和当前代码，尚未从线上数据库重新生成。上线前应与实际 schema 核对；本轮没有执行远程迁移。

后端模块分别处理配置、模型调用、提示词、预处理、归一化、验收与 API 编排。修改依赖时同时维护 `backend/requirements.txt` 与 `backend/constraints.txt`，重新清洁安装并测试。Python 启动脚本不生成 `.pyc`；这些文件和 `.venv` 不应提交。
