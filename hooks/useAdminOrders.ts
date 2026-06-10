import { useEffect, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../lib/firebase'
import { handleFirestoreListenerError } from '../lib/firestoreErrors'
import { useAuthStore } from '../store/authStore'
import { Order } from '../types/order'

export function useAdminOrders(maxOrders = 150, locationId?: string | null) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const { firebaseUser, isAdmin } = useAuthStore()

  useEffect(() => {
    if (!isFirebaseConfigured || !firebaseUser || !isAdmin) {
      setOrders([])
      setLoading(false)
      return
    }

    const base = collection(db, 'orders')
    const q = locationId
      ? query(base, where('locationId', '==', locationId), orderBy('createdAt', 'desc'), limit(maxOrders))
      : query(base, orderBy('createdAt', 'desc'), limit(maxOrders))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order)))
        setLoading(false)
      },
      (error) => {
        handleFirestoreListenerError(error, 'admin orders listener')
        setOrders([])
        setLoading(false)
      },
    )

    return unsub
  }, [maxOrders, locationId, firebaseUser?.uid, isAdmin])

  return { orders, loading }
}
