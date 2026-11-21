/**
 * Makes a question image small before it is uploaded (launch B2): at most
 * `maxSide` px on the long side, re-encoded as WebP (JPEG where the browser
 * can't write WebP and the image has no transparency to lose). Photos from a
 * phone shrink from several MB to ~100 kB, so students on school Wi-Fi load
 * them fast. Falls back to the original file whenever anything fails or the
 * result would not be smaller.
 */
export async function shrinkImage(file: File, maxSide = 1280, quality = 0.82): Promise<File> {
  if (typeof createImageBitmap !== 'function') return file
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)

    let blob = await toBlob(canvas, 'image/webp', quality)
    if (blob?.type !== 'image/webp') {
      // No WebP encoder (older Safari): JPEG has no transparency, so a PNG
      // keeps its own format unless it was resized.
      if (file.type === 'image/png' && scale === 1) return file
      ctx.globalCompositeOperation = 'destination-over'
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      blob = await toBlob(canvas, 'image/jpeg', quality)
    }
    if (!blob || blob.size >= file.size) return file
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
    const name = file.name.replace(/\.[^.]+$/, '') || 'anh'
    return new File([blob], `${name}.${ext}`, { type: blob.type })
  } finally {
    bitmap.close()
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}
