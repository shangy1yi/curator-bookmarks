;(() => {
  const thumbnailKey = 'curatorNewTabInstantWallpaper'
  const targetKey = 'curatorNewTabInstantWallpaperTarget'
  const fallbackColor = '#101013'

  try {
    const targetRecord = readRecord(targetKey)
    if (!targetRecord?.signature) {
      applyStartupBackground('', '', fallbackColor, 'cover', 'center')
      return
    }

    const targetImageUrl = getTargetImageUrl(targetRecord)
    const targetPreviewUrl = getTargetPreviewUrl(targetRecord)
    if (targetImageUrl) {
      preloadStartupImage(targetImageUrl)
    }
    if (targetPreviewUrl && targetPreviewUrl !== targetImageUrl) {
      preloadStartupImage(targetPreviewUrl)
    }

    const thumbnailRecord = readRecord(thumbnailKey)
    const thumbnailDataUrl = getMatchingThumbnailDataUrl(thumbnailRecord, targetRecord.signature)
    const startupImageUrl = targetImageUrl || thumbnailDataUrl
    const startupPreviewUrl = thumbnailDataUrl || targetPreviewUrl || targetImageUrl

    const placeholderColor = normalizeColor(targetRecord.placeholderColor)
    applyStartupBackground(startupImageUrl, startupPreviewUrl, placeholderColor, typeof targetRecord.backgroundSize === 'string' && targetRecord.backgroundSize ? targetRecord.backgroundSize : 'cover', typeof targetRecord.backgroundPosition === 'string' && targetRecord.backgroundPosition ? targetRecord.backgroundPosition : 'center', targetRecord.signature)
    revealWallpaper()
  } catch {
    // Startup wallpaper is best-effort; the main app will apply the durable background.
    applyStartupBackground('', '', fallbackColor, 'cover', 'center')
  }

  function readRecord(key) {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  }

  function applyStartupBackground(imageUrl, previewUrl, placeholderColor, backgroundSize, backgroundPosition, signature) {
    const root = document.documentElement
    root.style.setProperty('--bg', placeholderColor)
    root.style.setProperty('--wallpaper-placeholder-bg', placeholderColor)
    root.style.setProperty('--instant-wallpaper-size', backgroundSize)
    root.style.setProperty('--instant-wallpaper-position', backgroundPosition)
    root.style.setProperty('--instant-wallpaper-image', imageUrl ? `url("${escapeCssUrl(imageUrl)}")` : 'none')
    root.style.setProperty('--instant-wallpaper-preview-image', previewUrl ? `url("${escapeCssUrl(previewUrl)}")` : 'none')
    if (signature) {
      root.dataset.instantWallpaperSignature = signature
    }
    root.classList.remove('instant-wallpaper-remote-ready')
    delete root.dataset.instantWallpaperRemoteReady
  }

  function revealWallpaper() {
    const root = document.documentElement
    root.classList.add('instant-wallpaper-ready')
    root.classList.remove('loading-wallpaper', 'newtab-booting')
    delete root.dataset.instantWallpaperPending
  }

  function getTargetImageUrl(targetRecord) {
    const imageUrl = typeof targetRecord.imageUrl === 'string' ? targetRecord.imageUrl.trim() : ''
    return imageUrl
  }

  function getTargetPreviewUrl(targetRecord) {
    const previewUrl = typeof targetRecord.previewUrl === 'string' ? targetRecord.previewUrl.trim() : ''
    return previewUrl
  }

  function getMatchingThumbnailDataUrl(thumbnailRecord, targetSignature) {
    if (thumbnailRecord?.signature !== targetSignature || thumbnailRecord.ready === false) {
      return ''
    }
    const dataUrl = typeof thumbnailRecord.dataUrl === 'string' ? thumbnailRecord.dataUrl : ''
    return dataUrl.startsWith('data:image/') ? dataUrl : ''
  }

  function preloadStartupImage(imageUrl) {
    try {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.as = 'image'
      link.href = imageUrl
      link.setAttribute('fetchpriority', 'high')
      document.head.appendChild(link)
    } catch {
      // Preload is only a cold-start hint.
    }
  }

  function escapeCssUrl(value) {
    return value.replace(/["\\]/g, '\\$&')
  }

  function normalizeColor(value) {
    const color = typeof value === 'string' ? value.trim() : ''
    if (/^#[0-9a-f]{6}$/i.test(color)) {
      return color
    }
    if (/^#[0-9a-f]{3}$/i.test(color)) {
      return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
    }
    return fallbackColor
  }
})()
