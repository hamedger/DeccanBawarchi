import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../firebase'
import { MenuItem } from '../../types/menu'
import { DEFAULT_LOCATION_ID } from '../../constants/config'
import {
  getStaticMenuCatalog,
  mergeMenuItems,
  sortMenuItems,
} from '../menuMerge'
import { getDishImageUrl, hasLocalDishImage } from '../menuImages'

function ensureImage(item: MenuItem): MenuItem {
  if (hasLocalDishImage(item.id) || !item.imageURL) {
    return {
      ...item,
      imageURL: getDishImageUrl(item.id, item.name, item.category),
    }
  }
  return item
}

export async function fetchAdminMenuItems(): Promise<MenuItem[]> {
  const staticItems = getStaticMenuCatalog(DEFAULT_LOCATION_ID, { includeUnavailable: true })

  if (!isFirebaseConfigured) return sortMenuItems(staticItems)

  try {
    const snap = await getDocs(collection(db, 'menu'))
    if (snap.empty) return sortMenuItems(staticItems)

    const remoteItems = snap.docs.map((d) =>
      ensureImage({ id: d.id, ...d.data() } as MenuItem),
    )
    return sortMenuItems(mergeMenuItems(staticItems, remoteItems))
  } catch {
    return sortMenuItems(staticItems)
  }
}

export async function saveMenuItem(itemId: string, patch: Partial<MenuItem>, base?: MenuItem) {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase is not configured')
  }

  const staticBase =
    base ??
    getStaticMenuCatalog(DEFAULT_LOCATION_ID, { includeUnavailable: true }).find(
      (i) => i.id === itemId,
    )
  if (!staticBase) throw new Error('Menu item not found')

  const payload = {
    ...staticBase,
    ...patch,
    id: itemId,
    updatedAt: serverTimestamp(),
  }

  await setDoc(doc(db, 'menu', itemId), payload, { merge: true })
}

export async function setMenuAvailability(itemId: string, isAvailable: boolean, base?: MenuItem) {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase is not configured')
  }

  const ref = doc(db, 'menu', itemId)
  const staticBase =
    base ??
    getStaticMenuCatalog(DEFAULT_LOCATION_ID, { includeUnavailable: true }).find(
      (i) => i.id === itemId,
    )

  if (staticBase) {
    await setDoc(
      ref,
      { ...staticBase, isAvailable, updatedAt: serverTimestamp() },
      { merge: true },
    )
    return
  }

  await updateDoc(ref, { isAvailable, updatedAt: serverTimestamp() })
}

export async function setMenuStock(
  itemId: string,
  stockQty: number | null,
  trackStock: boolean,
  base?: MenuItem,
) {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase is not configured')
  }

  const isAvailable = !trackStock || stockQty === null || stockQty > 0

  await saveMenuItem(
    itemId,
    {
      trackStock,
      stockQty,
      stockThreshold: base?.stockThreshold ?? 5,
      isAvailable,
    },
    base,
  )
}
