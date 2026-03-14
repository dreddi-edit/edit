let _requireApproval = true
let _approvalThreshold = 0.05

export function setRequireApproval(v: boolean) { _requireApproval = v }
export function getRequireApproval(): boolean { return _requireApproval }
export function setApprovalThreshold(v: number) { _approvalThreshold = v }
export function getApprovalThreshold(): number { return _approvalThreshold }
export function shouldApprove(cost_eur: number): boolean {
  if (!_requireApproval) return false
  return cost_eur >= _approvalThreshold
}
