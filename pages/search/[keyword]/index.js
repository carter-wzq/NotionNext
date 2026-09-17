import BLOG from '@/blog.config'
import { getDataFromCache, setDataToCache } from '@/lib/cache/cache_manager'
import { siteConfig } from '@/lib/config'
import { fetchGlobalAllData } from '@/lib/db/SiteDataApi'
import { isExport } from '@/lib/utils/buildMode'
import { DynamicLayout } from '@/themes/theme'
import { getPageContentText } from '@/lib/db/notion/getPageContentText'

const Index = props => {
  const theme = siteConfig('THEME', BLOG.THEME, props.NOTION_CONFIG)
  return <DynamicLayout theme={theme} layoutName='LayoutSearch' {...props} />
}

/**
 * 服务端搜索
 * @param {*} param0
 * @returns
 */
export async function getStaticProps({ params: { keyword }, locale }) {
  const props = await fetchGlobalAllData({
    from: 'search-props',
    locale
  })
  const { allPages } = props
  const allPosts = allPages?.filter(
    page => page.type === 'Post' && page.status === 'Published'
  )
  props.posts = await filterByMemCache(allPosts, keyword)
  props.postCount = props.posts.length
  const POST_LIST_STYLE = siteConfig(
    'POST_LIST_STYLE',
    'Page',
    props?.NOTION_CONFIG
  )
  const POSTS_PER_PAGE = siteConfig('POSTS_PER_PAGE', 12, props?.NOTION_CONFIG)

  // 处理分页
  if (POST_LIST_STYLE === 'scroll') {
    // 滚动列表默认给前端返回所有数据
  } else if (POST_LIST_STYLE) {
    props.posts = props.posts?.slice(0, POSTS_PER_PAGE)
  }
  props.keyword = keyword
  return {
    props,
    revalidate: process.env.EXPORT
      ? undefined
      : 3600 // 搜索页缓存1小时，减少服务端CPU消耗
  }
}

export function getStaticPaths() {
  return {
    paths: [{ params: { keyword: 'NotionNext' } }],
    fallback: isExport() ? false : true
  }
}

/**
 * 在内存缓存中进行全文索引
 * @param {*} allPosts
 * @param keyword 关键词
 * @returns
 */
async function filterByMemCache(allPosts, keyword) {
  const normalizedKeyword = keyword ? keyword.trim().toLowerCase() : ''
  if (!normalizedKeyword) return []

  // 检查搜索缓存
  const searchCacheKey = `search_${normalizedKeyword}`
  const cachedIds = await getDataFromCache(searchCacheKey, true)
  if (cachedIds && Array.isArray(cachedIds)) {
    console.log(`[搜索缓存命中] keyword: ${normalizedKeyword}, cached: ${cachedIds.length} results`)
    return allPosts.filter(p => cachedIds.includes(p.id))
  }

  const filterPosts = []
  keyword = normalizedKeyword
  for (const post of allPosts) {
    const cacheKey = 'page_block_' + post.id
    const page = await getDataFromCache(cacheKey, true)
    const tagContent =
      post?.tags && Array.isArray(post?.tags) ? post?.tags.join(' ') : ''
    const categoryContent =
      post.category && Array.isArray(post.category)
        ? post.category.join(' ')
        : ''
    const articleInfo = post.title + post.summary + tagContent + categoryContent
    let hit = articleInfo.toLowerCase().indexOf(keyword) > -1
    const contentTextList = getPageContentText(post, page)
    // console.log('全文搜索缓存', cacheKey, page != null)
    post.results = []
    let hitCount = 0
    for (const i of contentTextList) {
      const c = contentTextList[i]
      if (!c) {
        continue
      }
      const index = c.toLowerCase().indexOf(keyword)
      if (index > -1) {
        hit = true
        hitCount += 1
        post.results.push(c)
      } else {
        if ((post.results.length - 1) / hitCount < 3 || i === 0) {
          post.results.push(c)
        }
      }
    }
    if (hit) {
      filterPosts.push(post)
    }
  }

  // 缓存搜索结果（仅缓存 ID 列表，避免缓存完整的 post 对象导致数据过时）
  if (filterPosts.length > 0) {
    const idsToCache = filterPosts.map(p => p.id)
    await setDataToCache(searchCacheKey, idsToCache, 1800) // 30分钟缓存
    console.log(`[搜索缓存写入] keyword: ${normalizedKeyword}, ${idsToCache.length} results`)
  }

  return filterPosts
}

export default Index
