import BLOG from '@/blog.config'
import notionAPI from '@/lib/db/notion/getNotionAPI'

/**
 * 临时诊断：检查 Vercel 上能否拉到 Notion。
 * GET /api/notion-health?key=<NOTION_PAGE_ID 后 6 位>
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' })
  }

  const pageId = String(BLOG.NOTION_PAGE_ID || '').split(',')[0].replace(/^.*:/, '')
  const expectedKey = pageId.slice(-6)
  const key = String(req.query?.key || '')
  if (!expectedKey || key !== expectedKey) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' })
  }

  const apiBaseUrl = BLOG.API_BASE_URL
  const result = {
    ok: false,
    apiBaseUrl,
    pageId,
    node: process.version,
    vercelEnv: process.env.VERCEL_ENV || null,
    steps: {}
  }

  // 1) 原始 loadPageChunk
  try {
    const start = Date.now()
    const resp = await fetch(`${apiBaseUrl}/loadPageChunk`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        pageId: pageId.replace(
          /^(.{8})(.{4})(.{4})(.{4})(.{12})$/,
          '$1-$2-$3-$4-$5'
        ),
        limit: 10,
        cursor: { stack: [] },
        chunkNumber: 0,
        verticalColumns: false
      })
    })
    const text = await resp.text()
    result.steps.loadPageChunk = {
      status: resp.status,
      ms: Date.now() - start,
      bodyPreview: text.slice(0, 180)
    }
  } catch (e) {
    result.steps.loadPageChunk = {
      error: String(e?.message || e)
    }
  }

  // 2) notion-client getPage
  try {
    const start = Date.now()
    const page = await notionAPI.getPage(pageId)
    result.steps.getPage = {
      ms: Date.now() - start,
      blockCount: Object.keys(page?.block || {}).length,
      collectionCount: Object.keys(page?.collection || {}).length
    }
    result.ok = (result.steps.getPage.blockCount || 0) > 0
  } catch (e) {
    result.steps.getPage = {
      error: String(e?.message || e)
    }
  }

  return res.status(result.ok ? 200 : 502).json(result)
}
