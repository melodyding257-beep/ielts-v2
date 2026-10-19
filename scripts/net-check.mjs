#!/usr/bin/env node
/**
 * 网络体检脚本（Next.js + Supabase + 0dcloud 环境）
 * ---------------------------------------------------------------
 * 一条命令看清故障到底发生在哪一层：
 *   1. Node 版本是否支持走环境变量代理
 *   2. 0dcloud 的 HTTP 代理端口是否在监听
 *   3. DNS 是否被代理接管（Fake-IP 198.18.0.0/15）
 *   4. 走 TUN / Fake-IP（Node 默认通路）能否连上 Supabase
 *   5. 走代理端口能否连上 Supabase
 * 最后给出结论和建议。
 *
 * 用法：npm run net:check
 */
import { spawn } from 'node:child_process'
import net from 'node:net'
import dns from 'node:dns/promises'
import { loadDevelopmentEnv, networkEnv, supportsEnvProxy } from './environment.mjs'

loadDevelopmentEnv()
const PROXY_HOST = process.env.ODC_PROXY_HOST || '127.0.0.1'
const CANDIDATE_PORTS = process.env.ODC_PROXY_PORT
  ? [Number(process.env.ODC_PROXY_PORT)]
  : [17891, 7890, 7897, 1080, 10809]

const line = (s = '') => console.log(s)
const ok = (s) => console.log(`  ✅ ${s}`)
const bad = (s) => console.log(`  ❌ ${s}`)
const warn = (s) => console.log(`  ⚠️  ${s}`)

function probe(host, port, timeout = 600) {
  return new Promise((resolve) => {
    const s = net.connect({ host, port })
    const done = (v) => { s.destroy(); resolve(v) }
    s.setTimeout(timeout)
    s.once('connect', () => done(true))
    s.once('timeout', () => done(false))
    s.once('error', () => done(false))
  })
}

/** 在独立子进程里跑 fetch，可自由注入代理环境变量 */
function fetchInChild(url, { useProxy } = {}) {
  const env = networkEnv(useProxy)
  const code = `
    const url = ${JSON.stringify(url)};
    (async () => {
      const results = [];
      for (let i = 0; i < 3; i++) {
        const t = Date.now();
        try {
          const r = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(6000) });
          await r.body?.cancel();
          results.push('OK ' + r.status + ' ' + (Date.now() - t) + 'ms');
        } catch (e) {
          results.push('FAIL ' + ((e.cause && e.cause.code) || e.message) + ' ' + (Date.now() - t) + 'ms');
        }
      }
      console.log(results.join(String.fromCharCode(10)));
    })();
  `
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['-e', code], { env, stdio: ['ignore', 'pipe', 'ignore'] })
    let out = ''
    const timer = setTimeout(() => child.kill(), 22000)
    child.stdout.on('data', (d) => (out += d))
    child.once('close', (code) => {
      clearTimeout(timer)
      resolve(out.trim() ? out.trim().split('\n').filter(Boolean) : [code === null ? 'FAIL probe timed out' : `FAIL probe process exited (${code})`])
    })
    child.once('error', () => { clearTimeout(timer); resolve(['FAIL spawn']) })
  })
}

// ────────────────────────────── 开始体检 ──────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const host = supabaseUrl ? new URL(supabaseUrl).hostname : 'supabase.co'
const probeUrl = (supabaseUrl || 'https://supabase.co') + '/auth/v1/health'

line('═'.repeat(66))
line('  网络体检：Next.js → Supabase（0dcloud 代理环境）')
line('═'.repeat(66))

// 1. Node
line('\n[1/5] Node 运行时')
const proxySupported = supportsEnvProxy()
if (proxySupported) ok(`Node v${process.versions.node}，支持 NODE_USE_ENV_PROXY（无需额外依赖）`)
else bad(`Node v${process.versions.node}，请使用 Node 22.21+ 或 24+ 以支持代理`)
line('  健康检查未携带 API key；HTTP 401 表示收到响应，只代表网络可达。')

// 2. 代理端口
line('\n[2/5] 0dcloud 代理端口')
let proxy = null
for (const port of CANDIDATE_PORTS) {
  if (await probe(PROXY_HOST, port)) { proxy = `http://${PROXY_HOST}:${port}`; break }
}
if (proxy) ok(`发现可用代理 ${proxy}`)
else bad(`未发现任何代理端口（试过 ${CANDIDATE_PORTS.join(', ')}）→ 0dcloud 可能没启动或未开启系统代理`)

// 3. DNS / Fake-IP
line('\n[3/5] DNS 解析')
try {
  const addrs = await dns.lookup(host, { all: true })
  const list = addrs.map((a) => `${a.address}(IPv${a.family})`).join(', ')
  const fake = addrs.some((a) => a.address.startsWith('198.18.') || a.address.startsWith('198.19.'))
  line(`  目标域名: ${host}`)
  line(`  解析结果: ${list}`)
  if (fake) warn('解析到 198.18.0.0/15 = Fake-IP，说明 DNS 已被 0dcloud 接管，Node 默认会走 TUN')
  else ok('不是 Fake-IP（DNS 未接管，或已切换为真实 IP 模式）')
} catch (e) {
  bad(`DNS 解析失败: ${e.code || e.message}`)
}

// 4 & 5. 两条通路
line('\n[4/5] 走 TUN / Fake-IP（Node 默认通路）')
const tunRes = await fetchInChild(probeUrl, {})
tunRes.forEach((r) => (r.startsWith('OK') ? ok(r) : bad(r)))
const tunOk = tunRes.some((r) => r.startsWith('OK'))

line('\n[5/5] 走代理端口')
let proxyRes = []
if (proxy && proxySupported) {
  proxyRes = await fetchInChild(probeUrl, { useProxy: proxy })
  proxyRes.forEach((r) => (r.startsWith('OK') ? ok(r) : bad(r)))
} else {
  warn('跳过（没有可用代理端口或 Node 版本不支持代理）')
}
const proxyOk = proxyRes.some((r) => r.startsWith('OK'))

// 结论
line('\n' + '═'.repeat(66))
line('  结论')
line('═'.repeat(66))
if (proxyOk && !tunOk) {
  line('  Node 默认通路(TUN/Fake-IP)连不上 Supabase，但走代理端口正常。')
  line('  → 这就是服务端报 "fetch failed / ECONNRESET" 的直接原因。')
  line('  → 用 `npm run dev` 启动（会自动切到代理）即可解决。')
} else if (!proxyOk && !tunOk) {
  line('  当前探测没有收到 HTTP 响应，尚不能确定故障来源。')
  line('  → 检查 Supabase URL、DNS、Node 版本和代理设置，再重跑本脚本。')
} else if (!proxyOk && tunOk) {
  if (proxy) {
    line('  代理端口在监听，但连接被重置（ECONNRESET）→ 0dcloud 上游节点异常。')
    line('  → 请在 0dcloud 里换一个节点或「重新连接」。')
  } else {
    line('  未检测到代理端口，但 TUN 通路可正常工作，当前不影响开发。')
  }
  line('  → 直连通路正常，`npm run dev` 会自动选择直连。')
} else {
  line('  两条通路当前都有响应；此前的超时可能是间歇性问题，仍需结合报错时的日志判断原因。')
  line('  → 仍建议用 `npm run dev`：它每次启动都会重新择优，哪条通用哪条。')
  line('  → 如果开发中切换过节点/重连过 0dcloud，务必重启 dev server 再测。')
}
line('')
