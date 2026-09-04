import { mapImgUrl } from '@/lib/db/notion/mapImage'

const BLOCK_ID = '3b59b5e0-2328-8009-a5fa-f09620ddadf4'
const FILE_ID = '34627732-8b34-473f-9fbd-aaeb5ceedc21'
const FILE_NAME = '5_Types_of_Buyer_Intent_Signals_on_Reddi.png'
const SPACE_ID = '1669b5e0-2328-8133-ac67-0003a0e44139'

const expiredFileNotionUrl =
  `https://file.notion.com/f/f/${SPACE_ID}/${FILE_ID}/${FILE_NAME}` +
  `?table=block&id=${BLOCK_ID}&spaceId=${SPACE_ID}` +
  '&expirationTimestamp=1788436800000&signature=ISmQ9AzaQTF5nGkyg2Icz6sNbh8vHr16eEBanbrfXe8'

describe('mapImgUrl', () => {
  const block = { id: BLOCK_ID, type: 'image' }

  it('rewrites expired file.notion.com URLs to the durable attachment image proxy', () => {
    const mapped = mapImgUrl(expiredFileNotionUrl, block, 'block', false)

    expect(mapped).toContain('https://www.notion.so/image/')
    expect(mapped).toContain(
      encodeURIComponent(`attachment:${FILE_ID}:${FILE_NAME}`)
    )
    expect(mapped).toContain(`id=${BLOCK_ID}`)
    expect(mapped).not.toContain('file.notion.com')
    expect(mapped).not.toContain('signature=')
    expect(mapped).not.toContain('expirationTimestamp=')
  })

  it('still maps attachment: sources through the Notion image proxy', () => {
    const mapped = mapImgUrl(
      `attachment:${FILE_ID}:${FILE_NAME}`,
      block,
      'block',
      false
    )
    expect(mapped).toContain('https://www.notion.so/image/')
    expect(mapped).toContain(
      encodeURIComponent(`attachment:${FILE_ID}:${FILE_NAME}`)
    )
  })

  it('leaves external images unchanged', () => {
    const src = 'https://images.unsplash.com/photo-123?q=80'
    const mapped = mapImgUrl(src, block, 'block', false)
    expect(mapped.startsWith('https://images.unsplash.com/photo-123')).toBe(true)
    expect(mapped).not.toContain('/image/')
  })
})
