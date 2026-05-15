export class ApiError extends Error {
  constructor(
    public readonly status: number | undefined,
    public readonly code: string | undefined,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
