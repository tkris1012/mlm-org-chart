export async function resizeToBase64(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 160
      canvas.height = 160

      const ctx = canvas.getContext('2d')

      // 正方形クロップ（中央）
      const size = Math.min(img.naturalWidth, img.naturalHeight)
      const sx = (img.naturalWidth - size) / 2
      const sy = (img.naturalHeight - size) / 2

      ctx.drawImage(img, sx, sy, size, size, 0, 0, 160, 160)

      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.78))
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('画像の読み込みに失敗しました'))
    }

    img.src = url
  })
}
