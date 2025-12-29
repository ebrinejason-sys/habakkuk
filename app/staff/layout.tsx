"use client"

import { SessionProvider } from "next-auth/react"

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionProvider>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold">Habakkuk Pharmacy - Staff Portal</h1>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-6">
          {children}
        </main>
      </div>
    </SessionProvider>
  )
}
