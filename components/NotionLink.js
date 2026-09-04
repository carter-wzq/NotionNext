const EXTERNAL_HTTP_LINK = /^https?:\/\//i
const FIRST_PARTY_HOST = /(^|\.)signalmelo\.com$/i

const mergeRelValues = (...values) => {
  const rel = new Set()

  values
    .filter(Boolean)
    .join(' ')
    .split(/\s+/)
    .filter(Boolean)
    .forEach(token => rel.add(token))

  return rel.size > 0 ? Array.from(rel).join(' ') : undefined
}

const hostnameOf = (href, base) => {
  try {
    return new URL(href, base || undefined).hostname
  } catch {
    return ''
  }
}

/** Own brand hosts stay dofollow; everything else http(s) is 外链. */
export const isFirstPartyHttpLink = (href, siteOrigin) => {
  if (typeof href !== 'string' || !EXTERNAL_HTTP_LINK.test(href)) {
    return true
  }

  const host = hostnameOf(href).replace(/^www\./i, '')
  if (FIRST_PARTY_HOST.test(host)) {
    return true
  }

  if (!siteOrigin) {
    return false
  }

  try {
    return new URL(href).origin === new URL(siteOrigin).origin
  } catch {
    return false
  }
}

const isExternalHttpLink = (href, siteOrigin) => {
  if (typeof href !== 'string' || !EXTERNAL_HTTP_LINK.test(href)) {
    return false
  }

  if (!siteOrigin) {
    return true
  }

  try {
    const hrefUrl = new URL(href)
    return hrefUrl.origin !== siteOrigin
  } catch {
    return true
  }
}

export const shouldNofollowNotionLink = (href, siteOrigin) => {
  if (typeof href !== 'string' || !EXTERNAL_HTTP_LINK.test(href)) {
    return false
  }
  return !isFirstPartyHttpLink(href, siteOrigin)
}

export const shouldOpenNotionLinkInNewTab = (href, target, siteOrigin) => {
  if (target === '_blank') {
    return true
  }

  const fallbackOrigin =
    siteOrigin ||
    (typeof window !== 'undefined' && window.location
      ? window.location.origin
      : null)

  return isExternalHttpLink(href, fallbackOrigin)
}

const NotionLink = ({ href, target, rel, ...props }) => {
  const siteOrigin =
    typeof window !== 'undefined' && window.location
      ? window.location.origin
      : null
  const shouldOpenInNewTab = shouldOpenNotionLinkInNewTab(href, target, siteOrigin)
  const normalizedTarget = shouldOpenInNewTab ? '_blank' : target
  const normalizedRel = mergeRelValues(
    rel,
    shouldOpenInNewTab ? 'noopener noreferrer' : '',
    shouldNofollowNotionLink(href, siteOrigin) ? 'nofollow' : ''
  )

  return (
    <a {...props} href={href} target={normalizedTarget} rel={normalizedRel} />
  )
}

export default NotionLink
