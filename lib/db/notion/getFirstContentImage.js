import pLimit from 'p-limit'
import { idToUuid } from 'notion-utils'
import { adapterNotionBlockMap } from '@/lib/utils/notion.util'
import { fetchInBatches, fetchNotionPageBlocks } from '@/lib/db/notion/getPostBlocks'
import { compressImage, mapImgUrl } from '@/lib/db/notion/mapImage'
import { normalizePageBlock } from '@/lib/db/notion/normalizeUtil'

export const LIST_THUMB_COMPRESS_WIDTH = 400
const SCAN_LIMIT = 8
const FETCH_ROUNDS = 3

function getImageSourceFromBlock(blockValue) {
  if (!blockValue || blockValue.type !== 'image') return null
  const src =
    blockValue.properties?.source?.[0]?.[0] ||
    blockValue.format?.display_source ||
    blockValue.file?.url
  if (!src || typeof src !== 'string') return null
  return mapImgUrl(src, blockValue, 'block', true)
}

function collectDescendantIds(pageId, blockMap, limit = SCAN_LIMIT) {
  const ids = []
  const seen = new Set()
  const page = normalizePageBlock(blockMap[pageId])
  const queue = [...(page?.content || [])]
  while (queue.length && ids.length < limit) {
    const id = queue.shift()
    if (!id || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
    const value = normalizePageBlock(blockMap[id])
    if (value?.content?.length) {
      for (const child of value.content) {
        if (child && !seen.has(child)) queue.push(child)
      }
    }
  }
  return ids
}

export function findFirstContentImage(
  pageId,
  blockMap,
  compressWidth = LIST_THUMB_COMPRESS_WIDTH
) {
  if (!pageId || !blockMap) return ''
  const rootId = pageId.includes('-') ? pageId : idToUuid(pageId)
  const visited = new Set()
  const walk = id => {
    if (!id || visited.has(id)) return null
    visited.add(id)
    const value = normalizePageBlock(blockMap[id] || blockMap[idToUuid(id)])
    if (!value) return null
    if (id !== rootId && id !== pageId) {
      const src = getImageSourceFromBlock(value)
      if (src) return src
    }
    for (const childId of value.content || []) {
      const found = walk(childId)
      if (found) return found
    }
    return null
  }
  const url = walk(rootId) || walk(pageId)
  return url ? compressImage(url, compressWidth) : ''
}

export async function hydrateFirstContentImages(collectionData, blockMap) {
  const posts = (collectionData || []).filter(
    p => p?.type === 'Post' && p?.status === 'Published'
  )
  if (!posts.length || !blockMap) return blockMap

  let nextMap = blockMap
  for (let round = 0; round < FETCH_ROUNDS; round++) {
    const missing = []
    for (const post of posts) {
      if (!post?.id) continue
      for (const id of collectDescendantIds(post.id, nextMap)) {
        if (!normalizePageBlock(nextMap[id])) missing.push(id)
      }
    }
    const unique = [...new Set(missing)]
    if (!unique.length) break
    const fetched = await fetchInBatches(unique)
    const adapted = adapterNotionBlockMap({ block: fetched }).block
    nextMap = { ...nextMap, ...adapted }
  }

  for (const post of posts) {
    const found = findFirstContentImage(
      post.id,
      nextMap,
      LIST_THUMB_COMPRESS_WIDTH
    )
    if (found) post.firstContentImage = found
    delete post.contentScanIds
  }
  return nextMap
}

export async function ensureFirstContentImages(allPages) {
  if (!Array.isArray(allPages)) return
  const need = allPages
    .filter(
      p =>
        p?.type === 'Post' &&
        p?.status === 'Published' &&
        !p.firstContentImage
    )
    .slice(0, 12)
  if (!need.length) return

  const limit = pLimit(6)
  await Promise.all(
    need.map(post =>
      limit(async () => {
        try {
          const raw = await fetchNotionPageBlocks(post.id, 'list-thumb')
          if (!raw?.block) {
            post.firstContentImage = ''
            return
          }
          const adapted = adapterNotionBlockMap(raw)
          post.firstContentImage =
            findFirstContentImage(
              post.id,
              adapted.block,
              LIST_THUMB_COMPRESS_WIDTH
            ) || ''
        } catch (e) {
          console.warn('[list-thumb] failed', post?.id, e)
          post.firstContentImage = ''
        }
      })
    )
  )
}
