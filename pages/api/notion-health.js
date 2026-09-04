import BLOG from '@/blog.config'
import notionAPI from '@/lib/db/notion/getNotionAPI'
import { fetchGlobalAllData, getPostBlocks } from '@/lib/db/SiteDataApi'
import { adapterNotionBlockMap } from '@/lib/utils/notion.util'
import { normalizeNotionMetadata } from '@/lib/db/notion/normalizeUtil'
import { delCacheByPrefix, delCacheData } from '@/lib/cache/cache_manager'
import { idToUuid } from 'notion-utils'

/**
 * 临时诊断：检查 Vercel 上能否拉到 Notion，以及站点数据转换是否成功。
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
    enableCache: BLOG.ENABLE_CACHE,
    redisConfigured: Boolean(BLOG.REDIS_URL),
    node: process.version,
    vercelEnv: process.env.VERCEL_ENV || null,
    steps: {}
  }

  // 清 Redis：站点索引 + 全部文章 block（旧缓存没有缩略图/新内链）
  if (String(req.query?.flush || '') === '1') {
    const keys = [`site_${pageId}`, `page_block_${pageId}`]
    for (const cacheKey of keys) {
      try {
        await delCacheData(cacheKey)
        result.steps[`flush_${cacheKey}`] = 'deleted'
      } catch (e) {
        result.steps[`flush_${cacheKey}`] = String(e?.message || e)
      }
    }
    try {
      result.steps.flush_site_prefix = await delCacheByPrefix('site_')
      result.steps.flush_page_block_prefix = await delCacheByPrefix(
        'page_block_'
      )
    } catch (e) {
      result.steps.flush_prefix = String(e?.message || e)
    }
    const revalidatePaths = [
      '/',
      '/archive',
      '/article/what-is-social-listening',
      '/article/reddit-marketing-for-saas',
      '/article/8-best-brand24-alternatives-in-2026',
      '/article/how-to-find-subreddits-for-saas'
    ]
    result.steps.revalidate = {}
    for (const path of revalidatePaths) {
      try {
        await res.revalidate(path)
        result.steps.revalidate[path] = 'ok'
      } catch (e) {
        result.steps.revalidate[path] = String(e?.message || e)
      }
    }
  }

  // 1) notion-client getPage
  try {
    const start = Date.now()
    const page = await notionAPI.getPage(pageId)
    const uuid = idToUuid(pageId)
    const adapted = adapterNotionBlockMap({ block: page?.block || {} }).block
    const meta = normalizeNotionMetadata(adapted, uuid)
    result.steps.getPage = {
      ms: Date.now() - start,
      blockCount: Object.keys(page?.block || {}).length,
      collectionCount: Object.keys(page?.collection || {}).length,
      metaType: meta?.type || null,
      hasMeta: Boolean(meta)
    }
  } catch (e) {
    result.steps.getPage = {
      error: String(e?.message || e)
    }
  }

  // 2) fetchNotionPageBlocks（含缓存层）
  try {
    const start = Date.now()
    const pageBlock = await getPostBlocks(pageId, 'notion-health')
    result.steps.fetchNotionPageBlocks = {
      ms: Date.now() - start,
      ok: Boolean(pageBlock),
      blockCount: Object.keys(pageBlock?.block || {}).length
    }
  } catch (e) {
    result.steps.fetchNotionPageBlocks = {
      error: String(e?.message || e)
    }
  }

  // 3) 完整站点数据管道
  try {
    const start = Date.now()
    const siteData = await fetchGlobalAllData({
      pageId,
      from: 'notion-health'
    })
    const first = siteData?.allPages?.[0]
    result.steps.fetchGlobalAllData = {
      ms: Date.now() - start,
      emptyFlag: Boolean(siteData?.__notionEmpty),
      pageCount: siteData?.allPages?.length || 0,
      firstSlug: first?.slug || null,
      firstTitle: String(first?.title || '').slice(0, 80),
      siteName: siteData?.siteInfo?.title || null
    }
    result.ok =
      !siteData?.__notionEmpty &&
      first?.slug &&
      first.slug !== 'oops'
  } catch (e) {
    result.steps.fetchGlobalAllData = {
      error: String(e?.message || e),
      stack: String(e?.stack || '').split('\n').slice(0, 6)
    }
  }

  return res.status(result.ok ? 200 : 502).json(result)
}
