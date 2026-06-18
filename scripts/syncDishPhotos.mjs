/**
 * Copy dish photos from Photos/<category>/ into public/assets/menu/<id>.jpg
 * and regenerate LOCAL_DISH_IMAGE_URLS in lib/menuImages.ts.
 *
 * Run: node scripts/syncDishPhotos.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'fs'
import { join, basename, extname } from 'path'

const ROOT = new URL('..', import.meta.url).pathname
const PHOTOS_DIR = join(ROOT, 'Photos')
const OUT_DIR = join(ROOT, 'public', 'assets', 'menu')
const MENU_IMAGES_PATH = join(ROOT, 'lib', 'menuImages.ts')

/** Photos folder name → menu category id */
const FOLDER_TO_CATEGORY = {
  biryani: 'biryani',
  'non-veg appetizers': 'non-veg-appetizers',
  'vegetarian appetizer': 'veg-appetizers',
  'vegetarian appetizers': 'veg-appetizers',
  beverages: 'drinks',
  "chef's specials": 'chef-specials',
  'non-veg curries': 'non-veg-curries',
  'vegetarian curries': 'veg-curries',
  'breads & naan': 'breads',
}

function normalizeName(value) {
  return value
    .toLowerCase()
    .replace(/\.(jpe?g|png|webp)$/i, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[/:]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bbiryan\b/g, 'biryani')
    .replace(/\bchilli\b/g, 'chili')
    .replace(/\bhyderbadi\b/g, 'hyderabadi')
    .replace(/\bdum\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isHashFilename(name) {
  return /^[A-Za-z0-9_-]{40,}$/.test(name)
}

function parseMenuItems() {
  const src = readFileSync(join(ROOT, 'constants', 'staticMenu.ts'), 'utf8')
  return [...src.matchAll(/id:'([^']+)',\s*name:'([^']+)'[^}]*,\s*category:'([^']+)'/g)].map((m) => ({
    id: m[1],
    name: m[2],
    category: m[3],
    norm: normalizeName(m[2]),
  }))
}

function scoreMatch(photoNorm, itemNorm) {
  if (photoNorm === itemNorm) return 100
  if (itemNorm.includes(photoNorm) || photoNorm.includes(itemNorm)) return 80

  const photoWords = new Set(photoNorm.split(' ').filter(Boolean))
  const itemWords = new Set(itemNorm.split(' ').filter(Boolean))
  let overlap = 0
  for (const w of photoWords) {
    if (itemWords.has(w)) overlap++
  }
  if (!overlap) return 0
  return Math.round((overlap / Math.max(photoWords.size, itemWords.size)) * 70)
}

function findBestItem(photoNorm, items, categoryId) {
  const pool = items.filter((i) => i.category === categoryId)
  let best = null
  let bestScore = 0
  for (const item of pool) {
    const score = scoreMatch(photoNorm, item.norm)
    if (score > bestScore) {
      bestScore = score
      best = item
    }
  }
  return bestScore >= 50 ? best : null
}

function listPhotoFiles(dir) {
  const entries = readdirSync(dir)
  const files = []
  for (const entry of entries) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) continue
    if (!/\.(jpe?g|png|webp)$/i.test(entry)) continue
    files.push(full)
  }
  return files
}

function resolveCategoryId(folderName) {
  const key = folderName.toLowerCase().replace(/\s+/g, ' ').trim()
  return FOLDER_TO_CATEGORY[key] ?? null
}

function patchMenuImages(localMap) {
  const src = readFileSync(MENU_IMAGES_PATH, 'utf8')
  const entries = Object.entries(localMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, url]) => `  '${id}': '${url}',`)
    .join('\n')

  const block = `const LOCAL_DISH_IMAGE_URLS: Record<string, string> = {\n${entries}\n}`

  const next = src.replace(
    /const LOCAL_DISH_IMAGE_URLS: Record<string, string> = \{[\s\S]*?\}/,
    block,
  )

  if (next === src) {
    throw new Error('Could not patch LOCAL_DISH_IMAGE_URLS in lib/menuImages.ts')
  }

  writeFileSync(MENU_IMAGES_PATH, next)
}

mkdirSync(OUT_DIR, { recursive: true })

const items = parseMenuItems()
const localMap = {}
const unmatched = []

for (const folder of readdirSync(PHOTOS_DIR)) {
  const folderPath = join(PHOTOS_DIR, folder)
  if (!statSync(folderPath).isDirectory()) continue

  const categoryId = resolveCategoryId(folder)
  if (!categoryId) {
    console.warn(`Skipping unknown folder: ${folder}`)
    continue
  }

  for (const filePath of listPhotoFiles(folderPath)) {
    const photoName = basename(filePath, extname(filePath))
    if (isHashFilename(photoName)) {
      console.warn(`Skipping hash-named photo (rename to dish name): ${folder}/${photoName}`)
      continue
    }
    const photoNorm = normalizeName(photoName)
    const match = findBestItem(photoNorm, items, categoryId)

    if (!match) {
      unmatched.push({ folder, photo: photoName })
      continue
    }

    const outPath = join(OUT_DIR, `${match.id}.jpg`)
    copyFileSync(filePath, outPath)
    localMap[match.id] = `/assets/menu/${match.id}.jpg`
    console.log(`✓ ${photoName} → ${match.name} (${match.id})`)
  }
}

patchMenuImages(localMap)

console.log(`\nSynced ${Object.keys(localMap).length} photos to public/assets/menu/`)
if (unmatched.length) {
  console.log('\nUnmatched photos:')
  for (const row of unmatched) {
    console.log(`  - ${row.folder}/${row.photo}`)
  }
}
