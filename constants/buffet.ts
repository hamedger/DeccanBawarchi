export const BUFFET_PRICING = {
  weekday: {
    lunch: 1799,
    dinner: 2499,
  },
  weekend: {
    lunch: 2499,
    dinner: 2499,
  },
  children: {
    under5: 0,
    age5to10: 'half' as const,
  },
}

export const BUFFET_HOURS = {
  lunch: { start: '11:00', end: '15:00' },
  dinner: { start: '18:00', end: '21:00' },
}

// 0=Sun, 1=Mon ... 6=Sat — buffet runs every day; Sat/Sun use weekend pricing
export const BUFFET_DAYS = [0, 1, 2, 3, 4, 5, 6]

export const RESTAURANT_TIMEZONE = 'America/Detroit'
