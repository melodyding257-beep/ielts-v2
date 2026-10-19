import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { PROJECT_ROOT } from './environment.mjs'

const python = path.join(PROJECT_ROOT, 'backend', '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')
if (!fs.existsSync(python)) {
  console.error('缺少 backend/.venv。请从项目根目录运行 python -m venv backend/.venv，并按 backend/README.md 安装依赖。')
  process.exit(1)
}

const flags = process.argv.slice(2)
const args = flags.includes('--test')
  ? ['-m', 'unittest', 'discover', '-s', 'backend', '-p', 'test_*.py', '-t', '.']
  : flags.includes('--check')
    ? ['-m', 'pip', 'check']
    : ['-m', 'uvicorn', 'backend.main:app', '--reload',
        '--reload-dir', path.join(PROJECT_ROOT, 'backend'),
        '--reload-exclude', path.join(PROJECT_ROOT, 'backend', '.venv'),
        '--port', '8000', ...flags]
const child = spawn(python, args, {
  cwd: PROJECT_ROOT,
  stdio: 'inherit',
  env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
})
child.once('error', (error) => { console.error(error.message); process.exit(1) })
child.once('exit', (code) => process.exit(code ?? 1))
