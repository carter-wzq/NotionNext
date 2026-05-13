import { siteConfig } from '@/lib/config'
import CONFIG from '../config'

const Footer = () => {
  const currentYear = new Date().getFullYear()
  const since = parseInt(siteConfig('SINCE') || currentYear, 10)
  const copyrightDate = since < currentYear ? `${since}-${currentYear}` : `${currentYear}`
  const author = siteConfig('AUTHOR') || siteConfig('TITLE') || 'NotionNext'
  const version = siteConfig('VERSION') || ''
  const rawPowered = siteConfig('FUWARI_FOOTER_POWERED_BY', false, CONFIG)
  const showPoweredBy =
    rawPowered === true ||
    String(rawPowered).toLowerCase() === 'true' ||
    String(rawPowered).toLowerCase() === 'yes'

  return (
    <footer className='fuwari-footer py-6 text-center text-sm text-[var(--fuwari-muted)]'>
      <div className='max-w-6xl mx-auto px-4'>
        <p>
          <i className='far fa-copyright mr-1' />
          {copyrightDate} {author}. All Rights Reserved.
        </p>
        {showPoweredBy && (
          <p className='mt-1'>
            Powered by{' '}
            <a
              href='https://github.com/tangly1024/NotionNext'
              target='_blank'
              rel='noopener noreferrer'
              className='fuwari-link font-semibold'>
              NotionNext{version ? ` v${version}` : ''}
            </a>{' '}
            / Theme{' '}
            <span className='font-semibold text-[var(--fuwari-primary)]'>
              Fuwari
            </span>
          </p>
        )}
      </div>
    </footer>
  )
}

export default Footer

