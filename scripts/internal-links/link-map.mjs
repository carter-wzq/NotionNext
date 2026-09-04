export const BLOG = 'https://blog.signalmelo.com/article/'
export const SITE = 'https://www.signalmelo.com'

/**
 * Longer / more specific phrases first. `slug` targets a blog post;
 * `url` targets a product-site page. Apply script skips self-links
 * and keeps at most one link per target URL per page.
 */
export const PHRASE_CATALOG = [
  { phrase: 'social listening vs brand monitoring', slug: 'social-listening-vs-brand-monitoring' },
  { phrase: 'Social Listening vs. Brand Monitoring', slug: 'social-listening-vs-brand-monitoring' },
  { phrase: 'SignalMelo vs Brand24', url: SITE + '/compare/signalmelo-vs-brand24' },
  { phrase: 'Brand24 alternatives', slug: '8-best-brand24-alternatives-in-2026' },
  { phrase: 'How to Find Leads on Reddit', slug: 'find-leads-on-reddit' },
  { phrase: 'find leads on Reddit', slug: 'find-leads-on-reddit' },
  { phrase: 'How to Track Brand Mentions on X', slug: 'track-brand-mentions-on-x' },
  { phrase: 'How to Monitor Reddit Mentions', slug: 'how-to-monitor-reddit-mentions' },
  { phrase: '8 best Reddit monitoring tools', slug: 'best-reddit-monitoring-tools-2026' },
  { phrase: 'monitor Reddit mentions', slug: 'how-to-monitor-reddit-mentions' },
  { phrase: 'Reddit self-promotion rules', slug: 'reddit-self-promotion-rules' },
  { phrase: 'self-promotion rules', slug: 'reddit-self-promotion-rules' },
  { phrase: 'buyer intent signals', slug: 'reddit-buyer-intent-signals' },
  { phrase: 'high-intent conversations', slug: 'how-to-find-high-intent-reddit-conversations' },
  { phrase: 'high-intent conversation', slug: 'how-to-find-high-intent-reddit-conversations' },
  { phrase: 'community-led growth', slug: 'community-led-growth-reddit-pipeline' },
  { phrase: 'weekly social listening workflow', slug: 'weekly-social-listening-workflow' },
  { phrase: 'TikTok and YouTube comments', slug: 'tiktok-youtube-comments-product-intelligence' },
  { phrase: 'best Reddit monitoring tools', slug: 'best-reddit-monitoring-tools-2026' },
  { phrase: 'Reddit monitoring tools', slug: 'best-reddit-monitoring-tools-2026' },
  { phrase: 'free Reddit monitoring', slug: 'free-reddit-monitoring-tools-limits' },
  { phrase: 'Brand Monitoring ROI', slug: 'brand-monitoring-roi-attribution' },
  { phrase: 'find the right subreddits', slug: 'how-to-find-subreddits-for-saas' },
  { phrase: 'brand mentions on X', slug: 'track-brand-mentions-on-x' },
  { phrase: 'competitor mentions', slug: 'track-competitors-on-reddit-and-x' },
  { phrase: 'intent scoring', slug: 'intent-scoring-social-listening' },
  { phrase: 'keyword alerts', slug: 'reddit-keyword-alerts' },
  { phrase: 'Reddit keyword alerts', slug: 'reddit-keyword-alerts' },
  { phrase: 'Reddit marketing', slug: 'reddit-marketing-for-saas' },
  { phrase: 'self-promotion', slug: 'reddit-self-promotion-rules' },
  { phrase: 'negative Reddit posts', slug: 'respond-to-negative-reddit-posts' },
  { phrase: 'worth replying to', slug: '5-signs-reddit-thread-worth-replying' },
  { phrase: 'YouTube comments', slug: 'tiktok-youtube-comments-product-intelligence' },
  { phrase: 'search trends', slug: 'search-trends-predict-reddit-conversations' },
  { phrase: 'AI citations', slug: 'reddit-mentions-ai-citations-geo' },
  { phrase: 'AI recommendations', slug: 'reddit-mentions-ai-citations-geo' },
  { phrase: 'buyer intent', slug: 'reddit-buyer-intent-signals' },
  { phrase: 'high-intent', slug: 'how-to-find-high-intent-reddit-conversations' },
  { phrase: 'weekly workflow', slug: 'weekly-social-listening-workflow' },
  { phrase: 'Reddit mentions', slug: 'how-to-monitor-reddit-mentions' },
  { phrase: 'Reddit monitoring', slug: 'what-is-reddit-monitoring' },
  { phrase: 'brand monitoring', slug: 'what-is-brand-monitoring' },
  { phrase: 'social listening', slug: 'what-is-social-listening' },
  { phrase: 'Brand24', slug: '8-best-brand24-alternatives-in-2026' },
  { phrase: 'Reddit for Brands', slug: 'reddit-for-brands-2026' },

  // Product site — lower priority; apply script caps these
  { phrase: 'social listening for Reddit', url: SITE + '/social-listening/reddit', product: true },
  { phrase: 'X monitoring', url: SITE + '/social-listening/x', product: true },
  { phrase: 'signalmelo.com', url: SITE, product: true },
  { phrase: 'SignalMelo', url: SITE + '/product', product: true, caseSensitive: true }
]

export function hrefFor(entry) {
  if (entry.url) return entry.url
  return BLOG + entry.slug
}

export const MAX_ARTICLE_LINKS = 5
export const MAX_PRODUCT_LINKS = 1
export const LINKABLE_BLOCK_TYPES = new Set([
  'paragraph',
  'bulleted_list_item',
  'numbered_list_item',
  'quote',
  'callout',
  'toggle'
])
