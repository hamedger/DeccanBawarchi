export interface HeroSplashDish {
  id: string
  name: string
  imageUrl: string
}

/** Verified working URLs — broken Unsplash/TheMealDB links removed */
export const HERO_SPLASH_DISHES: HeroSplashDish[] = [
  {
    id: 'hyderabadi-dum-biryani',
    name: 'Hyderabadi Dum Biryani',
    imageUrl: 'https://www.themealdb.com/images/media/meals/xrttsx1487339558.jpg',
  },
  {
    id: 'mutton-haleem',
    name: 'Haleem',
    imageUrl: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641',
  },
  {
    id: 'pathar-ka-gosht',
    name: 'Pathar Ka Gosht',
    imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947',
  },
  {
    id: 'mirchi-ka-salan',
    name: 'Mirchi Ka Salan',
    imageUrl: 'https://www.themealdb.com/images/media/meals/sstssx1487349585.jpg',
  },
  {
    id: 'lukhmi',
    name: 'Lukhmi',
    imageUrl: 'https://www.themealdb.com/images/media/meals/1529444113.jpg',
  },
  {
    id: 'bagara-baingan',
    name: 'Bagara Baingan',
    imageUrl: 'https://www.themealdb.com/images/media/meals/sywrsu1511463066.jpg',
  },
  {
    id: 'mutton-marag',
    name: 'Marag',
    imageUrl: 'https://images.unsplash.com/photo-1547592166-23ac45744acd',
  },
  {
    id: 'double-ka-meetha',
    name: 'Double Ka Meetha',
    imageUrl: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587',
  },
  {
    id: 'qubani-ka-meetha',
    name: 'Qubani Ka Meetha',
    imageUrl: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb',
  },
  {
    id: 'osmania-biscuits',
    name: 'Osmania Biscuits',
    imageUrl: 'https://images.unsplash.com/photo-1617093727343-374698b1b08d',
  },
]

export const HERO_SPLASH_FALLBACK =
  'https://www.themealdb.com/images/media/meals/xrttsx1487339558.jpg'

export const HERO_SPLASH_INTERVAL_MS = 4500
