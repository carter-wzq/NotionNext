import BLOG from '@/blog.config'
import { getDataFromCache, setDataToCache } from '@/lib/cache/cache_manager'
import { siteConfig } from '@/lib/config'
import { fetchGlobalAllData } from '@/lib/db/SiteDataApi'
import { DynamicLayout } from '@/themes/theme'

const Index = props => {
  const { keyword } = props
  props = { ...props, currentSearch: keyword }

  const theme = siteConfig('THEME', BLOG.THEME, props.NOTION_CONFIG)
  return <DynamicLayout theme={theme} layoutName='LayoutSearch' {...props} />
}

/**
 * 服务端搜索
 * @param {*} param0
 * @returns
 */
export async function getStaticProps({ params: { keyword, page }, locale }) {
  const props = await fetchGlobalAllData({
    from: 'search-props',
    pageType: ['Post'],
    locale
  })
  const { allPages } = props
  const allPosts = allPages?.filter(
    page => page.type === 'Post' && page.status === 'Published'
  )
  props.posts = await filterByMemCache(allPosts, keyword)
  props.postCount = props.posts.length
  const POSTS_PER_PAGE = siteConfig('POSTS_PER_PAGE', 12, props?.NOTION_CONFIG)
  // 处理分页
  props.posts = props.posts.slice(
    POSTS_PER_PAGE * (page - 1),
    POSTS_PER_PAGE * page
  )
  props.keyword = keyword
  props.page = page
  delete props.allPages
  return {
    props,
    revalidate: process.env.EXPORT
      ? undefined
      : 3600 // 搜索页缓存1小时，减少服务端CPU消耗
  }
}

export function getStaticPaths() {
  return {
    paths: [{ params: { keyword: 'NotionNext', page: '1' } }],
    fallback: true
  }
}

/**
 * 将对象的指定字段拼接到字符串
 * @param sourceTextArray
 * @param targetObj
 * @param key
 * @returns {*}
 */
function appendText(sourceTextArray, targetObj, key) {
  if (!targetObj) {
    return sourceTextArray
  }
  const textArray = targetObj[key]
  const text = textArray ? getTextContent(textArray) : ''
  if (text && text !== 'Untitled') {
    return sourceTextArray.concat(text)
  }
  return sourceTextArray
}

/**
 * 递归获取层层嵌套的数组
 * @param {*} textArray
 * @returns
 */
function getTextContent(textArray) {
  if (typeof textArray === 'object' && isIterable(textArray)) {
    let result = ''
    for (const textObj of textArray) {
      result = result + getTextContent(textObj)
    }
    return result
  } else if (typeof textArray === 'string') {
    return textArray
  }
}

/**
 * 对象是否可以遍历
 * @param {*} obj
 * @returns
 */
const isIterable = obj =>
  obj != null && typeof obj[Symbol.iterator] === 'function'

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
    let hit = articleInfo.indexOf(keyword) > -1
    let indexContent = [post.summary]
    if (page && page.block) {
      const contentIds = Object.keys(page.block)
      contentIds.forEach(id => {
        const properties = page?.block[id]?.value?.properties
        indexContent = appendText(indexContent, properties, 'title')
        indexContent = appendText(indexContent, properties, 'caption')
      })
    }
    // console.log('全文搜索缓存', cacheKey, page != null)
    post.results = []
    let hitCount = 0
    for (const i of indexContent) {
      const c = indexContent[i]
      if (!c) {
        continue
      }
      const index = c.toLowerCase().indexOf(keyword.toLowerCase())
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

  // 缓存搜索结果
  if (filterPosts.length > 0) {
    const idsToCache = filterPosts.map(p => p.id)
    await setDataToCache(searchCacheKey, idsToCache, 1800)
    console.log(`[搜索缓存写入] keyword: ${normalizedKeyword}, ${idsToCache.length} results`)
  }

  return filterPosts
}

export default Index
