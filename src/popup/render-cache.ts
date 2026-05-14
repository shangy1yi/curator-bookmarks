export interface PopupSectionRenderState {
  signature: string
}

export function replacePopupSectionHtml(
  element: Pick<HTMLElement, 'innerHTML'>,
  renderState: PopupSectionRenderState,
  signature: string,
  html: string
): boolean {
  if (renderState.signature === signature) {
    return false
  }

  renderState.signature = signature
  element.innerHTML = html
  return true
}
