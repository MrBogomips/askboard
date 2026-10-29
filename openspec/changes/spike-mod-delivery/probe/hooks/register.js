// Probe mod: logs identifiers and turns, polls the stub's local API, pushes answers to the ask's owner.
// Spike code. Helpers that take `$` live at module scope, as `claude plugin validate` requires.

const FINISHED = new Set(['completed', 'failed', 'killed'])

let config = { runDir: undefined, pollMs: 1000, transport: 'tcp', envKey: undefined, mainVia: 'submit', pushVia: 'send' }
let lastSeq = 0
let isPolling = false
let matchedBy = undefined
let skipped = new Set()
let buffered = []
let currentSession = undefined
let claudePid = undefined
// Main conversation, PROBE_MAIN_VIA=hybrid: append while a turn runs, submit when idle.
let isMainBusy = false
let lastMainStepAt = 0
let appendedThisTurn = []

async function now($) {
  return await $.clock.now()
}

async function log($, entry) {
  const line = { source: 'mod', t: await now($), ...entry }
  if (!currentSession) {
    buffered = [...buffered, line]
    return
  }
  const pending = [...buffered, line]
  buffered = []
  for (const item of pending) {
    try {
      await request($, currentSession, 'POST', '/log', item)
    } catch (error) {
      buffered = [...buffered, item]
      $.ui.log(`probe: log failed: ${String(error?.message ?? error)}`, { to: 'debug' })
      return
    }
  }
}

async function request($, session, method, path, body) {
  const headers = { 'x-probe-token': session.sessionToken, 'content-type': 'application/json' }
  const init = { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }
  const response =
    config.transport === 'unix'
      ? await $.http.fetch(`http://probe${path}`, { ...init, socketPath: session.socketPath })
      : await $.http.fetch(`${session.apiAddress}${path}`, init)
  if (!response.ok) throw new Error(`${method} ${path}: HTTP ${response.status}`)
  return JSON.parse(response.text)
}

async function eventsViaProcess($, session) {
  const argv = ['bun', `${$.plugin.root}/driver.ts`, 'events', '--key', session.key, '--after', String(lastSeq)]
  const ran = await $.process.run(argv, { env: { PROBE_RUN_DIR: config.runDir } })
  if (ran.exitCode !== 0) throw new Error(`driver events exited ${ran.exitCode}: ${ran.stderr}`)
  return JSON.parse(ran.stdout)
}

// A push counts once made: a failed report must never cause the same event to be pushed again (findings O7).
async function report($, session, body) {
  try {
    if (config.transport === 'process') {
      const argv = ['bun', `${$.plugin.root}/driver.ts`, 'delivered', '--key', session.key, '--body', JSON.stringify(body)]
      const ran = await $.process.run(argv, { env: { PROBE_RUN_DIR: config.runDir } })
      if (ran.exitCode !== 0) throw new Error(`driver delivered exited ${ran.exitCode}: ${ran.stderr}`)
      return
    }
    await request($, session, 'POST', '/delivered', body)
  } catch (error) {
    $.ui.log(`probe: delivery report failed for seq ${body.seq}: ${String(error?.message ?? error)}`, { to: 'debug' })
  }
}

async function findSession($) {
  const sessionId = await $.session.id()
  const dir = `${config.runDir}/sessions`
  if (!(await $.fs.exists(dir))) return undefined
  const entries = await $.fs.list(dir)
  const files = []
  for (const entry of entries.filter(e => e.name.endsWith('.json'))) {
    files.push(JSON.parse(await $.fs.read(`${dir}/${entry.name}`)))
  }
  const bySessionId = files.filter(f => f.key === sessionId)
  const byEnv = files.filter(f => f.key === config.envKey)
  const byPid = files.filter(f => String(f.ppid) === claudePid)
  const rule = bySessionId.length === 1 ? 'session.id' : byEnv.length === 1 ? 'env' : byPid.length === 1 ? 'claude-pid' : 'none'
  const found = rule === 'session.id' ? bySessionId[0] : rule === 'env' ? byEnv[0] : rule === 'claude-pid' ? byPid[0] : undefined
  if (rule !== matchedBy || found?.pid !== currentSession?.pid) {
    matchedBy = rule
    currentSession = found
    await log($, { kind: 'session-match', rule, sessionId, envKey: config.envKey ?? null, files: files.length, filePid: found?.pid ?? null })
  }
  return found
}

// Appends the answer as a user row to the owner's conversation: no SendMessage, so no auto-mode classifier.
async function deliverByAppend($, session, event, text, t1) {
  const t2 = await now($)
  const args = { message: { type: 'user', content: [{ type: 'text', text }] }, ...(event.owner === null ? {} : { agentId: event.owner }) }
  try {
    const stored = await $.session.append(args)
    await report($, session, { seq: event.seq, via: 'session.append', agentId: event.owner, result: { isDelivered: true, uuid: stored?.uuid ?? null }, t1, t2 })
    return true
  } catch (error) {
    await report($, session, { seq: event.seq, via: 'session.append', agentId: event.owner, result: { isDelivered: false, reason: String(error?.message ?? error) }, t1, t2 })
    return false
  }
}

async function deliver($, session, event, t1) {
  const text = `AskBoard probe answer ${event.nonce} for ask ${event.askId} (seq ${event.seq}): ${event.text}`
  if (event.owner === null && config.mainVia === 'hybrid' && isMainBusy) {
    const isDelivered = await deliverByAppend($, session, event, text, t1)
    if (isDelivered) appendedThisTurn = [...appendedThisTurn, { seq: event.seq, nonce: event.nonce, text, t: await now($) }]
    return isDelivered
  }
  if (config.pushVia === 'append' && event.owner !== null && (await isRunning($, event))) return deliverByAppend($, session, event, text, t1)
  if (config.pushVia === 'append' && event.owner === null && config.mainVia !== 'hybrid') return deliverByAppend($, session, event, text, t1)
  if (event.owner === null && config.mainVia === 'send') {
    const sessionId = await $.session.id()
    const t2 = await now($)
    const result = await $.session.send({ to: { sessionId }, text })
    await report($, session, { seq: event.seq, via: 'session.send-self', agentId: null, result, t1, t2 })
    return result.isDelivered === true
  }
  if (event.owner === null) {
    const draft = await $.prompt.read()
    const t2 = await now($)
    $.prompt.submit({ text }).then(
      async result => log($, { kind: 'submit-started', seq: event.seq, nonce: event.nonce, drop: result?.drop ?? null }),
      async error => log($, { kind: 'submit-error', seq: event.seq, message: String(error?.message ?? error) }),
    )
    await report($, session, { seq: event.seq, via: 'prompt.submit', agentId: null, result: { draftLength: draft.text.length }, t1, t2 })
    return true
  }
  if (!(await isRunning($, event))) return false
  const t2 = await now($)
  const result = await $.session.send({ to: { agentId: event.owner }, text })
  await report($, session, { seq: event.seq, via: 'session.send', agentId: event.owner, result, t1, t2 })
  return result.isDelivered === true
}

async function isRunning($, event) {
  const agents = await $.agent.list()
  const agent = agents.find(a => a.id === event.owner)
  if (!agent || FINISHED.has(agent.status)) {
    if (!skipped.has(event.seq)) {
      skipped = new Set([...skipped, event.seq])
      await log($, { kind: 'skip-finished', seq: event.seq, owner: event.owner, status: agent?.status ?? 'absent', agents: agents.map(a => ({ id: a.id, type: a.type, status: a.status })) })
    }
    return false
  }
  return true
}

async function poll($) {
  if (isPolling) return
  isPolling = true
  try {
    const session = await findSession($)
    if (!session) return
    const t1 = await now($)
    const body = config.transport === 'process' ? await eventsViaProcess($, session) : await request($, session, 'GET', `/events?after=${lastSeq}`)
    for (const event of body.events) {
      const isDelivered = await deliver($, session, event, t1)
      if (isDelivered) lastSeq = Math.max(lastSeq, event.seq)
    }
  } catch (error) {
    await log($, { kind: 'poll-error', transport: config.transport, message: String(error?.message ?? error) })
  } finally {
    isPolling = false
  }
}

export function register(on) {
  on('session.start', async ($, e, next) => {
    const runDir = await $.env.get('PROBE_RUN_DIR')
    const pollMs = Number((await $.env.get('PROBE_POLL_MS')) ?? '1000')
    const transport = (await $.env.get('PROBE_TRANSPORT')) ?? 'tcp'
    const envKey = await $.env.get('CLAUDE_CODE_SESSION_ID')
    const mainVia = (await $.env.get('PROBE_MAIN_VIA')) ?? 'submit'
    const pushVia = (await $.env.get('PROBE_PUSH_VIA')) ?? 'send'
    config = { runDir, pollMs, transport, envKey, mainVia, pushVia }
    const version = await $.session.version()
    // Criterion 13: the Claude Code process's PID, as a session key that survives --continue and /clear.
    const pidRun = await $.process.run(['sh', '-c', 'echo $PPID']).catch(error => ({ stdout: `error: ${String(error?.message ?? error)}` }))
    claudePid = pidRun.stdout.trim()
    await log($, { kind: 'session.start', sessionId: await $.session.id(), envKey: envKey ?? null, claudePid, version, cwd: e.cwd, isInteractive: e.isInteractive, pollMs, transport, mainVia, pushVia })
    if (!runDir) {
      $.ui.log('probe: PROBE_RUN_DIR is not set; the mod does nothing', { to: 'debug' })
      return next(e)
    }
    $.clock.every(pollMs, () => poll($))
    return next(e)
  })

  // Criterion 1 under auto mode: approve only this mod's own pushes, never the model's SendMessage calls.
  on('tool.check', { tool: 'SendMessage' }, async ($, e, next) => {
    if (next.origin.plugin !== $.plugin.name || (await $.env.get('PROBE_SELF_ALLOW')) !== '1') return next(e)
    return { decision: 'allow', reason: 'probe: the mod delivers an answer to the agent that owns the ask' }
  }).catch(($, e, next) => next(e))

  on('session.end', async ($, e, next) => {
    await log($, { kind: 'session.end', reason: e.reason, sessionId: await $.session.id() })
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (String(e.tool).includes('probe_')) await log($, { kind: 'tool.call', tool: e.tool, agentId: e.agentId ?? null, fields: Object.keys(e) })
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      isMainBusy = true
      appendedThisTurn = []
    }
    await log($, { kind: 'turn.start', agentId: e.agentId ?? null })
    return next(e)
  })

  // Rows appended before this hook fires go into this request; later ones wait for the next request.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined) lastMainStepAt = await now($)
    return yield* next(e)
  })

  on('turn.complete', async ($, e, next) => {
    await log($, { kind: 'turn.complete', agentId: e.agentId ?? null })
    if (e.agentId !== undefined) return next(e)
    isMainBusy = false
    // An answer appended after the last request was sent was never read: wake the conversation with it.
    const unread = appendedThisTurn.filter(a => a.t >= lastMainStepAt)
    appendedThisTurn = []
    for (const a of unread) {
      await log($, { kind: 'catch-up-submit', seq: a.seq, nonce: a.nonce })
      $.prompt.submit({ text: a.text }).catch(async error => log($, { kind: 'submit-error', seq: a.seq, message: String(error?.message ?? error) }))
    }
    return next(e)
  })
}
