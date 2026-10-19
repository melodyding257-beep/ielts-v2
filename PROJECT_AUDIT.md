# 项目代码与环境检查

> 这是清理前的检查记录，保留问题发现时的版本和状态。后续已经实施的删除、修复、依赖版本及最终验证，以 [清理与修改结果](CLEANUP_RESULT.md) 为准。

检查日期：2026-10-13。范围是本地工作区、安装依赖、配置、现有测试和构建。用户确认保留现有功能；检查开始前工作区已有大量未提交修改，本轮在其基础上处理，没有回退已有功能代码，也没有提交或部署。

## 主要结论

项目已经有完整的主要业务链路，并非旧文档描述的 Next.js 15 骨架。当前前端为 Next.js 16.2.6 / React 19，解析由独立 FastAPI 后端完成。旧组件、示例和未接入类型确实存在；环境问题同时涉及网络、Python 依赖隔离和本地/线上变量命名，不能归为单一原因。

已确认的系统组成是：Vercel 承载 Next.js 页面与 API；Supabase 提供认证、数据库和 Storage；PDF/图片解析使用 FastAPI Python 服务。用户确认线上解析一直成功，现有解析链路应作为后续整理的回归基准。Python 服务的具体域名和托管平台尚未核实。仓库有 `backend/render.yaml`，仅提供 Render 部署线索；平台实际配置不能仅由仓库中是否存在部署文件判断。

本地 `.env.local` 未配置 `BACKEND_URL`，本地上传使用默认 `http://localhost:8000`。Vercel 中有该变量，当前值尚未读取；本地默认值不能用于推断线上配置。公开页面检查已经发现线上与工作区的版本差异。后续发布前应记录现有可用服务的部署配置，并核对变量所属环境和实际发布版本，而不是按解析故障重设地址。

### 线上部署复查

用户提供网站 `https://ielts-v2-8w12.vercel.app/`，确认 Vercel 项目中有 `BACKEND_URL` 变量，但尚未看到其值；并确认 Vercel 项目列表只有这个网站项目。解析服务的部署位置仍未确认，不能因为变量存在就判断地址有效，也不能因为值隐藏就认为变量为空。

用户进一步确认后端使用 FastAPI，且线上文件解析一直成功。FastAPI 与仓库的 Python 实现吻合；按用户实际使用情况，已有解析链路能够正常完成任务，后续整理应以此作为回归基准，不应把它当作未部署或未接通的故障来处理。解析服务具体域名、托管平台以及已部署代码版本仍待核实，本轮未直接测试完整上传/模型调用。

使用只读 GET 请求检查该站点，完整结果见 [线上请求记录](docs/audit/deployment-2026-10-13.json)：

| 入口 | 响应 | 说明 |
| --- | --- | --- |
| `/`、`/auth/login` | 200 | 页面正常，标题仍为 `Create Next App` |
| `/api/pdf/list` | 401 | 未登录时受到身份检查；不验证已登录用户的数据库访问 |
| `/api/pdf/upload` | 405 | GET 方法不被允许，符合 POST 上传入口的行为，不是上传失败测试 |
| `/parse-test` | 404 | 本地存在的调试页未出现在该线上入口 |
| `/parse`、`/docs`、`/openapi.json` | 404 | 仅说明这些路径没有公开入口；结合用户确认线上解析成功，不能据此认定解析服务未部署 |

上述页面标题与路由与当前工作区不同，确认线上部署与当前工作区不一致，尚未确认线上对应的 Git commit。本轮没有上传文件或调用收费模型，因此不能据此宣称线上解析成功或失败。

当前检查结论收敛为：线上解析可用性由用户使用情况确认；本地虚拟环境与依赖隔离问题已经修正；线上与工作区版本不同已由公开页面检查确认。环境变量是否隐藏、Python 框架名称和前端域名下的 404 都不是解析故障的独立证据。后续清理优先处理依赖安全更新、未接入代码、类型契约和功能遗留问题，并对现有成功解析材料进行回归验证。

本地已提交版本的上传接口先要求登录，然后通过 `BACKEND_URL` 转发到 `/parse`；工作区的新上传实现另外支持游客解析。这也说明核实线上行为时应先确认发布的代码版本，不能拿工作区中尚未发布的功能或日志判断线上状态。

Vercel [官方支持 FastAPI 部署](https://vercel.com/docs/frameworks/backend/fastapi)，后端不必迁移到 Render 才能运行。但当前 Python 入口是 `backend/main.py`，依赖清单也在 `backend/`；不能仅将项目根目录按 Next.js 构建就认为 Python 服务也已部署。需要核实实际部署的 Python Function、项目 Root Directory/框架配置或外部解析服务域名。仓库中的 Render 配置仍是一条线索，即使 Vercel 只有一个项目，也无法排除 Python 服务在其他平台上。

Vercel 的 [Config 与 Secret 变量](https://vercel.com/docs/environment-variables/sensitive-environment-variables) 可见性不同：Config 值可由授权成员读取，Secret 保存后隐藏当前值。若 `BACKEND_URL` 为 Secret，先识别真实解析服务地址，再决定配置修复，避免猜测地址或覆盖现有设置。

### 1. Python 原先使用全局环境，已建立隔离环境

原先没有根目录或后端目录中的 `.venv` / `venv`；`sys.prefix == sys.base_prefix`，说明使用全局 Python 3.13.12。

全局安装的 `httpx` 为 0.28.1、`python-dotenv` 为 1.2.2，与 `requirements.txt` 声明的 0.27.2、1.0.1 不一致。原环境的 `pip check` 和 21 项解析测试能够通过，因此证据是“缺少隔离、版本不一致”，并非“已证实这些版本造成故障”。

本轮创建 `backend/.venv`，按现有 requirements 安装，依赖检查和 21 项测试通过。新增 `npm run dev:backend`、`check:backend`、`test:backend`，明确选择项目虚拟环境。没有改变全局 Python 安装。虚拟环境和缓存已加入忽略规则。

`dashscope` 和 Python 的部分传递依赖仍使用范围约束，本次新环境解析到 dashscope 1.27.7；原全局环境是 1.27.6。若需要严格复现线上依赖，下一步应建立可跨平台维护的 Python 锁定流程，不能把这次安装等同于全部依赖已经锁定。

### 2. Supabase 超时与代理

用户日志显示直连 `UND_ERR_CONNECT_TIMEOUT`，而代理得到 HTTP 401。健康探测没有携带 API key，所以 401 代表收到 HTTP 响应，不是用户登录失败的证据，也不验证数据库或 Storage 权限。

本次复测中，直连和 `127.0.0.1:17891` 代理各三次均收到 HTTP 401；DNS 返回 `198.18.0.27`，属于 Fake-IP 范围。该结果说明检测时两条通路可达，不能还原此前故障原因。切换代理或节点后，应重新启动 Next.js。

原启动与体检脚本用两套正则读环境，优先读取 `.env.local`，忽略 shell 和部分 Next.js 环境文件；网络体检也未完整清除小写代理变量。本轮统一为 Next.js 官方 `@next/env` 加载器，并统一代理环境处理。探测增加 6 秒请求超时和子进程上限，开发服务器使用实际探测后选定的网络通路。支持 Node 22.21 的代理能力回移，版本条件见 [Node 官方说明](https://nodejs.org/api/cli.html#node_use_env_proxy1)。

### 3. 本地与线上后端地址曾混淆，示例已修正

`app/api/pdf/upload/route.ts` 读取 `BACKEND_URL`，原根目录示例只有 `NEXT_PUBLIC_BACKEND_URL`。二者职责不同：前者是 Next.js 服务端地址，后者是 `/parse-test` 浏览器直接调用地址。

示例现已列出两者，并增加后端 `.env.example` 的 `ALLOWED_ORIGINS`、页数与模型默认配置。删除示例中没有代码使用的 service role key 要求。真实 `.env.local` / `backend/.env` 的内容保持原样；根 `.env.local` 中的豆包变量没有被 Python 后端使用，不需要复制真实密钥到更多位置。

退出登录原先可能跳回默认 `localhost:3000`，现改为使用请求所在站点的地址，HTTP 303 防止 POST 方法继续转发。示例不再要求 `NEXT_PUBLIC_APP_URL`。

### 4. 代码检查与 Next.js 约定

修复 PDF 列表和练习记录接口中两个 `catch: any` 的 lint 错误，以及两个未使用的 request 参数，保留 Supabase 错误消息处理。

按安装版本的文档，把根 `middleware.ts` 迁移为 `proxy.ts`，增加解析对比页的会话刷新。页面/API 自身仍验证用户，不把 Proxy 当作唯一授权层。此次修改后的生产构建通过。

新增独立 typecheck 和前后端测试命令，使用 `.nvmrc` 记录验证过的 Node 24.15.0，声明脚本所需 Node 范围。Supabase 两个正在使用的包固定为本机已有版本 0.10.3 / 2.106.2，未升级 SDK。

lockfile 中 Windows SWC 原先位于嵌套位置，Next.js 检测为缺少顶层 optional dependency 并自动补写。已归一到标准位置；多个操作系统的 optional SWC 包需要保留，以支持本地 Windows 和线上 Linux。

### 5. 依赖安全更新应优先于功能扩展

`npm audit --omit=dev` 报告 6 个受影响的包条目：1 个 critical、4 个 high、1 个 moderate。条目涉及 Next.js、sharp、PostCSS、nanoid、source-map-js、baseline-browser-mapping，数量不是 6 个已在此网站中成功复现的漏洞。

完整报告保存在 [依赖审计 JSON](docs/audit/dependencies-2026-10-13.json)。npm 给出的 Next.js 修复候选版本为 16.4.0；具体升级时需要同步核实 `eslint-config-next`、`@next/env` 及相关依赖，并按目标版本文档回归登录、上传、练习和构建。

Next.js 官方确认 16.2.6 落入 [Windows 托管服务远程代码执行公告](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36) 的受影响范围。该公告针对 Windows 托管服务器；当前尚未获知线上宿主平台，不能直接断言线上触发此问题。其他公告也有各自触发条件，应按实际使用功能核实。

本轮没有改变 Next.js / React 版本，框架安全更新仍是待处理事项。构建通过不代表依赖审计通过。

## 未使用代码与清理建议

通过 TypeScript/TSX 相对路径及 `@/` import 检查，并结合路由与手动入口核实。以下文件保留在工作区，没有因为 lint 或没有 import 而删除功能。

| 文件或依赖 | 当前证据 | 建议 |
| --- | --- | --- |
| `components/layout/Header.tsx` | 没有导入，只有旧导航骨架 | 可删除或在导航重构时接入 |
| `components/ui/Button.tsx` | 没有导入，页面直接写按钮 | 确定统一 UI 方案后清理 |
| `components/ui/FileUpload.tsx` | 没有导入，上传走 `dashboard/UploadSection` | 可清理旧上传组件 |
| `lib/utils/validators.ts` | 没有导入；旧上传 schema 只允许 PDF，与图片功能不一致 | 接入验证前先更新规则，或删除后一起移除 zod |
| `types/index.ts` | 没有导入；字段和题型与当前数据流不同 | 可清理，避免新代码误用 |
| `types/database.ts` | 没有导入，Supabase 客户端未使用该泛型；answers 类型也不包含多选数组 | 应由真实数据库生成并接入，或明确标记草稿 |
| `@supabase/auth-helpers-nextjs` | 没有代码导入；npm 明确提示弃用，当前代码用 `@supabase/ssr` | 可在依赖清理中移除，见 [官方迁移说明](https://supabase.com/docs/guides/troubleshooting/how-to-migrate-from-supabase-auth-helpers-to-ssr-package-5NRunM) |
| `@supabase/supabase-js` | 应用没有直接 import，但由 `@supabase/ssr` 使用 | 不应按无直接 import 误判为无用依赖 |
| `zod` | 只被未接入 validators 使用 | 与 validators 的去留一起处理 |
| `public/file.svg`、`globe.svg`、`window.svg`、`next.svg`、`vercel.svg` | 没有当前代码引用 | 可作为模板资源清理 |
| `backend/test_kimi.py` | 手动调试旧 Kimi 服务；现有生产解析 profile 不包括 Kimi，且脚本打印部分 key | 保留记录后决定移除；不要在共享日志环境运行 |
| `backend/test_upload.html` | 手动浏览器入口，不是应用页面 | 属于调试工具，不能仅凭无 import 判定无用途 |
| `backend/__pycache__`、根目录服务日志 | 生成文件；一个 `.pyc` 已被 Git 跟踪 | 忽略规则已加；已跟踪 `.pyc` 后续需要单独从版本管理移出 |
| `.claude/settings.local.json` | 仅包含 Claude Code 的本机权限配置，应用没有引用 | 停止使用 Claude Code 时可删除；继续使用时按本机工具配置管理 |
| `CLAUDE.md` | 当前只包含 `@AGENTS.md`，供 Claude 读取开发约定 | 停止使用 Claude 时可与 `.claude` 一起删除 |
| `AGENTS.md` | 包含当前 Next.js 开发约定，开发指南也引用它 | 保留，供后续开发使用 |

## 保留的功能问题与后续整理顺序

1. **阅读高亮尚未接通**：`ReadingPanel` 接收 highlights/notes，但未参与文章渲染；右键处理函数也没有绑定。还存在 3 个 lint warning。用户希望保留功能，因此不能直接删掉状态、菜单和回调来消除警告；需要单独修复文本选择、高亮渲染及移除交互。
2. **错误可能被显示为空列表**：`FileList` 对列表接口未检查 HTTP 状态，失败后可能按空数组渲染，仅打印控制台错误，应补齐界面的重试和错误反馈。
3. **后端文件职责过多**：`backend/main.py` 约 1,365 行，模型适配、提示词、预处理、验收和 API 集中在一个文件。可在现有 21 项测试基础上逐步拆分，避免同时改解析规则。
4. **类型契约分散**：实际类型主要在 practiceHelpers，ParseTester 和 FileList 也有局部类型；旧 types 与当前数据库/答案结构存在差异。先统一真实数据契约，再接入 Supabase 泛型和 API 入参验证。
5. **生产上传缺少应用内限流与字节限制**：游客可调用 Next.js 上传链路，FastAPI `/parse` 本身无身份校验；页数限制不等同于文件字节大小或请求频率限制。生产部署需根据实际网关配置核实限流、最大请求和超时，保留游客功能。
6. **数据库初始化说明不完整**：仓库 schema 有表 RLS，但没有 Storage bucket/对象策略；已有迁移添加唯一索引前也未处理历史重复记录。线上实际状态未核实，不能直接运行 schema 推断无风险。
7. **测试页含义需明确**：`/admin/parse-tests` 实际是登录用户自己的解析对比，没有 admin 角色；`/parse-test` 无需登录，供浏览器直接调用后端。均是现有入口，本轮保留。

建议顺序：核实线上平台和依赖安全更新 → 统一虚拟环境与部署变量 → 清理确认无用文件和弃用包 → 修复高亮及错误反馈 → 分拆后端和类型契约 → 开展新功能更新。

## 验证与边界

- Python 新虚拟环境：依赖检查通过；21 项现有解析测试通过；本地 TestClient 健康接口 200，非法 `.txt` 上传返回 400，不调用收费模型。
- 前端测试：4 项现有题目整理测试、3 项新增代理环境测试，共 7 项通过。
- lint：两个错误已修复，剩余 3 个 warning 均来自上述未接通的阅读高亮功能。
- 类型检查与生产构建：修改后通过；初次沙箱检查的 SWC Windows realpath 拒绝访问在允许访问路径的执行环境中不复现。
- 开发启动：临时端口 3013 上 `npm run dev` 完成网络探测并成功启动；首页与登录页返回 200，未登录的文件列表 API 返回 401。检查后停止测试服务。
- 网络复测：两条网络通路各 3 次收到 HTTP 响应，仅验证当时网络可达。
- 安装过程：一次 `npm ci` 遇到 Windows `.node` 文件 `EPERM`；使用 npm install 恢复依赖后再次清洁安装成功，安装 373 个包。归一后的 lockfile 覆盖全部平台 SWC optional dependency，manifest 与 lockfile 一致。
- 原工作区的真实密钥保持原样，没有输出完整密钥，没有运行收费模型解析、真实用户注册、上传/删除操作或数据库迁移。
- Supabase 管理连接读取项目列表时失败，因此线上真实表结构、RLS、Storage、邮箱确认设置与部署平台环境仍未核实。本地 schema 审查不能代替线上验证。
