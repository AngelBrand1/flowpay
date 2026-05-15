import { setUnauthenticatedHandler, handleUnauthenticated } from './unauthenticatedHandler'

describe('unauthenticatedHandler', () => {
  afterEach(() => {
    setUnauthenticatedHandler(() => {})
  })

  it('calls the registered handler', () => {
    const handler = jest.fn()
    setUnauthenticatedHandler(handler)

    handleUnauthenticated()

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('can update handler', () => {
    const handler1 = jest.fn()
    const handler2 = jest.fn()

    setUnauthenticatedHandler(handler1)
    handleUnauthenticated()
    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).not.toHaveBeenCalled()

    setUnauthenticatedHandler(handler2)
    handleUnauthenticated()
    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(1)
  })

  it('does nothing with default no-op handler', () => {
    handleUnauthenticated()
  })
})
