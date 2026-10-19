#!/usr/bin/env node
/**
 * Next.js 启动器：自动为 Node 挑选可用的网络通路
 * ══════════════════════════════════════════════════════════════════
 * 背景（已实测确认）：
 *   1. Node 的内置 fetch 不读系统代理（WinINET）。浏览器能上网 ≠ Node 能上网。
 *   2. 开 0dcloud 的 TUN + Fake-IP 时，Node 走 TUN；该通路对 *.supabase.co
 *      会出现挂起(UND_ERR_CONNECT_TIMEOUT)或重置(ECONNRESET)。
 *   3. 0dcloud 的 HTTP 代理端口（默认 127.0.0.1:17891）有时可用、有时也会 ECONNRESET。
 *      两条通路都会抖，所以不能写死走哪条。
 *
 * 本脚本做法：
 *   启动前分别探测「直连」和「走代理」；可用代理优先，代理失败时使用可用直连；
 *   都不行则照常启动并给出提示。
 *   代理模式下通过 NODE_USE_ENV_PROXY=1 让 Node 的 fetch 走代理（Node 22.21+/24+ 支持，
 *   无需 undici / global-agent 等额外依赖）。
 *
 * 用法：
 *   npm run dev                     # 自动择优（推荐）
 *   npm run dev -- --direct         # 清除代理变量后按直连启动
 *   npm run dev:direct              # 跳过启动器，继承 shell 网络设置
 *   ODC_PROXY_PORT=7890 npm run dev # 代理端口非默认时
 *   npm run net:check               # 只做网络体检，不启动服务
 */
import { spawn } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'
import fs from 'node:fs'
import { PROJECT_ROOT, loadDevelopmentEnv, networkEnv, supportsEnvProxy } from './environment.mjs'

loadDevelopmentEnv()
const HOST = process.env.ODC_PROXY_HOST || '127.0.0.1'
const PORT = Number(process.env.ODC_PROXY_PORT || 17891)
const PROXY = `http://${HOST}:${PORT}`

function probePort(host, port, timeout = 600) {
  return new Promise((resolve) => {
    const s = net.connect({ host, port })
    const done = (v) => { s.destroy(); resolve(v) }
    s.setTimeout(timeout)
    s.once('connect', () => done(true))
    s.once('timeout', () => done(false))
    s.once('error', () => done(false))
  })
}

/** 在独立子进程里请求 url，可指定是否走代理；返回 {ok, text} */
function httpProbe(url, proxy) {
  const env = networkEnv(proxy)
  const code = `
    const t = Date.now();
    fetch(${JSON.stringify(url)}, { redirect: 'manual', signal: AbortSignal.timeout(6000) })
      .then(async r => {
        await r.body?.cancel();
        console.log('OK ' + r.status + ' ' + (Date.now() - t) + 'ms');
      })
      .catch(e => console.log('FAIL ' + ((e.cause && e.cause.code) || e.message) + ' ' + (Date.now() - t) + 'ms'));
  `
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['-e', code], { env, stdio: ['ignore', 'pipe', 'ignore'] })
    let out = ''
    const timer = setTimeout(() => child.kill(), 8000)
    child.stdout.on('data', (d) => (out += d))
    child.once('close', () => { clearTimeout(timer); const text = out.trim(); resolve({ ok: text.startsWith('OK'), text }) })
    child.once('error', () => { clearTimeout(timer); resolve({ ok: false, text: 'FAIL spawn' }) })
  })
}

async function httpProbeWithRetries(url, proxy, attempts = 3) {
  let last = { ok: false, text: 'FAIL no attempts' }
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    last = await httpProbe(url, proxy)
    if (last.ok) return last
  }
  return last
}

const proxySupported = supportsEnvProxy()
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const healthUrl = (supabaseUrl || 'https://supabase.co') + '/auth/v1/health'

console.log('─'.repeat(68))
console.log(`[dev] Node ${process.versions.node}${proxySupported ? '' : '  ⚠️ 请使用 Node 22.21+ 或 24+ 以支持代理'}`)
console.log('[dev] 健康检查未携带 API key；HTTP 401 表示已收到响应，只用于检查网络连通性')

const forceDirect = process.env.ODC_FORCE_DIRECT === '1' || process.argv.includes('--direct')
const proxyAlive = forceDirect ? false : await probePort(HOST, PORT)

let mode = 'direct'
let detail = '未检测到代理端口，按直连启动'

if (supabaseUrl) {
  const direct = await httpProbe(healthUrl, null)
  console.log(`[dev] 直连(TUN/Fake-IP) Supabase: ${direct.ok ? '✅' : '❌'} ${direct.text}`)
  // Fake-IP/TUN sometimes returns a single successful 401 health response,
  // but subsequent Supabase requests still reset the TLS connection. When a
  // working local proxy is available, prefer it for the whole Next process.
  if (proxyAlive && proxySupported) {
    const viaProxy = await httpProbeWithRetries(healthUrl, PROXY)
    console.log(`[dev] 经代理 ${PROXY} Supabase: ${viaProxy.ok ? '✅' : '❌'} ${viaProxy.text}`)
    if (viaProxy.ok) {
      mode = 'proxy'
      detail = direct.ok
        ? `检测到代理可用，优先使用代理 ${PROXY}（避免 Fake-IP 直连不稳定）`
        : `直连不可用，已自动切换到代理 ${PROXY}`
    } else if (direct.ok) {
      detail = '代理探测失败，暂时使用直连；如 Supabase 请求失败请检查梯子节点'
    } else {
      detail = '直连与代理都不通，请检查 0dcloud 是否已连接/节点是否可用'
    }
  } else {
    detail = direct.ok
      ? '直连探测成功，按直连启动'
      : '直连探测失败且没有可用代理，请检查网络及代理设置'
  }
} else {
  console.log('[dev] 未配置 NEXT_PUBLIC_SUPABASE_URL，跳过自检')
  if (proxyAlive && proxySupported) { mode = 'proxy'; detail = `检测到代理 ${PROXY}，已启用` }
}

// Start Next with the same network route that was actually probed.
const env = networkEnv(mode === 'proxy' ? PROXY : null)

console.log(`[dev] 模式: ${mode === 'proxy' ? '经代理' : '直连'}  →  ${detail}`)
console.log('─'.repeat(68))

const nextBin = path.join(PROJECT_ROOT, 'node_modules', 'next', 'dist', 'bin', 'next')
if (!fs.existsSync(nextBin)) {
  console.error('[dev] 找不到 next，请先执行 npm install')
  process.exit(1)
}

const child = spawn(process.execPath, [nextBin, 'dev', ...process.argv.slice(2).filter((a) => a !== '--direct')], {
  cwd: PROJECT_ROOT,
  env,
  stdio: 'inherit',
})
child.once('exit', (code) => process.exit(code ?? 0))
