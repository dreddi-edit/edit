// Queue für parallele AI-Approval Requests
type ApprovalRequest = {
  id: string
  model: string
  scope: string
  estInputTokens: number
  estOutputTokens: number
  prompt: string
}

const queue: ApprovalRequest[] = []
const listeners: Array<(q: ApprovalRequest[]) => void> = []

export function enqueue(req: ApprovalRequest) {
  queue.push(req)
  listeners.forEach(l => l([...queue]))
}

export function dequeue(id: string) {
  const idx = queue.findIndex(r => r.id === id)
  if (idx !== -1) queue.splice(idx, 1)
  listeners.forEach(l => l([...queue]))
}

export function subscribe(fn: (q: ApprovalRequest[]) => void) {
  listeners.push(fn)
  return () => {
    const i = listeners.indexOf(fn)
    if (i !== -1) listeners.splice(i, 1)
  }
}

export type { ApprovalRequest }
