const SOCKET_CLOSING = 2;
const SOCKET_CLOSED = 3;

type ManagedSocket = Pick<WebSocket, "readyState" | "close"> &
  Partial<Pick<WebSocket, "onopen" | "onmessage" | "onerror" | "onclose">>;

export function replaceWebSocket(
  ref: { current: WebSocket | null },
  next: WebSocket,
) {
  const current = ref.current as ManagedSocket | null;
  if (current && current !== next) {
    current.onopen = null;
    current.onmessage = null;
    current.onerror = null;
    current.onclose = null;
    if (current.readyState !== SOCKET_CLOSING && current.readyState !== SOCKET_CLOSED) {
      current.close(1000);
    }
  }
  ref.current = next;
}
