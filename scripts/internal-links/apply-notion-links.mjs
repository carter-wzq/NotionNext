/**
 * Contextual internal links for SignalMelo blog posts (Notion official API).
 *
 *   node scripts/internal-links/apply-notion-links.mjs           # dry-run
 *   node scripts/internal-links/apply-notion-links.mjs --write   # patch Notion
 *
 * Reads NOTION_API_KEY from .env.local. Does not print the secret.
 */
import fs from 'fs'
import {
  PHRASE_CATALOG,
  hrefFor,
  MAX_ARTICLE_LINKS,
  MAX_PRODUCT_LINKS,
  LINKABLE_BLOCK_TYPES
} from './link-map.mjs'

const WRITE = process.argv.includes('--write')
const DB_ID = '94a9b5e0-2328-839c-ab91-01f71f0ee990'
const sleep = ms => new Promise(r => setTimeout(r, ms))

function loadKey() {
  const env = fs.readFileSync('.env.local', 'utf8')
  const key = env.match(/^NOTION_API_KEY=(.+)$/m)?.[1]?.trim()
  if (!key) {
    console.error('Missing NOTION_API_KEY in .env.local')
    process.exit(1)
  }
  return key
}

const headers = {
  Authorization: 'Bearer ' + loadKey(),
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json'
}

async function notion(method, path, body) {
  const res = await fetch('https://api.notion.com/v1' + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })
  const json = await res.json()
  if (!res.ok) {
    const err = new Error(`${res.status} ${json.code || ''} ${json.message || ''}`)
    err.status = res.status
    err.body = json
    throw err
  }
  return json
}

function plainProp(rt) {
  if (!rt) return ''
  if (Array.isArray(rt)) return rt.map(t => t.plain_text || '').join('')
  if (rt.title) return plainProp(rt.title)
  if (rt.rich_text) return plainProp(rt.rich_text)
  if (rt.select) return rt.select.name || ''
  if (rt.status) return rt.status.name || ''
  return ''
}

function getProp(props, ...ks) {
  for (const k of ks) {
    if (props[k]) return plainProp(props[k])
  }
  return ''
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function findPhraseIndex(plain, phrase, caseSensitive = false) {
  const flags = caseSensitive ? '' : 'i'
  const re = new RegExp(`(?<![A-Za-z0-9])${escapeRe(phrase)}(?![A-Za-z0-9])`, flags)
  const m = re.exec(plain)
  return m ? { index: m.index, length: m[0].length, matched: m[0] } : null
}

function rangeOverlaps(richText, start, end, pred) {
  let pos = 0
  for (const t of richText) {
    const text = t.plain_text || t.text?.content || ''
    const from = pos
    const to = pos + text.length
    if (from < end && to > start && pred(t)) return true
    pos = to
  }
  return false
}

function rangeHasLink(richText, start, end) {
  return rangeOverlaps(richText, start, end, t => !!(t.href || t.text?.link))
}

function rangeHasNonText(richText, start, end) {
  return rangeOverlaps(richText, start, end, t => t.type && t.type !== 'text')
}

function cloneAnnotations(item) {
  return item.annotations
    ? {
        bold: !!item.annotations.bold,
        italic: !!item.annotations.italic,
        strikethrough: !!item.annotations.strikethrough,
        underline: !!item.annotations.underline,
        code: !!item.annotations.code,
        color: item.annotations.color || 'default'
      }
    : {
        bold: false,
        italic: false,
        strikethrough: false,
        underline: false,
        code: false,
        color: 'default'
      }
}

function cloneTextItem(item, content, link) {
  return {
    type: 'text',
    text: {
      content,
      link: link ? { url: link } : null
    },
    annotations: cloneAnnotations(item)
  }
}

function passthroughItem(item) {
  if (item.type === 'mention' && item.mention) {
    return {
      type: 'mention',
      mention: item.mention,
      annotations: cloneAnnotations(item)
    }
  }
  if (item.type === 'equation' && item.equation) {
    return {
      type: 'equation',
      equation: item.equation,
      annotations: cloneAnnotations(item)
    }
  }
  const content = item.plain_text || item.text?.content || ''
  const existingLink = item.text?.link?.url || item.href || null
  return cloneTextItem(item, content, existingLink)
}

function applyLink(richText, start, length, url) {
  const end = start + length
  const next = []
  let pos = 0
  for (const t of richText) {
    const content = t.plain_text || t.text?.content || ''
    const from = pos
    const to = pos + content.length
    const isPlainText = !t.type || t.type === 'text'

    if (!isPlainText) {
      next.push(passthroughItem(t))
      pos = to
      continue
    }

    const existingLink = t.text?.link?.url || t.href || null
    if (to <= start || from >= end) {
      if (content) next.push(cloneTextItem(t, content, existingLink))
    } else {
      const localStart = Math.max(0, start - from)
      const localEnd = Math.min(content.length, end - from)
      if (localStart > 0) {
        next.push(cloneTextItem(t, content.slice(0, localStart), existingLink))
      }
      const mid = content.slice(localStart, localEnd)
      if (mid) next.push(cloneTextItem(t, mid, url))
      if (localEnd < content.length) {
        next.push(cloneTextItem(t, content.slice(localEnd), existingLink))
      }
    }
    pos = to
  }
  return next.filter(t => {
    if (t.type === 'mention' || t.type === 'equation') return true
    return (t.text?.content || '').length > 0
  })
}

async function listChildren(blockId) {
  const blocks = []
  let cursor
  do {
    const q = cursor ? `?page_size=100&start_cursor=${cursor}` : '?page_size=100'
    const json = await notion('GET', `/blocks/${blockId}/children${q}`)
    blocks.push(...json.results)
    cursor = json.has_more ? json.next_cursor : undefined
  } while (cursor)
  return blocks
}

async function walkBlocks(rootId) {
  const out = []
  async function walk(id) {
    const blocks = await listChildren(id)
    for (const b of blocks) {
      out.push(b)
      if (b.has_children && b.type !== 'child_page' && b.type !== 'child_database') {
        await walk(b.id)
      }
    }
  }
  await walk(rootId)
  return out
}

async function listPublishedPosts() {
  const posts = []
  let cursor
  do {
    const json = await notion('POST', `/databases/${DB_ID}/query`, {
      page_size: 100,
      start_cursor: cursor
    })
    for (const p of json.results) {
      const props = p.properties || {}
      const row = {
        id: p.id,
        title: getProp(props, 'title'),
        slug: getProp(props, 'slug'),
        type: getProp(props, 'type'),
        status: getProp(props, 'status')
      }
      if (/post/i.test(row.type) && /publish/i.test(row.status) && row.slug) {
        posts.push(row)
      }
    }
    cursor = json.has_more ? json.next_cursor : undefined
  } while (cursor)
  return posts
}

function pickLinksForPage(slug, blocks) {
  const articleUsed = new Set()
  const productUsed = new Set()
  const plans = []

  const candidates = PHRASE_CATALOG.filter(entry => {
    if (entry.slug && entry.slug === slug) return false
    return true
  })

  for (const block of blocks) {
    if (!LINKABLE_BLOCK_TYPES.has(block.type)) continue
    const data = block[block.type]
    const richText = data?.rich_text
    if (!Array.isArray(richText) || !richText.length) continue

    const plain = richText.map(t => t.plain_text || '').join('')
    if (!plain.trim()) continue

    for (const entry of candidates) {
      const url = hrefFor(entry)
      const isProduct = !!entry.product || (entry.url && entry.url.startsWith('https://www.signalmelo.com'))
      if (isProduct) {
        if (productUsed.size >= MAX_PRODUCT_LINKS) continue
        if (productUsed.has(url)) continue
      } else {
        if (articleUsed.size >= MAX_ARTICLE_LINKS) continue
        if (articleUsed.has(url)) continue
      }

      const hit = findPhraseIndex(plain, entry.phrase, !!entry.caseSensitive)
      if (!hit) continue
      if (rangeHasLink(richText, hit.index, hit.index + hit.length)) continue
      if (rangeHasNonText(richText, hit.index, hit.index + hit.length)) continue

      const alreadyPlanned = plans.some(
        p => p.blockId === block.id && p.start === hit.index
      )
      if (alreadyPlanned) continue

      const overlaps = plans.some(
        p =>
          p.blockId === block.id &&
          p.start < hit.index + hit.length &&
          p.start + p.length > hit.index
      )
      if (overlaps) continue

      plans.push({
        blockId: block.id,
        type: block.type,
        phrase: entry.phrase,
        matched: hit.matched,
        url,
        isProduct,
        start: hit.index,
        length: hit.length,
        snippet: plain.slice(Math.max(0, hit.index - 40), hit.index + hit.length + 40).replace(/\s+/g, ' ')
      })
      if (isProduct) productUsed.add(url)
      else articleUsed.add(url)
    }
  }

  return plans
}

async function patchBlock(block, planGroup) {
  const data = block[block.type]
  let richText = data.rich_text
  const sorted = [...planGroup].sort((a, b) => b.start - a.start)
  for (const plan of sorted) {
    richText = applyLink(richText, plan.start, plan.length, plan.url)
  }
  await notion('PATCH', `/blocks/${block.id}`, {
    [block.type]: { rich_text: richText }
  })
}

async function main() {
  console.log(WRITE ? 'MODE write' : 'MODE dry-run')
  try {
    await notion('GET', `/databases/${DB_ID}`)
    console.log('probe: database OK')
  } catch (e) {
    console.error('probe failed:', e.message)
    console.error(
      'Open the Notion database page → ... → Connections → connect the "blog" integration, then retry.'
    )
    process.exit(1)
  }

  const posts = await listPublishedPosts()
  console.log('published posts:', posts.length)

  const summary = []
  let patched = 0

  for (const post of posts) {
    await sleep(250)
    const blocks = await walkBlocks(post.id)
    const plans = pickLinksForPage(post.slug, blocks)
    summary.push({ slug: post.slug, title: post.title, count: plans.length, plans })

    console.log(`\n== ${post.slug} (${plans.length})`)
    for (const p of plans) {
      console.log(`  [${p.isProduct ? 'product' : 'article'}] "${p.matched}" -> ${p.url}`)
      console.log(`     …${p.snippet}…`)
    }

    if (!WRITE || !plans.length) continue

    const byBlock = new Map()
    for (const p of plans) {
      if (!byBlock.has(p.blockId)) byBlock.set(p.blockId, [])
      byBlock.get(p.blockId).push(p)
    }
    const blockMap = Object.fromEntries(blocks.map(b => [b.id, b]))
    for (const [blockId, group] of byBlock) {
      await sleep(350)
      try {
        await patchBlock(blockMap[blockId], group)
        patched++
      } catch (e) {
        console.error(`  PATCH fail ${post.slug} ${blockId}: ${e.message}`)
      }
    }
  }

  const totalLinks = summary.reduce((n, s) => n + s.count, 0)
  console.log('\n----')
  console.log('pages', summary.length, 'links planned', totalLinks, WRITE ? `blocks patched ${patched}` : '(dry-run, nothing written)')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
