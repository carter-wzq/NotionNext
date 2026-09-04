import SmartLink from '@/components/SmartLink'
import { siteConfig } from '@/lib/config'
import { compressImage } from '@/lib/db/notion/mapImage'
import { useRouter } from 'next/router'
import { useState } from 'react'
import CONFIG from '../config'

const getCurrentSearchQuery = router => {
  const queryString = router?.asPath?.split('?')[1]?.split('#')[0] || ''
  const params = new URLSearchParams(queryString)
  const query = {}
  params.forEach((value, key) => {
    query[key] = value
  })
  return query
}

const getArchiveHref = (publishDay, router) => {
  const query = getCurrentSearchQuery(router)
  if (!publishDay) return { pathname: '/archive', query }
  const str = String(publishDay)
  const matched = str.match(/^(\d{4})[-/.](\d{1,2})/)
  if (!matched) return { pathname: '/archive', query }
  const year = matched[1]
  const month = matched[2].padStart(2, '0')
  return {
    pathname: '/archive',
    query,
    hash: `archive-${year}-${month}`
  }
}

const PostCard = ({ post }) => {
  const router = useRouter()
  const thumbPx = Math.min(
    200,
    Math.max(96, Number(siteConfig('FUWARI_POST_LIST_COVER_COL_WIDTH', 148, CONFIG)) || 148)
  )
  const rawCover =
    post.firstContentImage ||
    post.pageCover ||
    post.pageCoverThumbnail ||
    (siteConfig('FUWARI_POST_LIST_COVER_DEFAULT', false, CONFIG) &&
      siteConfig('HOME_BANNER_IMAGE'))
  const coverSrc = rawCover ? compressImage(rawCover, 400) : rawCover
  const [coverFailed, setCoverFailed] = useState(false)
  const showCover = Boolean(coverSrc) && !coverFailed
  const listCoverOn = siteConfig('FUWARI_POST_LIST_COVER', true, CONFIG)
  const showCoverBlock = listCoverOn && showCover

  const gridTemplateColumns = showCoverBlock
    ? `${thumbPx}px minmax(0, 1fr)`
    : 'minmax(0, 1fr)'

  return (
    <article className='fuwari-card fuwari-card-hover p-4 relative w-full max-w-full min-w-0'>
      <div
        className={`fuwari-post-card-grid w-full min-w-0 grid gap-3 md:gap-4 items-start ${showCoverBlock ? 'fuwari-post-card-grid--thumb' : ''}`}
        style={showCoverBlock ? { '--fuwari-thumb-col': `${thumbPx}px`, gridTemplateColumns } : undefined}>
        {showCoverBlock && (
          <SmartLink
            href={post.href || `/${post.slug}`}
            className='fuwari-thumb-link shrink-0'>
            <div
              className={`fuwari-thumb-wrap ${siteConfig('FUWARI_POST_LIST_COVER_HOVER_ENLARGE', true, CONFIG) ? 'fuwari-cover-enlarge' : ''}`}>
              <img
                src={coverSrc}
                alt={post.title}
                loading='lazy'
                decoding='async'
                className='fuwari-thumb-img'
                onError={() => setCoverFailed(true)}
              />
            </div>
          </SmartLink>
        )}
        <div className='min-w-0 flex-1 md:pr-1'>
          <h2 className='fuwari-post-title text-[2rem] font-bold mb-1.5 leading-tight'>
            <SmartLink href={post.href || `/${post.slug}`} className='hover:opacity-90 transition-opacity'>
              {post.title}
            </SmartLink>
          </h2>
          <div className='fuwari-meta-row mb-2.5'>
            <SmartLink href={getArchiveHref(post.publishDay, router)} className='fuwari-meta-item'>
              <i className='far fa-calendar-alt fuwari-meta-icon' />
              <span className='fuwari-meta-text'>{post.publishDay}</span>
            </SmartLink>
            {siteConfig('FUWARI_POST_LIST_TAG', true, CONFIG) && (
              <>
                {post.category && (
                  <SmartLink
                    href={`/category/${encodeURIComponent(post.category)}`}
                    className='fuwari-meta-item'>
                    <i className='far fa-bookmark fuwari-meta-icon' />
                    <span className='fuwari-meta-text'>{post.category}</span>
                  </SmartLink>
                )}
                {!!post.tagItems?.length && (
                  <span className='fuwari-meta-tags'>
                    <i className='fas fa-hashtag' />
                    {post.tagItems.slice(0, 3).map((tag, idx) => (
                      <SmartLink key={tag.name} href={`/tag/${encodeURIComponent(tag.name)}`} className='hover:underline'>
                        {idx > 0 ? ' / ' : ''}
                        {tag.name}
                      </SmartLink>
                    ))}
                  </span>
                )}
              </>
            )}
          </div>
          {siteConfig('FUWARI_POST_LIST_SUMMARY', true, CONFIG) && post.summary && (
            <p className='text-sm leading-7 text-[var(--fuwari-muted)] fuwari-summary'>
              {post.summary}
            </p>
          )}
        </div>
      </div>
    </article>
  )
}

const PostList = ({ posts = [] }) => {
  return (
    <div id='posts-wrapper' className='grid gap-4 w-full min-w-0 max-w-full'>
      {posts.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}

export default PostList

