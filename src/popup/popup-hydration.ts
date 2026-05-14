export interface PopupBaseHydrationOptions<TBaseData> {
  loadBaseData: () => Promise<TBaseData>
  applyBaseData: (baseData: TBaseData) => void
  startDeferredHydration?: (baseData: TBaseData) => Promise<unknown>
}

export interface PopupBaseHydrationResult<TBaseData> {
  baseData: TBaseData
  deferredHydration: Promise<unknown>
}

export interface PopupDeferredHydrationOptions<TBaseData, TDeferredData> {
  baseData: TBaseData
  loadDeferredData: () => Promise<TDeferredData>
  applyDeferredData: (baseData: TBaseData, deferredData: TDeferredData) => void
}

export async function hydratePopupBaseData<TBaseData>({
  loadBaseData,
  applyBaseData,
  startDeferredHydration
}: PopupBaseHydrationOptions<TBaseData>): Promise<PopupBaseHydrationResult<TBaseData>> {
  const baseData = await loadBaseData()
  applyBaseData(baseData)
  const deferredHydration = startDeferredHydration
    ? startDeferredHydration(baseData)
    : Promise.resolve()

  return { baseData, deferredHydration }
}

export async function hydratePopupDeferredEnhancements<TBaseData, TDeferredData>({
  baseData,
  loadDeferredData,
  applyDeferredData
}: PopupDeferredHydrationOptions<TBaseData, TDeferredData>): Promise<TDeferredData> {
  const deferredData = await loadDeferredData()
  applyDeferredData(baseData, deferredData)
  return deferredData
}
