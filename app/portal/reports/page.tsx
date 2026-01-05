"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { 
  BarChart3, 
  TrendingUp, 
  Package, 
  DollarSign, 
  Download,
  Calendar,
  Users,
  AlertTriangle,
  Clock
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"

export const dynamic = 'force-dynamic'

type ReportType = "sales" | "inventory" | "profit"
type Period = "today" | "yesterday" | "week" | "month" | "year" | "custom"

interface SalesReport {
  type: "sales"
  summary: {
    totalSales: number
    totalDiscount: number
    totalTax: number
    transactionCount: number
    averageTransaction: number
  }
  salesByPaymentMethod: Array<{
    paymentMethod: string
    _sum: { netAmount: number }
    _count: number
  }>
  salesByDay: Array<{ date: string; total: number; count: number }>
  topProducts: Array<{
    productId: string
    _sum: { quantity: number; totalPrice: number }
    product: { id: string; name: string; sku: string }
  }>
  salesByUser: Array<{
    userId: string
    _sum: { netAmount: number }
    _count: number
    user: { id: string; name: string }
  }>
}

interface InventoryReport {
  type: "inventory"
  summary: {
    totalProducts: number
    totalUnits: number
    inventoryValueAtCost: number
    inventoryValueAtRetail: number
    potentialProfit: number
    lowStockCount: number
    outOfStockCount: number
    expiringCount: number
    expiredCount: number
  }
  lowStockProducts: Array<{
    id: string
    name: string
    sku: string
    quantity: number
    reorderLevel: number
  }>
  expiringProducts: Array<{
    id: string
    name: string
    sku: string
    quantity: number
    expiryDate: string
  }>
  expiredProducts: Array<{
    id: string
    name: string
    sku: string
    quantity: number
    expiryDate: string
  }>
  productsByCategory: Array<{
    category: string
    _count: number
    _sum: { quantity: number }
  }>
}

interface ProfitReport {
  type: "profit"
  summary: {
    totalRevenue: number
    totalCost: number
    grossProfit: number
    profitMargin: number
    transactionCount: number
  }
  profitByProduct: Array<{
    name: string
    revenue: number
    cost: number
    profit: number
    quantity: number
  }>
}

type Report = SalesReport | InventoryReport | ProfitReport

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>("sales")
  const [period, setPeriod] = useState<Period>("today")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [report, setReport] = useState<Report | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchReport()
  }, [reportType, period])

  const fetchReport = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        type: reportType,
        period,
        ...(period === "custom" && startDate && { startDate }),
        ...(period === "custom" && endDate && { endDate }),
      })
      
      const response = await fetch(`/api/admin/reports?${params}`)
      if (!response.ok) throw new Error("Failed to fetch report")
      const data = await response.json()
      setReport(data)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load report",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const exportToCSV = () => {
    if (!report) return
    
    let csvContent = ""
    
    if (report.type === "sales") {
      csvContent = "Date,Total Sales,Transactions,Average\n"
      csvContent += `Summary,${(report as SalesReport).summary.totalSales},${(report as SalesReport).summary.transactionCount},${(report as SalesReport).summary.averageTransaction}\n`
    } else if (report.type === "inventory") {
      csvContent = "Product,SKU,Quantity,Status\n"
      ;(report as InventoryReport).lowStockProducts.forEach(p => {
        csvContent += `${p.name},${p.sku},${p.quantity},Low Stock\n`
      })
    } else if (report.type === "profit") {
      csvContent = "Product,Revenue,Cost,Profit,Quantity\n"
      ;(report as ProfitReport).profitByProduct.forEach(p => {
        csvContent += `${p.name},${p.revenue},${p.cost},${p.profit},${p.quantity}\n`
      })
    }

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${reportType}-report-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reports & Analytics</h1>
          <p className="text-gray-500">View detailed business reports</p>
        </div>
        <Button onClick={exportToCSV} disabled={!report}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            {/* Report Type */}
            <div className="space-y-2">
              <Label>Report Type</Label>
              <div className="flex gap-2">
                {[
                  { value: "sales", label: "Sales", icon: DollarSign },
                  { value: "inventory", label: "Inventory", icon: Package },
                  { value: "profit", label: "Profit", icon: TrendingUp },
                ].map((type) => (
                  <Button
                    key={type.value}
                    variant={reportType === type.value ? "default" : "outline"}
                    onClick={() => setReportType(type.value as ReportType)}
                    className="gap-2"
                  >
                    <type.icon className="h-4 w-4" />
                    {type.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Period */}
            <div className="space-y-2">
              <Label>Period</Label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: "today", label: "Today" },
                  { value: "yesterday", label: "Yesterday" },
                  { value: "week", label: "This Week" },
                  { value: "month", label: "This Month" },
                  { value: "year", label: "This Year" },
                  { value: "custom", label: "Custom" },
                ].map((p) => (
                  <Button
                    key={p.value}
                    variant={period === p.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPeriod(p.value as Period)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Custom Date Range */}
            {period === "custom" && (
              <div className="flex gap-4 items-end">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
                <Button onClick={fetchReport}>Apply</Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {/* Sales Report */}
      {!isLoading && report?.type === "sales" && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency((report as SalesReport).summary.totalSales)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Transactions</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(report as SalesReport).summary.transactionCount}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Sale</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency((report as SalesReport).summary.averageTransaction)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Discounts Given</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency((report as SalesReport).summary.totalDiscount)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sales by Payment Method */}
          <Card>
            <CardHeader>
              <CardTitle>Sales by Payment Method</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment Method</TableHead>
                    <TableHead className="text-right">Transactions</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(report as SalesReport).salesByPaymentMethod.map((method) => (
                    <TableRow key={method.paymentMethod}>
                      <TableCell className="font-medium">{method.paymentMethod}</TableCell>
                      <TableCell className="text-right">{method._count}</TableCell>
                      <TableCell className="text-right">{formatCurrency(method._sum.netAmount || 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Top Products & Sales by User */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top Selling Products</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(report as SalesReport).topProducts.slice(0, 10).map((item) => (
                      <TableRow key={item.productId}>
                        <TableCell className="font-medium">{item.product?.name || "Unknown"}</TableCell>
                        <TableCell className="text-right">{item._sum.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item._sum.totalPrice || 0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sales by Staff</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff</TableHead>
                      <TableHead className="text-right">Transactions</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(report as SalesReport).salesByUser.map((user) => (
                      <TableRow key={user.userId}>
                        <TableCell className="font-medium">{user.user?.name || "Unknown"}</TableCell>
                        <TableCell className="text-right">{user._count}</TableCell>
                        <TableCell className="text-right">{formatCurrency(user._sum.netAmount || 0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Inventory Report */}
      {!isLoading && report?.type === "inventory" && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(report as InventoryReport).summary.totalProducts}</div>
                <p className="text-xs text-muted-foreground">
                  {(report as InventoryReport).summary.totalUnits} total units
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Inventory Value (Cost)</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency((report as InventoryReport).summary.inventoryValueAtCost)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Inventory Value (Retail)</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency((report as InventoryReport).summary.inventoryValueAtRetail)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Potential Profit</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency((report as InventoryReport).summary.potentialProfit)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Alert Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <span className="font-medium">Low Stock</span>
                </div>
                <div className="text-3xl font-bold text-yellow-700 mt-2">
                  {(report as InventoryReport).summary.lowStockCount}
                </div>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-red-600" />
                  <span className="font-medium">Out of Stock</span>
                </div>
                <div className="text-3xl font-bold text-red-700 mt-2">
                  {(report as InventoryReport).summary.outOfStockCount}
                </div>
              </CardContent>
            </Card>
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-orange-600" />
                  <span className="font-medium">Expiring Soon</span>
                </div>
                <div className="text-3xl font-bold text-orange-700 mt-2">
                  {(report as InventoryReport).summary.expiringCount}
                </div>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <span className="font-medium">Expired</span>
                </div>
                <div className="text-3xl font-bold text-red-700 mt-2">
                  {(report as InventoryReport).summary.expiredCount}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Low Stock & Expiring Products Tables */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Low Stock Products
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(report as InventoryReport).lowStockProducts.slice(0, 10).map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>{product.sku}</TableCell>
                        <TableCell className="text-right text-yellow-600 font-bold">{product.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-orange-500" />
                  Expiring Products (30 days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Expiry Date</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(report as InventoryReport).expiringProducts.slice(0, 10).map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>{new Date(product.expiryDate).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">{product.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Expired Products */}
          {(report as InventoryReport).expiredProducts.length > 0 && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  Expired Products - Action Required!
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Expired On</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(report as InventoryReport).expiredProducts.map((product) => (
                      <TableRow key={product.id} className="bg-red-50">
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>{product.sku}</TableCell>
                        <TableCell className="text-red-600">{new Date(product.expiryDate).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right text-red-600 font-bold">{product.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Products by Category */}
          <Card>
            <CardHeader>
              <CardTitle>Products by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Products</TableHead>
                    <TableHead className="text-right">Total Units</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(report as InventoryReport).productsByCategory.map((cat) => (
                    <TableRow key={cat.category}>
                      <TableCell className="font-medium">{cat.category}</TableCell>
                      <TableCell className="text-right">{cat._count}</TableCell>
                      <TableCell className="text-right">{cat._sum.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Profit Report */}
      {!isLoading && report?.type === "profit" && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency((report as ProfitReport).summary.totalRevenue)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency((report as ProfitReport).summary.totalCost)}</div>
              </CardContent>
            </Card>
            <Card className="bg-green-50 border-green-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency((report as ProfitReport).summary.grossProfit)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(report as ProfitReport).summary.profitMargin.toFixed(1)}%
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Profit by Product */}
          <Card>
            <CardHeader>
              <CardTitle>Profit by Product</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty Sold</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(report as ProfitReport).profitByProduct.map((product, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="text-right">{product.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(product.revenue)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(product.cost)}</TableCell>
                      <TableCell className={`text-right font-bold ${product.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(product.profit)}
                      </TableCell>
                      <TableCell className="text-right">
                        {product.revenue > 0 ? ((product.profit / product.revenue) * 100).toFixed(1) : 0}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
