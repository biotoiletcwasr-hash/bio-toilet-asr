import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Bio-Toilet Test | ASR & CIA 2026',
  description: 'Bio-Toilet Effluent Quality Testing – Amritsar Division',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {/* Theme initialiser – prevents flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                var t = localStorage.getItem('theme') || 'light';
                document.documentElement.className = t;
              })()
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
