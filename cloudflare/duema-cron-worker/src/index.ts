export interface Env {
  CRON_SECRET: string
  SITE_URL?: string
}

const DEFAULT_SITE_URL = 'https://www.duema-bbs.com'

const JOBS = {
  youtubeCheck: '/api/youtube/check',
  youtubeSubscribe: '/api/youtube/subscribe',
  summaryCron: '/api/summary/cron',
} as const

type JobName = keyof typeof JOBS

function siteUrl(env: Env) {
  return (env.SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, '')
}

async function callJob(env: Env, jobName: JobName) {
  const url = `${siteUrl(env)}${JOBS[jobName]}`
  const startedAt = Date.now()

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${env.CRON_SECRET}`,
      'user-agent': 'duema-bbs-cloudflare-cron/1.0',
    },
    cf: {
      cacheTtl: 0,
      cacheEverything: false,
    },
  })

  const text = await response.text()
  let body: unknown = text
  try {
    body = JSON.parse(text)
  } catch {
    body = text.slice(0, 1000)
  }

  return {
    jobName,
    ok: response.ok,
    status: response.status,
    durationMs: Date.now() - startedAt,
    body,
  }
}

async function runJobs(env: Env, jobNames: JobName[]) {
  const results = []
  for (const jobName of jobNames) {
    results.push(await callJob(env, jobName))
  }
  return results
}

function jobsForCron(cron: string): JobName[] {
  if (cron === '*/5 * * * *') return ['youtubeCheck']
  if (cron === '5 16 * * *') return ['summaryCron']
  if (cron === '15 0 * * *') return ['youtubeSubscribe']
  return ['youtubeCheck']
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

const handler = {
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      runJobs(env, jobsForCron(controller.cron)).then(results => {
        console.log(JSON.stringify({ cron: controller.cron, results }))
      }),
    )
  },

  async fetch(request: Request, env: Env) {
    const url = new URL(request.url)

    if (url.pathname === '/health') {
      return json({ ok: true, service: 'duema-cron-worker' })
    }

    const authHeader = request.headers.get('authorization')
    if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
      return json({ error: 'Unauthorized' }, 401)
    }

    if (url.pathname === '/run/youtube-check') {
      return json({ ok: true, results: await runJobs(env, ['youtubeCheck']) })
    }

    if (url.pathname === '/run/summary') {
      return json({ ok: true, results: await runJobs(env, ['summaryCron']) })
    }

    if (url.pathname === '/run/youtube-subscribe') {
      return json({ ok: true, results: await runJobs(env, ['youtubeSubscribe']) })
    }

    return json({ error: 'Not found' }, 404)
  },
}

export default handler
