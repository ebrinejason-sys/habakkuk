"use client"

import { useSession, signOut } from "next-auth/react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  ShoppingCart, 
  DollarSign, 
  Settings, 
  LogOut,
  Menu,
  X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { cn } from "@/lib/utils"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

interface AdminLayoutProps {
  children: React.ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const navigation = [
    { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { name: "Users", href: "/admin/users", icon: Users, permission: "MANAGE_USERS" },
    { name: "Inventory", href: "/admin/inventory", icon: Package, permission: "MANAGE_INVENTORY" },
    { name: "POS", href: "/admin/pos", icon: ShoppingCart, permission: "MANAGE_POS" },
    { name: "Transactions", href: "/admin/transactions", icon: DollarSign, permission: "VIEW_TRANSACTIONS" },
    { name: "Settings", href: "/admin/settings", icon: Settings, permission: "MANAGE_SETTINGS" },
  ]

  const hasPermission = (permission?: string) => {
    if (!permission) return true
    if (session?.user.role === "ADMIN") return true
    return session?.user.permissions?.includes(permission as any)
  }

  const filteredNavigation = navigation.filter(item => hasPermission(item.permission))

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-screen w-64 bg-white border-r transition-transform duration-300 ease-in-out lg:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b">
            <Link href="/admin/dashboard" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-sm font-bold text-white">HP</span>
              </div>
              <span className="font-bold text-lg">Habakkuk</span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setIsSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
            {filteredNavigation.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>

          {/* User Info */}
          <div className="border-t p-4">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-xs font-bold text-white">
                  {session?.user.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{session?.user.name}</p>
                <p className="text-xs text-gray-500">{session?.user.role}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center h-16 px-4 bg-white border-b lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
