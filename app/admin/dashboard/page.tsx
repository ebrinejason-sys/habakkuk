"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Users, Package, DollarSign, ShoppingCart, TrendingUp, AlertTriangle, Calendar } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

interface DashboardStats {
  totalUsers: number
  totalProducts: number
  totalRevenue: number
  todaySales: number
  lowStockCount: number
  pendingOrders: number
  expiringProducts: Array<{
    id: string
    name: string
    sku: string
    expiryDate: string
    quantity: number
  }>
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/admin/dashboard")
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error("Failed to fetch stats:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  const cards = [
    {
      title: "Total Users",
      value: stats?.totalUsers || 0,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Total Products",
      value: stats?.totalProducts || 0,
      icon: Package,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Total Revenue",
      value: formatCurrency(stats?.totalRevenue || 0),
      icon: DollarSign,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      title: "Today's Sales",
      value: formatCurrency(stats?.todaySales || 0),
      icon: TrendingUp,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
    {
      title: "Low Stock Items",
      value: stats?.lowStockCount || 0,
      icon: AlertTriangle,
      color: "text-red-600",
      bgColor: "bg-red-100",
    },
    {
      title: "Pending Orders",
      value: stats?.pendingOrders || 0,
      icon: ShoppingCart,
      color: "text-indigo-600",
      bgColor: "bg-indigo-100",
    },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-2">Welcome back! Here's what's happening today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {card.title}
                </CardTitle>
                <div className={`${card.bgColor} p-2 rounded-lg`}>
                  <Icon className={`h-5 w-5 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {stats?.expiringProducts && stats.expiringProducts.length > 0 && (
        <Card className="mt-6 border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center text-amber-800">
              <Calendar className="h-5 w-5 mr-2" />
              Products Expiring Soon (Next 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Expiry Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.expiringProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.sku}</TableCell>
                    <TableCell>{product.quantity}</TableCell>
                    <TableCell className="text-red-600 font-semibold">
                      {new Date(product.expiryDate).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
