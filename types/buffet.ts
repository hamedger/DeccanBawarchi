import { Timestamp } from 'firebase/firestore'
import { BuffetSectionId } from '../constants/buffetLayout'

export interface BuffetDish {
  menuItemId: string
  name: string
  isVegetarian: boolean
  isNew: boolean
  sortOrder: number
  /** When false, hidden from the customer buffet page. Defaults to true. */
  isServing?: boolean
  /** Display section on the buffet board. */
  buffetCategory?: BuffetSectionId
}

export interface BuffetConfig {
  locationId: string
  weekdayLunchPrice: number
  weekdayDinnerPrice: number
  weekendLunchPrice: number
  weekendDinnerPrice: number
  lunchStart: string
  lunchEnd: string
  dinnerStart: string
  dinnerEnd: string
  buffetDays: number[]
  todaysDishes: BuffetDish[]
  isLunchActive: boolean
  isDinnerActive: boolean
  specialNote: string
  updatedAt: Timestamp
}

export interface BuffetStatus {
  isOpen: boolean
  currentSession: 'lunch' | 'dinner' | null
  currentPrice: number
  isWeekend: boolean
  lunchPrice: number
  dinnerPrice: number
  nextSessionLabel: string
  countdownMinutes: number | null
  todaysDishes: BuffetDish[]
  specialNote: string
  isLoading: boolean
}
