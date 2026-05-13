import { useGlobal } from '@/lib/global'
import { useEffect, useRef, useState } from 'react'

const ArticleLock = ({ validPassword }) => {
  const { locale } = useGlobal()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const submitPassword = () => {
    if (typeof validPassword !== 'function') return
    const ok = validPassword(password)
    if (!ok) {
      setError(locale?.COMMON?.PASSWORD_ERROR || 'Wrong password')
    }
  }

  return (
    <div className='fuwari-card p-6 md:p-8 text-center'>
      <div className='text-3xl mb-3 text-[var(--fuwari-primary)]'>
        <i className='fas fa-lock' />
      </div>
      <h2 className='text-xl font-semibold mb-2'>
        {locale?.COMMON?.ARTICLE_LOCK_TIPS || 'This article is password protected.'}
      </h2>
      <p className='text-sm text-[var(--fuwari-muted)] mb-4'>
        {locale?.COMMON?.INPUT_PASSWORD || 'Enter the password to continue.'}
      </p>

      <div className='max-w-sm mx-auto flex'>
        <input
          ref={inputRef}
          type='password'
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submitPassword()}
          className='flex-1 rounded-l-xl border border-[var(--fuwari-border)] bg-[var(--fuwari-bg-soft)] px-4 py-2 text-sm outline-none focus:border-[var(--fuwari-primary)]'
          placeholder={locale?.COMMON?.INPUT_PASSWORD || 'Password'}
        />
        <button
          type='button'
          onClick={submitPassword}
          className='rounded-r-xl px-4 py-2 text-sm font-semibold text-white bg-[var(--fuwari-primary)] hover:opacity-90'>
          {locale?.COMMON?.SUBMIT || 'Submit'}
        </button>
      </div>

      {!!error && <p className='text-red-500 text-sm mt-3'>{error}</p>}
    </div>
  )
}

export default ArticleLock

