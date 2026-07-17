import cache from 'memory-cache'
import BLOG from '@/blog.config'

const cacheTime = BLOG.isProd ? 30 * 60 : 120 * 60 // 120 minutes for dev,30 minutes for prod (reduced Notion API calls on Vercel)

/** next dev + .env NOTION_DEV_CACHE_SECONDS：缩短内存缓存，便于改 Notion 后快速看到效果 */
function getDevShortCacheSeconds() {
  if (process.env.NODE_ENV !== 'development' || BLOG.isProd) return null
  const raw = process.env.NOTION_DEV_CACHE_SECONDS
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return null
  }
  const n = parseInt(String(raw), 10)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.max(n, 1)
}

export async function getCache(key, options) {
  return await cache.get(key)
}

export async function setCache(key, data, customCacheTime) {
  if (customCacheTime != null && Number(customCacheTime) > 0) {
    await cache.put(key, data, Number(customCacheTime) * 1000)
    return
  }
  const devSec = getDevShortCacheSeconds()
  if (devSec != null) {
    await cache.put(key, data, devSec * 1000)
    return
  }
  await cache.put(key, data, (customCacheTime || cacheTime) * 1000)
}

export async function delCache(key) {
  await cache.del(key)
}

export default { getCache, setCache, delCache }
