import { getRecipientUsernameFromPayload } from '../nfcRecipient'

describe('getRecipientUsernameFromPayload', () => {
  it('uses username when available', () => {
    expect(
      getRecipientUsernameFromPayload({
        type: 'flowpay_recipient',
        username: 'alice',
      }),
    ).toBe('alice')
  })

  it('does not use display_name as a transfer address', () => {
    expect(
      getRecipientUsernameFromPayload({
        type: 'flowpay_recipient',
        username: 'alice',
        display_name: 'Alice Display',
      } as never),
    ).toBe('alice')
  })
})
