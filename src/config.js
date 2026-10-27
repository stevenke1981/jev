import os from 'node:os';
import path from 'node:path';

export const EFFORTS = ['minimal', 'low', 'medium', 'high', 'xhigh'];

function parseLadder(raw) {
  const ladder = raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const bad = ladder.filter((e) => !EFFORTS.includes(e));
  if (bad.length || ladder.length === 0) {
    throw new Error(`JEV_LEVELS must be a comma list of ${EFFORTS.join('/')}; got "${raw}"`);
  }
  return ladder;
}

function intEnv(env, name, fallback) {
  const v = env[name];
  if (v == null || v === '') return fallback;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${name} must be a non-negative integer; got "${v}"`);
  return n;
}

export function loadConfig(env = process.env) {
  const home = env.JEV_HOME || path.join(os.homedir(), '.jev');
  const mode = (env.JEV_MODE || 'heuristic').toLowerCase();
  if (!['heuristic', 'llm', 'off'].includes(mode)) throw new Error(`JEV_MODE must be heuristic|llm|off; got "${mode}"`);
  return Object.freeze({
    host: env.JEV_HOST || '127.0.0.1',
    port: intEnv(env, 'JEV_PORT', 8787),
    ladder: parseLadder(env.JEV_LEVELS || 'low,medium,high'),
    mode,
    // Fixed upstream; when unset the auth type picks ChatGPT backend vs API.
    upstream: env.JEV_UPSTREAM || '',
    chatgptUpstream: env.JEV_CHATGPT_UPSTREAM || 'https://chatgpt.com/backend-api/codex',
    apiUpstream: env.JEV_API_UPSTREAM || 'https://api.openai.com/v1',
    judgeModel: env.JEV_JUDGE_MODEL || '',
    judgeEffort: env.JEV_JUDGE_EFFORT || 'low',
    judgeTimeoutMs: intEnv(env, 'JEV_JUDGE_TIMEOUT_MS', 2500),
    home,
    logFile: path.join(home, 'decisions.jsonl'),
    quiet: env.JEV_QUIET === '1',
  });
}
