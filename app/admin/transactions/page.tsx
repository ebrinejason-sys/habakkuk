"use client"

import { useEffect, useState } from "react"

// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { DollarSign, TrendingUp, Calendar, Filter, Download } from "lucide-react"

interface Transaction {
  id: string
  transactionNo: string
  totalAmount: number
  netAmount: number
  paymentMethod: string
  createdAt: string
  user: {
    name: string
  }
  items: Array<{
    quantity: number
    unitPrice: number
    totalPrice: number
    product: {
      costPrice: number
    }
  }>
}

interface Stats {
  today: number
  week: number
  month: number
  todayProfit: number
  weekProfit: number
  monthProfit: number
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([])
  const [stats, setStats] = useState<Stats>({ 
    today: 0, week: 0, month: 0,
    todayProfit: 0, weekProfit: 0, monthProfit: 0
  })
  const [isLoading, setIsLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  
  // Filter states
  const [cashierFilter, setCashierFilter] = useState("")
  const [paymentFilter, setPaymentFilter] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  useEffect(() => {
    fetchTransactions()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [transactions, cashierFilter, paymentFilter, startDate, endDate])

  const applyFilters = () => {
    let filtered = [...transactions]

    if (cashierFilter) {
      filtered = filtered.filter(t => 
        t.user.name.toLowerCase().includes(cashierFilter.toLowerCase())
      )
    }

    if (paymentFilter) {
      filtered = filtered.filter(t => t.paymentMethod === paymentFilter)
    }

    if (startDate) {
      filtered = filtered.filter(t => 
        new Date(t.createdAt) >= new Date(startDate)
      )
    }

    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      filtered = filtered.filter(t => 
        new Date(t.createdAt) <= end
      )
    }

    setFilteredTransactions(filtered)
  }

  const calculateProfit = (transaction: Transaction) => {
    return transaction.items.reduce((total, item) => {
      const profit = (item.unitPrice - item.product.costPrice) * item.quantity
      return total + profit
    }, 0)
  }

  const clearFilters = () => {
    setCashierFilter("")
    setPaymentFilter("")
    setStartDate("")
    setEndDate("")
  }

  const fetchTransactions = async () => {
    try {
      const response = await fetch("/api/admin/transactions")
      const data = await response.json()
      setTransactions(data.transactions)
      setFilteredTransactions(data.transactions)
      setStats(data.stats)
    } catch (error) {
      console.error("Failed to fetch transactions:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
        <p className="text-gray-500 mt-2">View and track all sales transactions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today's Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.today)}</div>
            <p className="text-xs text-green-600 mt-1">
              Profit: {formatCurrency(stats.todayProfit)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.week)}</div>
            <p className="text-xs text-green-600 mt-1">
              Profit: {formatCurrency(stats.weekProfit)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.month)}</div>
            <p className="text-xs text-green-600 mt-1">
              Profit: {formatCurrency(stats.monthProfit)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Filters</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              {showFilters ? "Hide" : "Show"} Filters
            </Button>
          </div>
        </CardHeader>
        {showFilters && (
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cashier">Cashier</Label>
                <Input
                  id="cashier"
                  placeholder="Filter by cashier..."
                  value={cashierFilter}
                  onChange={(e) => setCashierFilter(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment">Payment Method</Label>
                <select
                  id="payment"
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  title="Filter by Payment Method"
                >
                  <option value="">All Methods</option>
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card</option>
                  <option value="MOBILE_MONEY">Mobile Money</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              Transactions ({filteredTransactions.length})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transaction #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Cashier</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell className="font-medium">{transaction.transactionNo}</TableCell>
                  <TableCell>{new Date(transaction.createdAt).toLocaleString()}</TableCell>
                  <TableCell>{transaction.user.name}</TableCell>
                  <TableCell>
                    <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
                      {transaction.paymentMethod}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(transaction.netAmount)}
                  </TableCell>
                  <TableCell className="text-right text-green-600 font-semibold">
                    {formatCurrency(calculateProfit(transaction))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
