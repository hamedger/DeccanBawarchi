import { ScrollViewStyleReset } from 'expo-router/html'
import type { PropsWithChildren } from 'react'

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <ScrollViewStyleReset />

        {/* PWA */}
        <link rel="icon" type="image/png" href="/assets/icon.png" />
        <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#d4af37" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        {/* SEO */}
        <title>Deccan Bawarchi — Authentic Hyderabadi Cuisine</title>
        <meta name="description" content="Order Dum Biryani, Haleem & Marag online. Daily Buffet. 100% Zabiha Halal. Northville, MI." />

        {/* Open Graph */}
        <meta property="og:title" content="Deccan Bawarchi — Authentic Hyderabadi Cuisine" />
        <meta property="og:description" content="Order Dum Biryani, Haleem & Marag online. Daily Buffet. 100% Zabiha Halal. Northville, MI." />
        <meta property="og:image" content="https://deccanbawarchi.com/assets/og-image.png" />
        <meta property="og:url" content="https://deccanbawarchi.com" />
        <meta property="og:type" content="website" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Deccan Bawarchi — Authentic Hyderabadi Cuisine" />
        <meta name="twitter:description" content="Order Dum Biryani, Haleem & Marag online. Daily Buffet. 100% Zabiha Halal. Northville, MI." />
        <meta name="twitter:image" content="https://deccanbawarchi.com/assets/og-image.png" />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ backgroundColor: '#0c0a08' }}>
        {children}
      </body>
    </html>
  )
}
