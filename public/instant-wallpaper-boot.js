;(() => {
  const thumbnailKey = 'curatorNewTabInstantWallpaper'
  const targetKey = 'curatorNewTabInstantWallpaperTarget'

  try {
    const targetRecord = readRecord(targetKey)
    if (!targetRecord?.signature) {
      return
    }

    const thumbnailRecord = readRecord(thumbnailKey)
    const thumbnailDataUrl = thumbnailRecord?.signature === targetRecord.signature &&
      typeof thumbnailRecord.dataUrl === 'string' &&
      thumbnailRecord.dataUrl.startsWith('data:image/')
      ? thumbnailRecord.dataUrl
      : ''
    const imageUrl = typeof targetRecord.imageUrl === 'string' ? targetRecord.imageUrl : ''
    const startupImage = thumbnailDataUrl || imageUrl
    if (!startupImage) {
      applyPlaceholderColor(targetRecord)
      return
    }

    const root = document.documentElement
    root.style.setProperty('--instant-wallpaper-image', `url("${escapeCssUrl(startupImage)}")`)
    root.style.setProperty(
      '--instant-wallpaper-size',
      typeof targetRecord.backgroundSize === 'string' && targetRecord.backgroundSize ? targetRecord.backgroundSize : 'cover'
    )
    root.style.setProperty(
      '--instant-wallpaper-position',
      typeof targetRecord.backgroundPosition === 'string' && targetRecord.backgroundPosition ? targetRecord.backgroundPosition : 'center'
    )
    root.style.setProperty(
      '--wallpaper-placeholder-bg',
      typeof targetRecord.placeholderColor === 'string' && targetRecord.placeholderColor ? targetRecord.placeholderColor : '#000000'
    )
    if (!thumbnailDataUrl && imageUrl) {
      root.dataset.instantWallpaperSource = 'target-url'
      // Avoid showing an old thumbnail when the selected wallpaper has changed.
      root.dataset.instantWallpaperReason = 'old thumbnail signature mismatch'
    }
    root.classList.add('instant-wallpaper-ready')
  } catch {
    // Startup wallpaper is best-effort; the main app will apply the durable background.
  }

  function readRecord(key) {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  }

  function applyPlaceholderColor(targetRecord) {
    document.documentElement.style.setProperty(
      '--wallpaper-placeholder-bg',
      typeof targetRecord.placeholderColor === 'string' && targetRecord.placeholderColor ? targetRecord.placeholderColor : '#000000'
    )
  }

  function escapeCssUrl(value) {
    return value.replace(/["\\]/g, '\\$&')
  }
})()
