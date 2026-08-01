const BUILD_ID = 'v082-centers-contract-hotfix-20260801'
const sourceParts = [
  './main.part1.js.txt',
  './main.part2.js.txt',
  './main.part3a.js.txt',
  './main.part3a2.js.txt',
  './main.part3b.js.txt',
  './main.part3c.js.txt',
  './main.part3d.js.txt',
  './main.part3e1.js.txt',
  './main.part3e2.js.txt',
  './main.part3f.js.txt',
  './main.part3g.js.txt',
  './main.part3h.js.txt',
  './main.part3i.js.txt',
  './main.part3j.js.txt',
  './main.part3k.js.txt',
  './main.part3l0.js.txt',
  './main.part3l.js.txt',
  './main.part3m.js.txt',
  './main.part3n.js.txt',
  './main.part3p.js.txt',
  './main.part3o.js.txt',
]

function versionedUrl(path) {
  const url = new URL(path, import.meta.url)
  url.searchParams.set('v', BUILD_ID)
  return url
}

try {
  const source = (await Promise.all(sourceParts.map(async (path) => {
    const response = await fetch(versionedUrl(path), { cache: 'no-store' })
    if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`)
    return response.text()
  }))).join('')

  const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
  await import(moduleUrl)
  URL.revokeObjectURL(moduleUrl)

  if (!document.querySelector('link[data-living-city]')) {
    const stylesheet = document.createElement('link')
    stylesheet.rel = 'stylesheet'
    stylesheet.href = versionedUrl('./living-city.css').href
    stylesheet.dataset.livingCity = 'true'
    document.head.appendChild(stylesheet)
  }
  await import(versionedUrl('./living-city.js').href)
  await import(versionedUrl('./ui-v5.js').href)
} catch (error) {
  console.error(error)
  const loading = document.querySelector('#loading')
  if (loading) {
    loading.textContent = '도시 엔진을 불러오지 못했습니다.'
    loading.classList.add('visible')
  }
}
