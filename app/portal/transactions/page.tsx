"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"

// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { DollarSign, TrendingUp, Calendar, Filter, Download, Eye, Printer, X, RotateCcw, Edit, AlertTriangle } from "lucide-react"

interface TransactionItem {
  id: string
  quantity: number
  unitPrice: number
  costPrice?: number  // Cost price at time of sale
  totalPrice: number
  product: {
    id: string
    name: string
    sku: string
    costPrice: number
    expiryDate?: string
    batchNumber?: string
  }
}

interface Transaction {
  id: string
  transactionNo: string
  totalAmount: number
  netAmount: number
  discount?: number
  tax?: number
  paymentMethod: string
  isEdited?: boolean
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
  currency?: string
  logo?: string
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
  const { data: session } = useSession()
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
  const [isResetting, setIsResetting] = useState(false)

  // Edit transaction state
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [editItems, setEditItems] = useState<{ id: string, quantity: number, unitPrice: number, productName: string }[]>([])
  const [editPaymentMethod, setEditPaymentMethod] = useState("")
  const [editReason, setEditReason] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  // Delete transaction state
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Check if current user is admin
  const isAdmin = session?.user?.role === "ADMIN"

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
      // Use stored costPrice if available, otherwise fall back to current product cost
      const costAtSale = item.costPrice ?? item.product.costPrice
      const profit = (item.unitPrice - costAtSale) * Math.abs(item.quantity)
      return total + profit
    }, 0)
  }

  const clearFilters = () => {
    setCashierFilter("")
    setPaymentFilter("")
    setStartDate("")
    setEndDate("")
  }

  const handleResetTransactions = async () => {
    if (!confirm("⚠️ WARNING: This will permanently delete ALL sales transactions and cannot be undone. Are you absolutely sure you want to reset all sales to zero?")) {
      return
    }

    // Double confirmation
    if (!confirm("This is your FINAL confirmation. ALL transaction data will be permanently deleted. Continue?")) {
      return
    }

    setIsResetting(true)
    try {
      const response = await fetch("/api/admin/transactions", {
        method: "DELETE",
      })

      if (response.ok) {
        const data = await response.json()
        alert(`Successfully reset. ${data.deletedCount} transactions deleted.`)
        fetchTransactions()
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || "Failed to reset transactions"}`)
      }
    } catch (error) {
      console.error("Reset error:", error)
      alert("An error occurred while resetting transactions")
    } finally {
      setIsResetting(false)
    }
  }

  const handleDeleteTransaction = async () => {
    if (!transactionToDelete) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/admin/transactions/${transactionToDelete.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        const data = await response.json()
        alert(`Transaction ${transactionToDelete.transactionNo} has been successfully deleted. Stock levels have been restored.`)
        setTransactionToDelete(null)
        fetchTransactions()
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || "Failed to delete transaction"}`)
      }
    } catch (error) {
      console.error("Delete error:", error)
      alert("An error occurred while deleting the transaction")
    } finally {
      setIsDeleting(false)
    }
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

  // Start editing a transaction
  const startEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction)
    setEditItems(transaction.items.map(item => ({
      id: item.id,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      productName: item.product.name
    })))
    setEditPaymentMethod(transaction.paymentMethod)
    setEditReason("")
  }

  // Handle item change during edit
  const handleEditItemChange = (id: string, field: "quantity" | "unitPrice", value: number) => {
    setEditItems(prev => prev.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ))
  }

  // Save edited transaction
  const saveEditedTransaction = async () => {
    if (!editingTransaction) return

    if (!editReason || editReason.trim().length < 10) {
      alert("Please provide a reason for the edit (minimum 10 characters)")
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch(`/api/admin/transactions/${editingTransaction.id}/edit`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: editItems.map(item => ({
            id: item.id,
            quantity: item.quantity,
            unitPrice: item.unitPrice
          })),
          paymentMethod: editPaymentMethod,
          reason: editReason.trim()
        })
      })

      if (response.ok) {
        const data = await response.json()
        alert("Transaction updated successfully! CEO and Admin have been notified.")
        setEditingTransaction(null)
        setEditReason("")
        fetchTransactions()

        // Auto-print the updated receipt
        if (data.transaction && confirm("Would you like to print the updated receipt?")) {
          printTransaction(data.transaction)
        }
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || "Failed to update transaction"}`)
      }
    } catch (error) {
      console.error("Save edit error:", error)
      alert("An error occurred while saving changes")
    } finally {
      setIsSaving(false)
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
          .edited-watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 48px;
            font-weight: bold;
            color: rgba(255, 165, 0, 0.15);
            pointer-events: none;
            z-index: 0;
            white-space: nowrap;
          }
          .edited-banner {
            background: #fef3c7;
            border: 2px solid #f59e0b;
            color: #92400e;
            padding: 8px;
            text-align: center;
            font-weight: bold;
            margin-bottom: 10px;
          }
          .receipt-container { position: relative; }
        </style>
      </head>
      <body onload="window.print(); window.close();">
        <div class="receipt-container">
          ${transaction.isEdited ? `
            <div class="edited-watermark">EDITED</div>
            <div class="edited-banner">⚠️ EDITED RECEIPT - Original transaction modified</div>
          ` : ''}
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
                  <td>
                    <span class="item-name">${item.product.name}</span>
                    ${item.product.sku ? `<br/><span class="item-sku">${item.product.sku}</span>` : ""}
                    ${item.product.expiryDate ? `<br/><span class="item-sku">Exp: ${new Date(item.product.expiryDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>` : ""}
                  </td>
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
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Transactions</h1>
          <p className="text-gray-500 mt-1 sm:mt-2 text-sm sm:text-base">View and track all sales transactions</p>
        </div>
        {isAdmin && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleResetTransactions}
            disabled={isResetting}
          >
            <RotateCcw className={`h-4 w-4 mr-2 ${isResetting ? 'animate-spin' : ''}`} />
            {isResetting ? "Resetting..." : "Reset All Transactions"}
          </Button>
        )}
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
                <TableRow key={transaction.id} className={transaction.isEdited ? "bg-amber-50" : ""}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {transaction.transactionNo}
                      {transaction.isEdited && (
                        <span className="px-1.5 py-0.5 text-xs rounded bg-amber-100 text-amber-700 font-medium">
                          EDITED
                        </span>
                      )}
                    </div>
                  </TableCell>
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
                        onClick={() => startEditTransaction(transaction)}
                        title="Edit Transaction"
                        className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => printTransaction(transaction)}
                        title="Print Receipt"
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setTransactionToDelete(transaction)}
                          title="Delete Transaction"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
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

      {/* Edit Transaction Modal */}
      {editingTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="bg-amber-50 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <CardTitle className="text-amber-900">Edit Transaction</CardTitle>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setEditingTransaction(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-amber-700 mt-1">
                Editing {editingTransaction.transactionNo} - CEO and Admin will be notified
              </p>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {/* Warning */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800">
                  <strong>⚠️ Important:</strong> All edits are logged and CEO/Admin will receive priority notifications.
                  Stock levels will be adjusted based on quantity changes.
                </p>
              </div>

              {/* Edit Items */}
              <div>
                <Label className="text-gray-600 mb-2 block">Items</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="w-24">Qty</TableHead>
                      <TableHead className="w-32">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {editItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.productName}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleEditItemChange(item.id, "quantity", parseInt(e.target.value) || 1)}
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="100"
                            value={item.unitPrice}
                            onChange={(e) => handleEditItemChange(item.id, "unitPrice", parseFloat(e.target.value) || 0)}
                            className="w-28"
                          />
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(item.quantity * item.unitPrice)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Payment Method */}
              <div className="space-y-2">
                <Label htmlFor="editPaymentMethod">Payment Method</Label>
                <select
                  id="editPaymentMethod"
                  value={editPaymentMethod}
                  onChange={(e) => setEditPaymentMethod(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card</option>
                  <option value="MOBILE_MONEY">Mobile Money</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>
              </div>

              {/* New Total */}
              <div className="bg-gray-100 p-4 rounded-lg">
                <div className="flex justify-between items-center text-lg">
                  <span>New Total:</span>
                  <span className="font-bold">
                    {formatCurrency(editItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0))}
                  </span>
                </div>
              </div>

              {/* Reason - REQUIRED */}
              <div className="space-y-2">
                <Label htmlFor="editReason" className="text-red-600 font-semibold">
                  Reason for Edit * (Required - minimum 10 characters)
                </Label>
                <textarea
                  id="editReason"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Please explain why you are editing this transaction..."
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  required
                />
                <p className="text-xs text-gray-500">
                  {editReason.length}/10 characters minimum
                </p>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setEditingTransaction(null)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  onClick={saveEditedTransaction}
                  disabled={isSaving || editReason.trim().length < 10}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  {isSaving ? "Saving..." : "Save Changes & Notify CEO/Admin"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Transaction Confirmation Modal */}
      {transactionToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <CardTitle className="text-red-600">Delete Transaction</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTransactionToDelete(null)}
                  disabled={isDeleting}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800 font-semibold mb-2">
                  Are you sure you want to delete this transaction?
                </p>
                <div className="space-y-2 text-sm text-red-700">
                  <p>
                    <strong>Transaction:</strong> {transactionToDelete.transactionNo}
                  </p>
                  <p>
                    <strong>Amount:</strong> {formatCurrency(transactionToDelete.netAmount)}
                  </p>
                  <p>
                    <strong>Date:</strong> {new Date(transactionToDelete.createdAt).toLocaleString()}
                  </p>
                  <p>
                    <strong>Cashier:</strong> {transactionToDelete.user.name}
                  </p>
                  <p>
                    <strong>Items:</strong> {transactionToDelete.items.length}
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> When deleted, stock levels will be automatically restored and all admins will be notified.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setTransactionToDelete(null)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteTransaction}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Delete Transaction"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
