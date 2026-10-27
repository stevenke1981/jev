// Per-session effort routing: trajectory -> assessment (heuristic or judge) -> hysteresis.
import { parseTurn } from './trajectory.js';
import { assess, nextState } from './policy.js';
import { judge } from './judge.js';

const MAX_SESSIONS = 500;

export function createRouter(config, { judgeFn = judge } = {}) {
  const sessions = new Map();

  function remember(key, state) {
    sessions.delete(key);
    sessions.set(key, state);
    if (sessions.size > MAX_SESSIONS) sessions.delete(sessions.keys().next().value);
  }

  /**
   * @param {object} body Responses API request body
   * @param {string} sessionKey
   * @param {{url:string, headers:Record<string,string>}|null} judgeTarget
   * @returns {Promise<{effort:string, from:string|null, step:number, hold:number, reasons:string[], source:string, ms:number}>}
   */
  async function route(body, sessionKey, judgeTarget) {
    const started = performance.now();
    const turn = parseTurn(body.input);
    const step = turn.steps.length + 1;
    const ladder = config.ladder;
    let a = assess(turn, ladder);
    let source = 'heuristic';

    if (config.mode === 'llm' && judgeTarget && step > 1) {
      try {
        a = await judgeFn(turn, {
          ...judgeTarget,
          model: config.judgeModel || body.model,
          effort: config.judgeEffort,
          timeoutMs: config.judgeTimeoutMs,
          ladder,
        });
        source = 'judge';
      } catch (err) {
        source = `heuristic (judge failed: ${err.message})`;
      }
    }

    const state = nextState(sessions.get(sessionKey), a, step);
    remember(sessionKey, state);
    return {
      effort: ladder[state.level],
      from: state.from == null ? null : ladder[state.from],
      step,
      hold: state.hold,
      reasons: state.reasons,
      source,
      ms: Math.round(performance.now() - started),
    };
  }

  return { route, sessions };
}
