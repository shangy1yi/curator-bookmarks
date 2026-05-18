import type { BookmarkRecord } from '../../shared/types.js'
import type { NewTabSpeedDialStateMessage } from '../../shared/constants.js'

type DashboardModule = typeof import('./dashboard-runtime.js')
type DashboardCallbacks = Parameters<DashboardModule['handleDashboardClick']>[1]

let dashboardModule: DashboardModule | null = null
let dashboardModulePromise: Promise<DashboardModule> | null = null

function loadDashboardModule(): Promise<DashboardModule> {
  if (!dashboardModulePromise) {
    dashboardModulePromise = import('./dashboard-runtime.js').then((mod) => {
      dashboardModule = mod
      return mod
    })
  }
  return dashboardModulePromise
}

function loadedDashboardModule(): DashboardModule | null {
  return dashboardModule
}

export function cancelDashboardDrag(): boolean {
  return loadedDashboardModule()?.cancelDashboardDrag() ?? false
}

export function closeDashboardTagEditor(): boolean {
  return loadedDashboardModule()?.closeDashboardTagEditor() ?? false
}

export function closeDashboardTagPopover(): boolean {
  return loadedDashboardModule()?.closeDashboardTagPopover() ?? false
}

export function getSelectedDashboardBookmarks(): BookmarkRecord[] {
  return loadedDashboardModule()?.getSelectedDashboardBookmarks() ?? []
}

export function getSingleDashboardMoveBookmark(): BookmarkRecord | null {
  return loadedDashboardModule()?.getSingleDashboardMoveBookmark() ?? null
}

export function isDashboardViewReady(): boolean {
  return loadedDashboardModule()?.isDashboardViewReady() ?? false
}

export function removeDashboardSelectionIds(bookmarkIds: unknown[]): void {
  loadedDashboardModule()?.removeDashboardSelectionIds(bookmarkIds)
}

export function renderDashboardSection(): void {
  void loadDashboardModule().then((mod) => mod.renderDashboardSection())
}

export function prepareDashboardSectionEntry(): void {
  void loadDashboardModule().then((mod) => mod.prepareDashboardSectionEntry())
}

export async function hydrateDashboardSpeedDialState(): Promise<void> {
  const mod = await loadDashboardModule()
  await mod.hydrateDashboardSpeedDialState()
}

export function hydrateDashboardFaviconCache(rawCache: unknown, now = Date.now()): void {
  void loadDashboardModule().then((mod) => mod.hydrateDashboardFaviconCache(rawCache, now))
}

export function applyNewTabSpeedDialStateMessage(message: NewTabSpeedDialStateMessage): void {
  loadedDashboardModule()?.applyNewTabSpeedDialStateMessage(message)
}

export function handleDashboardInput(event: Event): void {
  loadedDashboardModule()?.handleDashboardInput(event)
}

export function handleDashboardKeydown(event: KeyboardEvent): void {
  loadedDashboardModule()?.handleDashboardKeydown(event)
}

export async function handleDashboardClick(event: Event, callbacks: DashboardCallbacks): Promise<void> {
  const mod = await loadDashboardModule()
  await mod.handleDashboardClick(event, callbacks)
}

export function handleDashboardError(event: Event, callbacks: DashboardCallbacks): void {
  void loadDashboardModule().then((mod) => mod.handleDashboardError(event, callbacks))
}

export function handleDashboardLoad(event: Event): void {
  loadedDashboardModule()?.handleDashboardLoad(event)
}

export function handleDashboardTagPointerOver(event: PointerEvent): void {
  loadedDashboardModule()?.handleDashboardTagPointerOver(event)
}

export function handleDashboardTagPointerOut(event: PointerEvent): void {
  loadedDashboardModule()?.handleDashboardTagPointerOut(event)
}

export function handleDashboardDocumentClick(event: MouseEvent): void {
  loadedDashboardModule()?.handleDashboardDocumentClick(event)
}

export function handleDashboardDocumentFocusIn(event: FocusEvent): void {
  loadedDashboardModule()?.handleDashboardDocumentFocusIn(event)
}

export function handleDashboardPointerDown(event: PointerEvent): void {
  loadedDashboardModule()?.handleDashboardPointerDown(event)
}

export function handleDashboardPointerMove(event: PointerEvent): void {
  loadedDashboardModule()?.handleDashboardPointerMove(event)
}

export async function handleDashboardPointerUp(event: PointerEvent, callbacks: DashboardCallbacks): Promise<void> {
  const mod = loadedDashboardModule()
  if (mod) {
    await mod.handleDashboardPointerUp(event, callbacks)
  }
}

export function handleDashboardPointerCancel(): void {
  loadedDashboardModule()?.handleDashboardPointerCancel()
}

export async function moveSelectedDashboardBookmarks(
  folderId: string,
  callbacks: DashboardCallbacks
): Promise<void> {
  const mod = await loadDashboardModule()
  await mod.moveSelectedDashboardBookmarks(folderId, callbacks)
}

export async function moveSingleDashboardBookmark(
  folderId: string,
  callbacks: DashboardCallbacks
): Promise<void> {
  const mod = await loadDashboardModule()
  await mod.moveSingleDashboardBookmark(folderId, callbacks)
}
