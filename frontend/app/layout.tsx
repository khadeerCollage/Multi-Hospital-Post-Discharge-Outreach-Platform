import type { Metadata } from 'next'
import './globals.css'
import { GlobalNetworkLoader } from '@/components/GlobalNetworkLoader'

export const metadata: Metadata = {
  title: 'CareReach™ | Multi-Hospital Post-Discharge Outreach Platform',
  description: 'AI-Powered Patient Follow-Up & Clinical Triage Platform',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
}

import { Toaster } from 'sonner'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-gray-50">
        {children}
        <GlobalNetworkLoader />
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  )
}