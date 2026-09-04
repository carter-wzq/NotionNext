/**
 * Contextual internal links for SignalMelo blog posts (Notion official API).
 *
 *   node scripts/internal-links/apply-notion-links.mjs           # dry-run
 *   node scripts/internal-links/apply-notion-links.mjs --write   # patch Notion
 *   node scripts/internal-links/apply-notion-links.mjs --audit   # leftover /product + duplicate internals
 *
 * Reads NOTION_API_KEY from .env.local. Does not print the secret.
 */
import fs from 'fs'
import {
  PHRASE_CATALOG,
  hrefFor,
  MAX_ARTICLE_LINKS,
  MAX_PRODUCT_LINKS,
  LINKABLE_BLOCK_TYPES,
  SITE
} from './link-map.mjs'

const WRITE = process.argv.includes('--write')
const AUDIT = process.argv.includes('--audit')
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

function homeUrl() {
  return SITE.replace(/\/$/, '')
}

function isProductPageUrl(url) {
  if (!url || typeof url !== 'string') return false
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    if (host !== 'signalmelo.com') return false
    return u.pathname.replace(/\/$/, '') === '/product'
  } catch {
    return false
  }
}

function canonicalInternalUrl(url, currentSlug) {
  if (!url || typeof url !== 'string') return null
  try {
    const u = new URL(url, 'https://blog.signalmelo.com')
    const host = u.hostname.replace(/^www\./, '')
    let path = u.pathname.replace(/\/$/, '') || '/'
    if (host === 'signalmelo.com' && path === '/product') path = '/'
    if (host === 'blog.signalmelo.com') {
      const slug = path.replace(/^\/article\/?/, '')
      if (!slug || slug === currentSlug) return null
      return 'https://blog.signalmelo.com/article/' + slug
    }
    if (host === 'signalmelo.com') {
      if (path === '/') return homeUrl()
      return 'https://www.signalmelo.com' + path
    }
    return null
  } catch {
    return null
  }
}

function collectExistingTargets(blocks, currentSlug) {
  const seen = new Set()
  for (const block of blocks) {
    if (!LINKABLE_BLOCK_TYPES.has(block.type)) continue
    const richText = block[block.type]?.rich_text
    if (!Array.isArray(richText)) continue
    for (const t of richText) {
      const href = t.text?.link?.url || t.href || null
      const mapped = isProductPageUrl(href) ? homeUrl() : href
      const key = canonicalInternalUrl(mapped, currentSlug)
      if (key) seen.add(key)
    }
  }
  return seen
}

function rewriteAndDedupe(richText, seen, currentSlug) {
  if (!Array.isArray(richText)) return { next: richText, changed: 0 }
  let changed = 0
  const next = []
  for (const t of richText) {
    if (t.type && t.type !== 'text') {
      next.push(passthroughItem(t))
      continue
    }
    const content = t.plain_text || t.text?.content || ''
    let href = t.text?.link?.url || t.href || null
    if (isProductPageUrl(href)) {
      href = homeUrl()
      changed++
    }
    const key = canonicalInternalUrl(href, currentSlug)
    if (key) {
      if (seen.has(key)) {
        href = null
        changed++
      } else {
        seen.add(key)
      }
    }
    next.push(cloneTextItem(t, content, href))
  }
  return {
    next: next.filter(t => {
      if (t.type === 'mention' || t.type === 'equation') return true
      return (t.text?.content || '').length > 0
    }),
    changed
  }
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
  const existing = collectExistingTargets(blocks, slug)
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
      const key = canonicalInternalUrl(url, slug) || url
      if (existing.has(key) || articleUsed.has(key) || productUsed.has(key)) continue

      const isProduct = !!entry.product || (entry.url && /signalmelo\.com/.test(entry.url) && !/blog\.signalmelo\.com/.test(entry.url))
      if (isProduct) {
        if (productUsed.size >= MAX_PRODUCT_LINKS) continue
      } else {
        if (articleUsed.size >= MAX_ARTICLE_LINKS) continue
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
      if (isProduct) productUsed.add(key)
      else articleUsed.add(key)
    }
  }

  return plans
}

function collectHrefItems(block) {
  const items = []
  const data = block[block.type]
  if (!data) return items
  const pushRich = (rt, field) => {
    if (!Array.isArray(rt)) return
    for (const t of rt) {
      const href = t.text?.link?.url || t.href || null
      if (!href) continue
      items.push({
        href,
        text: (t.plain_text || t.text?.content || '').slice(0, 60),
        type: block.type,
        field
      })
    }
  }
  pushRich(data.rich_text, 'rich_text')
  pushRich(data.title, 'title')
  pushRich(data.caption, 'caption')
  if (typeof data.url === 'string' && data.url) {
    items.push({ href: data.url, text: '', type: block.type, field: 'url' })
  }
  return items
}

function auditPage(slug, blocks) {
  const productHits = []
  const byKey = new Map()
  for (const block of blocks) {
    for (const item of collectHrefItems(block)) {
      if (isProductPageUrl(item.href) || /signalmelo\.com\/product(\/|$|\?|#)/i.test(item.href)) {
        productHits.push({ ...item, slug })
      }
      const key = canonicalInternalUrl(item.href, slug)
      if (!key) continue
      if (!byKey.has(key)) byKey.set(key, [])
      byKey.get(key).push(item)
    }
  }
  const dupes = [...byKey.entries()]
    .filter(([, arr]) => arr.length > 1)
    .map(([url, arr]) => ({ url, count: arr.length, texts: arr.map(a => a.text) }))
  return { productHits, dupes }
}

async function main() {
  console.log(AUDIT ? 'MODE audit' : WRITE ? 'MODE write' : 'MODE dry-run')
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

  if (AUDIT) {
    let leftoverProduct = 0
    let dupePages = 0
    for (const post of posts) {
      await sleep(200)
      const blocks = await walkBlocks(post.id)
      const { productHits, dupes } = auditPage(post.slug, blocks)
      if (productHits.length || dupes.length) {
        console.log(`\n== ${post.slug}`)
        for (const hit of productHits) {
          leftoverProduct++
          console.log(`  [product] ${hit.type} ${hit.href} "${hit.text}"`)
        }
        if (dupes.length) dupePages++
        for (const d of dupes) {
          console.log(`  [dup x${d.count}] ${d.url}`)
          for (const t of d.texts) console.log(`     - "${t}"`)
        }
      }
    }
    console.log('\n----')
    console.log('leftover /product links:', leftoverProduct)
    console.log('pages with duplicate internal destinations:', dupePages)
    return
  }

  const summary = []
  let patched = 0

  for (const post of posts) {
    await sleep(250)
    const blocks = await walkBlocks(post.id)
    const plans = pickLinksForPage(post.slug, blocks)
    summary.push({ slug: post.slug, title: post.title, count: plans.length, plans })

    const byBlock = new Map()
    for (const p of plans) {
      if (!byBlock.has(p.blockId)) byBlock.set(p.blockId, [])
      byBlock.get(p.blockId).push(p)
    }

    const seen = new Set()
    const updates = []
    for (const block of blocks) {
      if (!LINKABLE_BLOCK_TYPES.has(block.type)) continue
      let richText = block[block.type]?.rich_text
      if (!Array.isArray(richText)) continue
      const group = byBlock.get(block.id) || []
      if (group.length) {
        const sorted = [...group].sort((a, b) => b.start - a.start)
        for (const plan of sorted) {
          richText = applyLink(richText, plan.start, plan.length, plan.url)
        }
      }
      const { next, changed } = rewriteAndDedupe(richText, seen, post.slug)
      if (changed || group.length) {
        updates.push({ block, next, newLinks: group.length, deduped: changed })
      }
    }

    console.log(`\n== ${post.slug} (new ${plans.length}, blocks to patch ${updates.length})`)
    for (const p of plans) {
      console.log(`  [${p.isProduct ? 'site' : 'article'}] "${p.matched}" -> ${p.url}`)
      console.log(`     …${p.snippet}…`)
    }
    for (const u of updates) {
      if (u.deduped && !u.newLinks) {
        console.log(`  [dedupe/rewrite] ${u.block.id.slice(0, 8)}`)
      }
    }

    if (!WRITE || !updates.length) continue

    for (const u of updates) {
      await sleep(350)
      try {
        await notion('PATCH', `/blocks/${u.block.id}`, {
          [u.block.type]: { rich_text: u.next }
        })
        patched++
      } catch (e) {
        console.error(`  PATCH fail ${post.slug} ${u.block.id}: ${e.message}`)
      }
    }
  }

  const totalLinks = summary.reduce((n, s) => n + s.count, 0)
  console.log('\n----')
  console.log(
    'pages',
    summary.length,
    'links planned',
    totalLinks,
    WRITE ? `blocks patched ${patched}` : '(dry-run, nothing written)'
  )
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
