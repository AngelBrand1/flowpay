type Handler = () => void

let handler: Handler = () => {}

export function setUnauthenticatedHandler(fn: Handler) {
  handler = fn
}

export function handleUnauthenticated() {
  handler()
}
