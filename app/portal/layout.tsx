"use client"

import { useSession, signOut } from "next-auth/react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  DollarSign,
  Settings,
  LogOut,
  Menu,
  X,
  UserCheck,
  ClipboardList,
  MessageSquare,
  Activity,
  Bell,
  Truck,
  FileText,
  BarChart3,
  RotateCcw,
  Wifi,
  WifiOff
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { NotificationBell } from "@/components/ui/notification-bell"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { getPendingActions } from "@/lib/offlineStorage"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

interface AdminLayoutProps {
  children: React.ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [syncStatus, setSyncStatus] = useState<{ pending: number; lastSync: string | null }>({ pending: 0, lastSync: null })

  useEffect(() => {
    setIsOnline(navigator.onLine)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Poll sync status every 15 seconds (desktop and web)
  useEffect(() => {
    const fetchSyncStatus = async () => {
      let desktopPending = 0;
      let lastSync = null;

      try {
        const res = await fetch('/api/sync/status')
        if (res.ok) {
          const data = await res.json()
          if (data.isDesktop) {
            desktopPending = data.pending;
            lastSync = data.lastSync;
          }
        }
      } catch { /* ignore */ }

      // Also check Web IndexedDB for pending transactions
      let webPending = 0;
      try {
        const pending = await getPendingActions();
        webPending = pending.length;
      } catch { /* ignore */ }

      setSyncStatus({
        pending: desktopPending + webPending,
        lastSync
      });
    }
    fetchSyncStatus()
    const interval = setInterval(fetchSyncStatus, 15000)
    return () => clearInterval(interval)
  }, [])


  const navigation = [
    { name: "Dashboard", href: "/portal/dashboard", icon: LayoutDashboard },
    { name: "Users", href: "/portal/users", icon: Users, permission: "MANAGE_USERS" },
    { name: "Inventory", href: "/portal/inventory", icon: Package, permission: "MANAGE_INVENTORY" },
    { name: "Suppliers", href: "/portal/suppliers", icon: Truck, permission: "MANAGE_INVENTORY" },
    { name: "Purchase Orders", href: "/portal/purchase-orders", icon: FileText, permission: "MANAGE_INVENTORY" },
    { name: "POS", href: "/portal/pos", icon: ShoppingCart, permission: "MANAGE_POS" },
    { name: "Customers", href: "/portal/customers", icon: UserCheck, permission: "MANAGE_POS" },
    { name: "Orders", href: "/portal/orders", icon: ClipboardList, permission: "MANAGE_POS" },
    { name: "Transactions", href: "/portal/transactions", icon: DollarSign, permission: "VIEW_TRANSACTIONS" },
    { name: "Reports", href: "/portal/reports", icon: BarChart3, permission: "VIEW_REPORTS" },
    { name: "Refunds", href: "/portal/refunds", icon: RotateCcw, permission: "MANAGE_TRANSACTIONS" },
    { name: "Inquiries", href: "/portal/inquiries", icon: MessageSquare, adminOnly: true },
    { name: "Activity Log", href: "/portal/activity-log", icon: Activity, adminOnly: true },
    { name: "Settings", href: "/portal/settings", icon: Settings, permission: "MANAGE_SETTINGS" },
  ]

  const hasPermission = (permission?: string, adminOnly?: boolean) => {
    if (adminOnly) {
      return session?.user.role === "ADMIN" || session?.user.role === "CEO"
    }
    if (!permission) return true
    if (session?.user.role === "ADMIN") return true
    if (session?.user.role === "CEO") return true // CEO can view everything
    return session?.user.permissions?.includes(permission as any)
  }

  const filteredNavigation = navigation.filter(item => hasPermission(item.permission, item.adminOnly))

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
        "fixed top-0 left-0 z-50 h-screen w-64 bg-gradient-to-b from-white to-gray-50 border-r shadow-xl transition-transform duration-300 ease-in-out lg:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b bg-white/80 backdrop-blur-sm">
            <Link href="/portal/dashboard" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 rounded-lg overflow-hidden shadow-lg">
                <Image
                  src="/logo.png"
                  alt="Habakkuk Pharmacy Logo"
                  width={40}
                  height={40}
                  className="object-cover"
                />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-base">Habakkuk</span>
                <span className="text-[10px] text-gray-500 uppercase tracking-wide">Pharmacy</span>
              </div>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden hover:bg-gray-100"
              onClick={() => setIsSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
            {filteredNavigation.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/30 scale-105"
                      : "text-gray-700 hover:bg-gray-100 hover:scale-102 hover:shadow-md"
                  )}
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <Icon className={cn("h-5 w-5", isActive && "drop-shadow-sm")} />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>

          {/* User Info */}
          <div className="border-t bg-white/50 p-4 backdrop-blur-sm">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center shadow-md">
                <span className="text-sm font-bold text-white">
                  {session?.user.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-gray-900">{session?.user.name}</p>
                <p className="text-xs text-gray-500 font-medium">{session?.user.role}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-all duration-200">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 bg-white/80 backdrop-blur-md border-b shadow-sm lg:px-6">
          {/* Left - Hamburger menu (mobile) */}
          <div className="flex items-center lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-gray-100"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </Button>
          </div>

          {/* Center - Logo on mobile, Page title on desktop */}
          <div className="flex-1 flex justify-center lg:justify-start lg:ml-0">
            {/* Mobile: Centered Logo */}
            <Link href="/portal/dashboard" className="flex items-center space-x-2 lg:hidden">
              <Image
                src="/logo.png"
                alt="Habakkuk Pharmacy"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <div className="flex flex-col leading-tight">
                <span className="font-bold text-sm">Habakkuk</span>
                <span className="text-[10px] text-gray-500 -mt-0.5">Pharmacy</span>
              </div>
            </Link>
            {/* Desktop: Page Title */}
            <h1 className="text-xl font-semibold text-gray-900 hidden lg:block">
              {filteredNavigation.find(item => item.href === pathname)?.name || "Dashboard"}
            </h1>
          </div>

          {/* Right - Notification bell and user info */}
          <div className="flex items-center space-x-2 sm:space-x-4">

            {/* Online/Offline + Sync Status */}
            <div className="hidden sm:flex items-center gap-1.5">
              <div className={cn(
                "flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium border",
                isOnline
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              )}>
                {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                <span>{isOnline ? "Online" : "Offline"}</span>
              </div>
              {syncStatus.pending > 0 && (
                <div className="flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium border bg-blue-50 text-blue-700 border-blue-200">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </span>
                  <span>{syncStatus.pending} pending sync</span>
                </div>
              )}
            </div>


            <NotificationBell />
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-medium text-gray-700">{session?.user.name}</span>
              <span className="text-xs text-gray-500">{session?.user.role}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6 xl:p-8 max-w-[1920px] mx-auto">
          <div className="animate-in fade-in duration-500">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
