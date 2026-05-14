const BOOKMARK_MENU_INTERACTION_SELECTOR = [
  '.bookmark-edit-menu',
  '.bookmark-add-menu',
  '.newtab-delete-toast',
  '.custom-select-list',
  '[data-bookmark-id]'
].join(', ')

export function isBookmarkMenuInteractionTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(BOOKMARK_MENU_INTERACTION_SELECTOR))
}
