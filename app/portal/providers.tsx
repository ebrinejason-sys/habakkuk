"use client"

import { SessionProvider } from "next-auth/react"
import AdminLayout from "./layout"

export default function AdminLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionProvider>
      <AdminLayout>{children}</AdminLayout>
    </SessionProvider>
  )
}
