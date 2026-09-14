import * as functions from 'firebase-functions/v2/scheduler'
import * as admin from 'firebase-admin'

const db = admin.firestore()
const TIMEZONE = 'America/Detroit'

/** Every location currently running the buffet — mirrors the client's acceptsBuffet gating. */
async function buffetLocationIds(): Promise<string[]> {
  const snap = await db.collection('locations').get()
  return snap.docs
    .filter((doc) => doc.data().acceptsBuffet !== false)
    .map((doc) => doc.id)
}

async function updateBuffetLocations(fields: Record<string, boolean>): Promise<void> {
  const locationIds = await buffetLocationIds()
  await Promise.all(
    locationIds.map((id) => db.collection('buffet').doc(id).update(fields)),
  )
}

// 11:00 AM Detroit — open lunch (Mon–Sat). Keep in sync with BUFFET_HOURS.lunch in constants/buffet.ts.
export const openLunch = functions.onSchedule(
  { schedule: '0 11 * * 1-6', timeZone: TIMEZONE },
  async () => {
    await updateBuffetLocations({ isLunchActive: true })
  },
)

// 3:00 PM Detroit — close lunch
export const closeLunch = functions.onSchedule(
  { schedule: '0 15 * * 1-6', timeZone: TIMEZONE },
  async () => {
    await updateBuffetLocations({ isLunchActive: false })
  },
)

// 6:00 PM Detroit — open dinner (Mon–Sat). Keep in sync with BUFFET_HOURS.dinner in constants/buffet.ts.
export const openDinner = functions.onSchedule(
  { schedule: '0 18 * * 1-6', timeZone: TIMEZONE },
  async () => {
    await updateBuffetLocations({ isDinnerActive: true })
  },
)

// 9:00 PM Detroit — close dinner
export const closeDinner = functions.onSchedule(
  { schedule: '0 21 * * 1-6', timeZone: TIMEZONE },
  async () => {
    await updateBuffetLocations({ isDinnerActive: false })
  },
)
