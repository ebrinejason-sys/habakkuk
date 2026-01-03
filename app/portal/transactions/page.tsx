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
import { DollarSign, TrendingUp, Calendar, Filter, Download, Eye, Printer, X } from "lucide-react"

interface TransactionItem {
  id: string
  quantity: number
  unitPrice: number
  totalPrice: number
  product: {
    id: string
    name: string
    sku: string
    costPrice: number
  }
}

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
  items: TransactionItem[]
}

interface PharmacySettings {
  pharmacyName: string
  location: string
  contact: string
  email: string
  footerText?: string
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
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [settings, setSettings] = useState<PharmacySettings | null>(null)
  
  // Filter states
  const [cashierFilter, setCashierFilter] = useState("")
  const [paymentFilter, setPaymentFilter] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  useEffect(() => {
    fetchTransactions()
    fetchSettings()
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

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/admin/settings")
      if (response.ok) {
        const data = await response.json()
        setSettings(data)
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error)
    }
  }

  const printTransaction = (transaction: Transaction) => {
    const printWindow = window.open("", "", "width=800,height=1000")
    if (!printWindow) return

    const pharmacyName = settings?.pharmacyName || "Habakkuk Pharmacy"
    const location = settings?.location || ""
    const contact = settings?.contact || ""
    const email = settings?.email || ""
    const footerText = settings?.footerText || "Thank you for your purchase!"
    const currency = settings?.currency || "UGX"
    const logoImg = settings?.logo ? `<img src="${settings.logo}" alt="Logo" style="width: 60px; height: 60px; object-fit: contain;" />` : ""
    const transactionDate = new Date(transaction.createdAt)
    const subtotal = transaction.totalAmount
    const taxAmount = transaction.tax || 0
    const grandTotal = transaction.netAmount

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${transaction.transactionNo}</title>
        <style>
          @page { size: A4; margin: 10mm; }
          @media print { body { margin: 0; } }
          * { box-sizing: border-box; }
          body { 
            font-family: Arial, sans-serif; 
            padding: 10px;
            max-width: 210mm;
            margin: 0 auto;
            color: #000;
            font-size: 11px;
            line-height: 1.3;
          }
          .receipt-container {
            border: 1px solid #000;
            padding: 15px;
            background: #fff;
          }
          .header {
            text-align: center;
            border-bottom: 1px dashed #000;
            padding-bottom: 8px;
            margin-bottom: 8px;
          }
          .pharmacy-name {
            font-size: 16px;
            font-weight: 700;
            color: #000;
            margin: 5px 0 2px;
          }
          .pharmacy-info {
            font-size: 10px;
            color: #000;
            margin: 1px 0;
          }
          .receipt-title {
            text-align: center;
            margin: 8px 0;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 2px;
          }
          .receipt-info {
            display: flex;
            justify-content: space-between;
            border: 1px solid #000;
            padding: 6px 8px;
            margin-bottom: 8px;
            font-size: 10px;
          }
          .receipt-info-item {
            text-align: center;
          }
          .receipt-info-label {
            font-size: 8px;
            text-transform: uppercase;
          }
          .receipt-info-value {
            font-size: 10px;
            font-weight: 600;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 6px 0;
          }
          th {
            background: #000;
            color: #fff;
            padding: 4px 6px;
            text-align: left;
            font-weight: 600;
            font-size: 9px;
            text-transform: uppercase;
          }
          th:last-child { text-align: right; }
          td {
            padding: 4px 6px;
            border-bottom: 1px solid #ccc;
            font-size: 10px;
          }
          tr:last-child td { border-bottom: none; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .totals-section {
            border-top: 1px dashed #000;
            padding-top: 8px;
            margin-top: 6px;
          }
          .totals-table {
            width: 100%;
            max-width: 180px;
            margin-left: auto;
          }
          .totals-table td {
            padding: 2px 0;
            border: none;
            font-size: 10px;
          }
          .totals-table .total-row {
            font-size: 13px;
            font-weight: 700;
            border-top: 2px solid #000;
            padding-top: 4px;
          }
          .payment-info {
            border: 1px solid #000;
            padding: 6px 8px;
            margin: 8px 0;
            font-size: 10px;
          }
          .payment-row {
            display: flex;
            justify-content: space-between;
            margin: 2px 0;
          }
          .footer {
            text-align: center;
            border-top: 1px dashed #000;
            padding-top: 8px;
            margin-top: 8px;
          }
          .served-by {
            font-size: 10px;
            font-weight: 600;
            margin-bottom: 4px;
          }
          .thank-you {
            font-size: 10px;
            margin: 4px 0;
          }
          .footer-note {
            font-size: 9px;
            margin-top: 4px;
          }
          .item-name { font-weight: 600; }
          .item-sku { font-size: 8px; color: #666; }
        </style>
      </head>
      <body onload="window.print(); window.close();">
        <div class="receipt-container">
          <div class="header">
            ${logoImg}
            <h1 class="pharmacy-name">${pharmacyName}</h1>
            ${location ? `<p class="pharmacy-info">${location}</p>` : ""}
            ${contact ? `<p class="pharmacy-info">Tel: ${contact}${email ? ` | ${email}` : ""}</p>` : ""}
          </div>

          <div class="receipt-title">SALES RECEIPT</div>

          <div class="receipt-info">
            <div class="receipt-info-item">
              <div class="receipt-info-label">Receipt No</div>
              <div class="receipt-info-value">${transaction.transactionNo}</div>
            </div>
            <div class="receipt-info-item">
              <div class="receipt-info-label">Date</div>
              <div class="receipt-info-value">${transactionDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
            </div>
            <div class="receipt-info-item">
              <div class="receipt-info-label">Time</div>
              <div class="receipt-info-value">${transactionDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th class="text-center">Qty</th>
                <th class="text-right">Price</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${transaction.items.map(item => `
                <tr>
                  <td><span class="item-name">${item.product.name}</span>${item.product.sku ? `<br/><span class="item-sku">${item.product.sku}</span>` : ""}</td>
                  <td class="text-center">${item.quantity}</td>
                  <td class="text-right">${formatCurrency(item.unitPrice)}</td>
                  <td class="text-right"><strong>${formatCurrency(item.totalPrice)}</strong></td>
                </tr>
              `).join("")}
            </tbody>
          </table>

          <div class="totals-section">
            <table class="totals-table">
              <tr>
                <td>Subtotal</td>
                <td class="text-right">${formatCurrency(subtotal)}</td>
              </tr>
              ${taxAmount > 0 ? `
              <tr>
                <td>Tax</td>
                <td class="text-right">${formatCurrency(taxAmount)}</td>
              </tr>
              ` : ""}
              <tr class="total-row">
                <td>TOTAL</td>
                <td class="text-right">${formatCurrency(grandTotal)}</td>
              </tr>
            </table>
          </div>

          <div class="payment-info">
            <div class="payment-row">
              <span>Payment Method:</span>
              <strong>${transaction.paymentMethod === "MOBILE_MONEY" ? "Mobile Money" : transaction.paymentMethod}</strong>
            </div>
          </div>

          <div class="footer">
            <p class="served-by">Served by: ${transaction.user.name}</p>
            <p class="thank-you">${footerText}</p>
            <p class="footer-note">Keep this receipt for your records</p>
          </div>
        </div>
      </body>
      </html>
    `

    printWindow.document.write(html)
    printWindow.document.close()
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Transactions</h1>
        <p className="text-gray-500 mt-1 sm:mt-2 text-sm sm:text-base">View and track all sales transactions</p>
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
                <TableHead className="text-right">Actions</TableHead>
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
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedTransaction(transaction)}
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => printTransaction(transaction)}
                        title="Print Receipt"
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Transaction Details Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Transaction Details</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedTransaction(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-600">Transaction #</Label>
                  <p className="font-semibold">{selectedTransaction.transactionNo}</p>
                </div>
                <div>
                  <Label className="text-gray-600">Date & Time</Label>
                  <p className="font-semibold">{new Date(selectedTransaction.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-gray-600">Cashier</Label>
                  <p className="font-semibold">{selectedTransaction.user.name}</p>
                </div>
                <div>
                  <Label className="text-gray-600">Payment Method</Label>
                  <p className="font-semibold">
                    <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
                      {selectedTransaction.paymentMethod}
                    </span>
                  </p>
                </div>
              </div>

              <div>
                <Label className="text-gray-600 mb-2 block">Items Sold</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedTransaction.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.product.name}</TableCell>
                        <TableCell className="text-gray-500">{item.product.sku}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(item.totalPrice)}</TableCell>
                        <TableCell className="text-right text-green-600">
                          {formatCurrency((item.unitPrice - item.product.costPrice) * item.quantity)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between items-center text-lg">
                  <span>Total Amount:</span>
                  <span className="font-bold">{formatCurrency(selectedTransaction.netAmount)}</span>
                </div>
                <div className="flex justify-between items-center text-green-600 mt-2">
                  <span>Total Profit:</span>
                  <span className="font-bold">{formatCurrency(calculateProfit(selectedTransaction))}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => printTransaction(selectedTransaction)}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print Receipt
                </Button>
                <Button onClick={() => setSelectedTransaction(null)}>
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
