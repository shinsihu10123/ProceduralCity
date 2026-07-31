const sourceParts = [
  './main.part1.js.txt',
  './main.part2.js.txt',
  './main.part3a.js.txt',
  './main.part3b.js.txt',
  './main.part3c.js.txt',
  './main.part3d.js.txt',
  './main.part3e1.js.txt',
  './main.part3e2.js.txt',
  './main.part3f.js.txt',
]

try {
  const source = (await Promise.all(sourceParts.map(async (path) => {
    const response = await fetch(new URL(path, import.meta.url))
    if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`)
    return response.text()
  }))).join('')

  const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
  await import(moduleUrl)
  URL.revokeObjectURL(moduleUrl)

  if (!document.querySelector('link[data-living-city]')) {
    const stylesheet = document.createElement('link')
    stylesheet.rel = 'stylesheet'
    stylesheet.href = new URL('./living-city.css', import.meta.url)
    stylesheet.dataset.livingCity = 'true'
    document.head.appendChild(stylesheet)
  }
  await import('./living-city.js')
} catch (error) {
  console.error(error)
  const loading = document.querySelector('#loading')
  if (loading) {
    loading.textContent = '도시 엔진을 불러오지 못했습니다.'
    loading.classList.add('visible')
  }
}
