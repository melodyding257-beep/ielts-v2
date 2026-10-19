# 项目清理与修改结果

日期：2026-10-13。范围：`ielts-v2` 本地工作区。现有功能保留，已完成本地文件整理、模块调整、依赖升级与验证。没有提交、推送或部署，也没有修改线上数据库。

## 文件范围与恢复方式

检查前已保存 82 个项目文件的源码快照和 SHA-256 清单，包含当时已有的未提交业务改动。快照位于项目外的 Codex 检查目录，文件名为 `ielts-v2-before-cleanup.zip`；实际 `.env.local`、`backend/.env`、第三方依赖、缓存和 Git 历史不在快照内。

项目自身的源码、配置、脚本和文档按引用、框架入口及用途检查。第三方依赖通过清洁安装、版本约束和安全审计检查；构建产物通过目录统计、清理和重新构建检查。没有逐行阅读两万多个第三方包文件。逐文件状态、用途与本轮快照比较见 [file-review.json](docs/audit/file-review.json)。

| 已删除 | 依据 |
| --- | --- |
| `.claude/settings.local.json`、`CLAUDE.md` | 用户确认主要使用 Codex；应用不依赖这些 Claude 配置 |
| `components/layout/Header.tsx`、`components/ui/Button.tsx`、`components/ui/FileUpload.tsx` | 没有应用引用，实际页面使用其他实现 |
| `types/index.ts` | 未引用且与实际解析契约不一致 |
| `public/file.svg`、`globe.svg`、`window.svg`、`next.svg`、`vercel.svg` | 没有资源引用的 Next.js 模板图片 |
| `backend/test_kimi.py` | 未使用的旧模型脚本，包含密钥片段打印 |
| `backend/test_upload.html` | 已由保留的 `/parse-test` 页面替代的手动调试页 |
| Python `__pycache__`、四个本地服务日志 | 可重新生成的缓存或运行输出；已补齐忽略规则 |
| 整理前的 `.next` | 清除约 1.21 GiB 旧缓存，再用最终代码重新构建 |

`lib/supabase/middleware.ts` 移为 `lib/supabase/proxy.ts`，属于命名整理。根目录原 middleware 在前期环境修复中已迁为 Next.js 16 的 `proxy.ts`。`.git`、实际环境文件、`AGENTS.md`、所有页面/API、解析对比工具、favicon 和项目虚拟环境保留。Next.js 16.4 开发启动自动更新了 `AGENTS.md` 中的官方约定块。

## 环境与依赖

- 前端统一为 Next.js / `eslint-config-next` / `@next/env` **16.4.0**，React 保留 **19.2.4**。Supabase 使用 `@supabase/ssr` **0.10.3** 和 `supabase-js` **2.106.2**，删除弃用的 `auth-helpers-nextjs`。
- 修正 lockfile 并执行 `npm ci --ignore-scripts` 清洁安装，安装 370 个包；最终生产构建验证了 Windows SWC 原生模块可用。`package.json` 声明 ESM，消除运行 TS 测试时的模块格式警告。
- Node 推荐 **24.15.0**，脚本支持 Node 22.21+ 的环境代理能力。开发启动器按 Next.js 环境变量优先级加载配置，并让网络探测和 Next 子进程采用一致的网络通路。
- Python 使用项目内 `backend/.venv`，验证版本为 **3.13.12**。后端启动、测试和依赖检查都明确选择此解释器；热更新限定在 `backend/`，排除虚拟环境，不再扫描整个项目。
- 后端升级为 FastAPI **0.143.0**、Starlette **1.8.0**、python-multipart **0.0.32**、python-dotenv **1.2.4**，venv 的 pip 为 **26.2.1**。其他直接依赖保留经过现有逻辑测试的版本。
- 新增 `backend/constraints.txt`，固定本轮 Windows 环境中的 49 个运行依赖版本。另建临时空虚拟环境，按 requirements 安装并通过依赖检查和全部后端测试。Linux 独有的 uvloop 不在这份 Windows 验证结果内，实际 Linux 部署还需验证。
- 根目录保留 Supabase 配置，并明确本地 `BACKEND_URL` 与 `NEXT_PUBLIC_BACKEND_URL`。根目录中无读取用途的豆包变量已清理；后端原模型配置留在 `backend/.env`。日志不再打印模型 key 片段或 JSON 失败时的模型正文。
- 服务端增加解析地址和 `PARSER_TIMEOUT_MS` 校验。开发默认后端为 `http://localhost:8000`；生产必须配置 `BACKEND_URL`，缺失时上传返回可理解的 503 错误。默认上游等待时限为 420000 毫秒，平台网关自身的时限仍独立生效。
- `backend/render.yaml` 作为参考配置补齐 `rootDir: backend`、明确 Python 版本及变量入口，未将其认定为当前线上部署。字段依据 [Render Blueprint 文档](https://render.com/docs/blueprint-spec) 和 [Python 版本说明](https://render.com/docs/python-version)。

## 代码和功能调整

后端 `main.py` 拆为配置、模型适配、提示词、预处理、归一化、验收和耗时模块，`main.py` 保留解析编排及 API。保留仓库根目录的 `backend.main:app` 与后端目录的 `main:app` 两种启动入口。AST 比较确认提示词完全一致、24 个函数或类的主体保持一致；两个模型函数仅减少正文日志，移除了启动密钥诊断函数。详情见 [拆分检查](docs/audit/parser-refactor.json)。

解析数据类型集中到 `types/practice.ts`，原 `practiceHelpers.ts` 的类型导出保留兼容。`types/database.ts` 补齐关系并接入所有 Supabase 客户端。此类型来自仓库 SQL 和代码，尚未从线上数据库生成；不据此推断线上 schema 已核实。

API 接入 Zod 验证，检查文件 UUID、作答对象、用时和解析运行耗时；无效 JSON 返回 400。文件和练习请求显式按当前用户过滤，未登录且非游客的上传返回 401。统一错误提取，保留 Supabase 错误对象中的可读消息。Storage 删除失败时停止删除数据库记录；认证 code 交换失败返回登录页。

阅读高亮改为按文章文本偏移定位，支持重复文字、段落标签、富文本、跨段落和列表符号，接通右键移除。笔记默认打开最新一条，多条笔记可切换编辑，删除后显示剩余笔记。高亮和笔记仍是当前练习的内存状态，不新增持久化功能。

文件列表检查 HTTP 状态与响应格式，显示错误和重新加载入口，并在请求取消后停止更新状态。修复暗色系统主题下白底浅色文字的问题，移除已不存在的字体变量。练习状态改为准确提示提交后保存。判分函数增加答案类型防护，异常数组或字符串不再触发服务器异常，既有正常答案评分保持一致。

## 验证结果

| 检查 | 结果 |
| --- | --- |
| 前端清洁安装 | `npm ci --ignore-scripts` 通过 |
| 后端清洁安装 | 新建空虚拟环境安装 requirements + constraints，通过 `pip check` |
| `npm run lint` | 通过，无错误和 warning；最终后端启动脚本单独复查通过 |
| `npm run typecheck` | 通过 |
| `npm test` | **19 / 19** 通过，覆盖环境代理、高亮切片、解析配置、题目整理、输入验证和判分 |
| `npm run test:backend` | **24 / 24** 通过，原 21 项解析逻辑测试及 3 项接口测试；空虚拟环境同样通过 |
| `npm run check:backend` | 通过 |
| `npm run build` | 通过，所有现有路由保留 |
| 开发启动 | 新版 Next.js 在临时端口启动，Supabase 直连和本机代理均收到健康接口 401 响应 |
| 生产启动 | `npm start` 启动最终构建，首页可访问 |
| 后端实际启动 | 项目 venv 启动 FastAPI，健康接口 200，原后端目录入口可导入 |
| PDF 预处理 | 本地生成 PDF 的文字证据和 PNG 渲染通过；坏 PDF、页数限制返回 400 |
| 浏览器练习 | 最终生产构建在 Edge 中完成 **10 项**固定数据检查，无页面 JS 异常 |
| 浏览器文件列表 | 实际组件完成 HTTP 失败、重试恢复、格式错误 **3 项**检查；Next Link 仅在独立组件检查中替代为普通链接 |
| 页面/API 烟雾检查 | 登录、注册 200；未登录受保护入口跳转或 401；游客非法文件 400；认证回调无 code 返回登录页 |
| 文件差异 | `git diff --check` 通过，删除文件的代码引用已核对 |

浏览器检查使用固定解析响应，后端接口测试使用模型替身；没有真实用户注册、调用收费模型或写删真实材料。相关检查记录位于 [docs/audit](docs/audit/)。检查结束停止临时服务。

## 剩余事项

1. **开发依赖仍有审计告警。** 生产依赖审计为 **0**；全量 npm 审计为 **5 个 high 条目**，均属于 `eslint-config-next → eslint-plugin-next → fast-glob → micromatch → braces` 同一开发依赖链。根源是 [braces 嵌套模式导致栈耗尽的公告](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)。当前已发布 braces 3.0.3 仍被标记受影响；npm 的强制方案会将 Next 的 lint 配置退回 14.2.35，未采用。现有 lint 使用可信仓库配置，后续需跟踪上游修复。完整审计保存在 `dependencies-after-cleanup.json` 与 `dependencies-production-after-cleanup.json`。
2. **Python 测试库有弃用提示。** Starlette 1.8 的 TestClient 提示未来改用 `httpx2`，当前 httpx 方式仍能完成全部测试。提示不影响运行 API；后续可单独调整测试工具。升级后的 Python 扫描在已安装的 50 个包中未发现已知漏洞，见 `python-after-cleanup.json`。
3. **线上配置尚未核实。** 已知 Vercel 前端、Supabase 数据服务和 FastAPI 解析架构；FastAPI 的实际域名、托管平台与 Vercel 中隐藏的 `BACKEND_URL` 尚未读取。用户确认线上解析一直成功，应保留该配置作为发布基准。
4. **发布前回归仍需真实环境。** 核对线上 schema/RLS/Storage、模型 profile、CORS、网关文件大小及函数时限，使用已有成功的 PDF 和连续图片做一次预览环境回归。当前公开线上版本与本地存在差异，本轮没有覆盖线上可用版本。

日常启动从项目根目录运行 `npm run dev:backend` 与 `npm run dev`；初始化与排错步骤以 [README](README.md) 和 [开发指南](DEVELOPMENT_GUIDE.md) 为准。
