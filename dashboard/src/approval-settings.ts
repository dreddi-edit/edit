// Globaler Toggle – wird von App.tsx gesetzt, von BlockOverlay gelesen
let _requireApproval = true

export function setRequireApproval(v: boolean) {
  _requireApproval = v
}

export function getRequireApproval(): boolean {
  return _requireApproval
}
