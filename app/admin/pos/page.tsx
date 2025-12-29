"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency, generateTransactionNo } from "@/lib/utils"
import { Search, ShoppingCart, Trash2, Printer, Clock, Eye, Calculator } from "lucide-react"

interface Product {
  id: string
  name: string
  sku: string
  price: number
  quantity: number
  unitOfMeasure: string
  barcode?: string
}

interface CartItem extends Product {
  cartQuantity: number
  subtotal: number
}

interface Settings {
  pharmacyName: string
  location: string
  contact: string
  email: string
  logo?: string
  footerText?: string
  currency: string
  taxRate: number
}

export default function POSPage() {
  const { data: session } = useSession()
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<string>("CASH")
  const [isProcessing, setIsProcessing] = useState(false)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [showOrderDialog, setShowOrderDialog] = useState(false)
  const [showReceiptPreview, setShowReceiptPreview] = useState(false)
  const [amountPaid, setAmountPaid] = useState("")
  const { toast } = useToast()

  useEffect(() => {
    fetchProducts()
    fetchSettings()
  }, [])

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

  const fetchProducts = async () => {
    try {
      const response = await fetch("/api/admin/inventory")
      const data = await response.json()
      if (Array.isArray(data)) {
        setProducts(data.filter((p: Product) => p.quantity > 0))
      } else {
        setProducts([])
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch products",
      })
      setProducts([])
    }
  }

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const addToCart = (product: Product) => {
    const existingItem = cart.find((item) => item.id === product.id)
    
    if (existingItem) {
      if (existingItem.cartQuantity >= product.quantity) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Insufficient stock",
        })
        return
      }
      setCart(
        cart.map((item) =>
          item.id === product.id
            ? {
                ...item,
                cartQuantity: item.cartQuantity + 1,
                subtotal: (item.cartQuantity + 1) * item.price,
              }
            : item
        )
      )
    } else {
      setCart([
        ...cart,
        {
          ...product,
          cartQuantity: 1,
          subtotal: product.price,
        },
      ])
    }
  }

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.id !== productId))
  }

  const updateCartQuantity = (productId: string, quantity: number) => {
    const product = products.find((p) => p.id === productId)
    if (!product) return

    if (quantity > product.quantity) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Insufficient stock",
      })
      return
    }

    if (quantity <= 0) {
      removeFromCart(productId)
      return
    }

    setCart(
      cart.map((item) =>
        item.id === productId
          ? {
              ...item,
              cartQuantity: quantity,
              subtotal: quantity * item.price,
            }
          : item
      )
    )
  }

  const total = cart.reduce((sum, item) => sum + item.subtotal, 0)
  const taxRate = settings?.taxRate || 0
  const taxAmount = total * (taxRate / 100)
  const grandTotal = total + taxAmount
  const change = amountPaid ? parseFloat(amountPaid) - grandTotal : 0
  const staffName = session?.user?.name || "Staff"

  const processTransaction = async () => {
    if (cart.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Cart is empty",
      })
      return
    }

    setIsProcessing(true)

    try {
      const response = await fetch("/api/admin/pos/transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((item) => ({
            productId: item.id,
            quantity: item.cartQuantity,
            unitPrice: item.price,
          })),
          paymentMethod,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Success",
          description: "Transaction completed successfully",
        })
        
        // Print receipt
        printReceipt(data.transaction)
        
        // Clear cart and refresh
        setCart([])
        fetchProducts()
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to process transaction",
        })
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const printReceipt = (transaction: any) => {
    const printWindow = window.open("", "", "width=800,height=1000")
    if (!printWindow) return

    const pharmacyName = settings?.pharmacyName || "Habakkuk Pharmacy"
    const location = settings?.location || ""
    const contact = settings?.contact || ""
    const email = settings?.email || ""
    const footerText = settings?.footerText || "Thank you for your purchase!"
    const currency = settings?.currency || "UGX"
    const logoImg = settings?.logo ? `<img src="${settings.logo}" alt="Logo" style="width: 80px; height: 80px; object-fit: contain;" />` : ""
    const subtotal = total
    const transactionDate = new Date()

    const receiptHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${transaction.transactionNo}</title>
        <style>
          @page { 
            size: A4; 
            margin: 15mm;
          }
          @media print {
            body { margin: 0; }
          }
          * {
            box-sizing: border-box;
          }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            padding: 20px;
            max-width: 210mm;
            margin: 0 auto;
            color: #333;
            font-size: 14px;
            line-height: 1.6;
          }
          .receipt-container {
            border: 2px solid #e0e0e0;
            border-radius: 12px;
            padding: 30px;
            background: linear-gradient(to bottom, #fafafa, #fff);
          }
          .header {
            text-align: center;
            border-bottom: 2px dashed #ccc;
            padding-bottom: 20px;
            margin-bottom: 20px;
          }
          .header-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
          }
          .pharmacy-name {
            font-size: 28px;
            font-weight: 700;
            color: #1a1a1a;
            margin: 10px 0 5px;
            letter-spacing: 1px;
          }
          .pharmacy-location {
            font-size: 14px;
            color: #666;
            margin: 2px 0;
          }
          .pharmacy-contact {
            font-size: 13px;
            color: #555;
          }
          .receipt-title {
            text-align: center;
            margin: 25px 0;
          }
          .receipt-title h2 {
            font-size: 22px;
            font-weight: 600;
            color: #2563eb;
            margin: 0;
            letter-spacing: 3px;
          }
          .receipt-info {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 25px;
          }
          .receipt-info-item {
            text-align: center;
          }
          .receipt-info-label {
            font-size: 11px;
            color: #888;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .receipt-info-value {
            font-size: 14px;
            font-weight: 600;
            color: #333;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          th {
            background: #2563eb;
            color: white;
            padding: 12px 10px;
            text-align: left;
            font-weight: 600;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          th:first-child {
            border-radius: 6px 0 0 6px;
          }
          th:last-child {
            border-radius: 0 6px 6px 0;
            text-align: right;
          }
          td {
            padding: 12px 10px;
            border-bottom: 1px solid #eee;
            font-size: 14px;
          }
          tr:last-child td {
            border-bottom: none;
          }
          tr:hover {
            background: #fafafa;
          }
          .text-right {
            text-align: right;
          }
          .text-center {
            text-align: center;
          }
          .totals-section {
            border-top: 2px dashed #ccc;
            padding-top: 20px;
            margin-top: 20px;
          }
          .totals-table {
            width: 100%;
            max-width: 350px;
            margin-left: auto;
          }
          .totals-table td {
            padding: 8px 0;
            border: none;
          }
          .totals-table .total-row {
            font-size: 20px;
            font-weight: 700;
            color: #2563eb;
            border-top: 2px solid #2563eb;
            padding-top: 15px;
          }
          .payment-info {
            background: #f0f9ff;
            border: 1px solid #bae6fd;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
          }
          .payment-row {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
          }
          .change-amount {
            color: #16a34a;
            font-weight: 600;
          }
          .footer {
            text-align: center;
            border-top: 2px dashed #ccc;
            padding-top: 25px;
            margin-top: 30px;
          }
          .served-by {
            font-size: 14px;
            font-weight: 600;
            color: #333;
            margin-bottom: 10px;
          }
          .thank-you {
            font-size: 16px;
            font-weight: 500;
            color: #16a34a;
            margin: 15px 0;
          }
          .footer-note {
            font-size: 12px;
            color: #888;
            margin-top: 10px;
          }
          .barcode-section {
            text-align: center;
            margin-top: 20px;
            padding-top: 15px;
            border-top: 1px solid #eee;
          }
          .transaction-code {
            font-family: 'Courier New', monospace;
            font-size: 16px;
            letter-spacing: 2px;
            color: #666;
          }
        </style>
      </head>
      <body onload="window.print(); window.close();">
        <div class="receipt-container">
          <div class="header">
            <div class="header-content">
              ${logoImg}
              <div>
                <h1 class="pharmacy-name">${pharmacyName}</h1>
                ${location ? `<p class="pharmacy-location">${location}</p>` : ""}
                ${contact ? `<p class="pharmacy-contact">Tel: ${contact}${email ? ` | ${email}` : ""}</p>` : ""}
              </div>
            </div>
          </div>

          <div class="receipt-title">
            <h2>SALES RECEIPT</h2>
          </div>

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
                <th>Item Description</th>
                <th class="text-center">Qty</th>
                <th class="text-right">Unit Price</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
            ${cart.map((item, index) => `
              <tr>
                <td><strong>${item.name}</strong><br/><span style="font-size: 12px; color: #888;">${item.sku || ""}</span></td>
                <td class="text-center">${item.cartQuantity} ${item.unitOfMeasure || ""}</td>
                <td class="text-right">${formatCurrency(item.price, currency)}</td>
                <td class="text-right"><strong>${formatCurrency(item.subtotal, currency)}</strong></td>
              </tr>
            `).join("")}
            </tbody>
          </table>

          <div class="totals-section">
            <table class="totals-table">
              <tr>
                <td>Subtotal</td>
                <td class="text-right">${formatCurrency(subtotal, currency)}</td>
              </tr>
              ${taxRate > 0 ? `
              <tr>
                <td>Tax (${taxRate}%)</td>
                <td class="text-right">${formatCurrency(taxAmount, currency)}</td>
              </tr>
              ` : ""}
              <tr class="total-row">
                <td>TOTAL</td>
                <td class="text-right">${formatCurrency(grandTotal, currency)}</td>
              </tr>
            </table>
          </div>

          <div class="payment-info">
            <div class="payment-row">
              <span>Payment Method:</span>
              <strong>${paymentMethod === "MOBILE_MONEY" ? "Mobile Money" : paymentMethod}</strong>
            </div>
            ${paymentMethod === "CASH" && amountPaid ? `
            <div class="payment-row">
              <span>Amount Paid:</span>
              <strong>${formatCurrency(parseFloat(amountPaid), currency)}</strong>
            </div>
            <div class="payment-row">
              <span>Change:</span>
              <strong class="change-amount">${formatCurrency(Math.max(0, change), currency)}</strong>
            </div>
            ` : ""}
          </div>

          <div class="footer">
            <p class="served-by">Served by: ${staffName}</p>
            <p class="thank-you">${footerText}</p>
            <p class="footer-note">Please keep this receipt for your records</p>
            <div class="barcode-section">
              <p class="transaction-code">${transaction.transactionNo}</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `

    printWindow.document.write(receiptHTML)
    printWindow.document.close()
  }

  const saveAsOrder = () => {
    if (cart.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Cart is empty",
      })
      return
    }
    setShowOrderDialog(true)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Point of Sale</h1>
        <p className="text-gray-500 mt-2">Process sales and generate receipts</p>
      </div>

      {showOrderDialog && (
        <SaveOrderDialog
          cart={cart}
          onClose={() => setShowOrderDialog(false)}
          onSuccess={() => {
            setCart([])
            setShowOrderDialog(false)
            fetchProducts()
          }}
        />
      )}

      {showReceiptPreview && (
        <ReceiptPreviewDialog
          cart={cart}
          settings={settings}
          total={total}
          taxRate={taxRate}
          taxAmount={taxAmount}
          grandTotal={grandTotal}
          amountPaid={amountPaid}
          change={change}
          paymentMethod={paymentMethod}
          staffName={staffName}
          onClose={() => setShowReceiptPreview(false)}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Products</CardTitle>
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, SKU, or scan barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="p-4 border rounded-lg hover:bg-gray-50 text-left transition-colors"
                  >
                    <div className="font-medium text-sm">{product.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{product.sku}</div>
                    <div className="text-primary font-semibold mt-2">
                      {formatCurrency(product.price)}
                    </div>
                    <div className="text-xs text-gray-500">Stock: {product.quantity}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cart */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <ShoppingCart className="h-5 w-5 mr-2" />
                Cart ({cart.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                {cart.map((item) => (
                  <div key={item.id} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{item.name}</div>
                        <div className="text-xs text-gray-500">{formatCurrency(item.price)}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFromCart(item.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <Input
                        type="number"
                        min="1"
                        value={item.cartQuantity}
                        onChange={(e) =>
                          updateCartQuantity(item.id, parseInt(e.target.value))
                        }
                        className="w-20 h-8"
                      />
                      <div className="font-semibold">{formatCurrency(item.subtotal)}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t mt-4 pt-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatCurrency(total)}</span>
                </div>
                {taxRate > 0 && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Tax ({taxRate}%)</span>
                    <span>{formatCurrency(taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(grandTotal)}</span>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    title="Select Payment Method"
                    aria-label="Payment Method"
                  >
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                    <option value="MOBILE_MONEY">Mobile Money</option>
                  </select>
                </div>

                {paymentMethod === "CASH" && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center">
                      <Calculator className="h-4 w-4 mr-1" />
                      Amount Paid
                    </label>
                    <Input
                      type="number"
                      placeholder="Enter amount paid"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                    />
                    {amountPaid && parseFloat(amountPaid) >= grandTotal && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                        <div className="flex justify-between text-green-800 font-semibold">
                          <span>Change</span>
                          <span>{formatCurrency(change)}</span>
                        </div>
                      </div>
                    )}
                    {amountPaid && parseFloat(amountPaid) < grandTotal && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                        <div className="text-red-800 text-sm">
                          Insufficient amount. Need {formatCurrency(grandTotal - parseFloat(amountPaid))} more.
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowReceiptPreview(true)}
                  disabled={cart.length === 0}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview Receipt
                </Button>

                <Button
                  onClick={processTransaction}
                  className="w-full"
                  disabled={isProcessing || cart.length === 0 || (paymentMethod === "CASH" && !!amountPaid && parseFloat(amountPaid) < grandTotal)}
                >
                  {isProcessing ? "Processing..." : "Complete Sale"}
                </Button>

                <Button
                  onClick={saveAsOrder}
                  variant="outline"
                  className="w-full"
                  disabled={cart.length === 0}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Save as Order (Tab)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

interface SaveOrderDialogProps {
  cart: CartItem[]
  onClose: () => void
  onSuccess: () => void
}

function SaveOrderDialog({ cart, onClose, onSuccess }: SaveOrderDialogProps) {
  const [customers, setCustomers] = useState<any[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState("")
  const [notes, setNotes] = useState("")
  const [deliveryAddress, setDeliveryAddress] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    try {
      const response = await fetch("/api/admin/customers")
      const data = await response.json()
      if (Array.isArray(data)) {
        setCustomers(data)
      } else {
        setCustomers([])
      }
    } catch (error) {
      console.error("Failed to fetch customers:", error)
      setCustomers([])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedCustomer) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a customer",
      })
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer,
          items: cart.map((item) => ({
            productId: item.id,
            quantity: item.cartQuantity,
          })),
          notes,
          deliveryAddress,
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Order saved successfully",
        })
        onSuccess()
      } else {
        const data = await response.json()
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to save order",
        })
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Save as Order</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customer">Customer *</Label>
              <select
                id="customer"
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
                title="Select Customer"
              >
                <option value="">Select Customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} - {customer.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deliveryAddress">Delivery Address</Label>
              <Input
                id="deliveryAddress"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="border-t pt-4">
              <div className="text-sm space-y-1 mb-3">
                <div className="flex justify-between">
                  <span>Items:</span>
                  <span>{cart.length}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Total:</span>
                  <span>{formatCurrency(cart.reduce((sum, item) => sum + item.subtotal, 0))}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : "Save Order"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

interface ReceiptPreviewDialogProps {
  cart: CartItem[]
  settings: Settings | null
  total: number
  taxRate: number
  taxAmount: number
  grandTotal: number
  amountPaid: string
  change: number
  paymentMethod: string
  staffName: string
  onClose: () => void
}

function ReceiptPreviewDialog({
  cart,
  settings,
  total,
  taxRate,
  taxAmount,
  grandTotal,
  amountPaid,
  change,
  paymentMethod,
  staffName,
  onClose,
}: ReceiptPreviewDialogProps) {
  const currency = settings?.currency || "UGX"
  const pharmacyName = settings?.pharmacyName || "Habakkuk Pharmacy"
  const location = settings?.location || ""
  const contact = settings?.contact || ""
  const email = settings?.email || ""
  const footerText = settings?.footerText || "Thank you for your purchase!"
  const currentDate = new Date()

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <Card className="w-full max-w-2xl my-8">
        <CardHeader className="pb-2 flex flex-row items-center justify-between border-b">
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            A4 Receipt Preview
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>×</Button>
        </CardHeader>
        <CardContent className="p-6">
          {/* Receipt Preview - A4 Style */}
          <div className="border-2 border-gray-200 rounded-xl p-6 bg-gradient-to-b from-gray-50 to-white">
            {/* Header */}
            <div className="text-center border-b-2 border-dashed border-gray-300 pb-5 mb-5">
              {settings?.logo && (
                <img 
                  src={settings.logo} 
                  alt="Logo" 
                  className="w-20 h-20 mx-auto object-contain mb-3"
                />
              )}
              <h2 className="text-2xl font-bold text-gray-900 tracking-wide">{pharmacyName}</h2>
              {location && <p className="text-sm text-gray-600 mt-1">{location}</p>}
              {contact && <p className="text-sm text-gray-500">Tel: {contact}{email ? ` | ${email}` : ""}</p>}
            </div>

            {/* Receipt Title */}
            <div className="text-center mb-5">
              <h3 className="text-xl font-semibold text-blue-600 tracking-[0.2em]">SALES RECEIPT</h3>
            </div>

            {/* Receipt Info */}
            <div className="grid grid-cols-3 gap-3 bg-gray-100 rounded-lg p-3 mb-5">
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Receipt No</p>
                <p className="font-semibold text-sm">TXN-PREVIEW</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Date</p>
                <p className="font-semibold text-sm">{currentDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Time</p>
                <p className="font-semibold text-sm">{currentDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>

            {/* Items Table */}
            <div className="mb-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="text-left py-2 px-3 rounded-l-lg font-medium">Item</th>
                    <th className="text-center py-2 px-3 font-medium">Qty</th>
                    <th className="text-right py-2 px-3 font-medium">Price</th>
                    <th className="text-right py-2 px-3 rounded-r-lg font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100">
                      <td className="py-2 px-3">
                        <span className="font-medium">{item.name}</span>
                        {item.sku && <span className="text-xs text-gray-400 block">{item.sku}</span>}
                      </td>
                      <td className="text-center py-2 px-3">{item.cartQuantity}</td>
                      <td className="text-right py-2 px-3">{formatCurrency(item.price, currency)}</td>
                      <td className="text-right py-2 px-3 font-semibold">{formatCurrency(item.subtotal, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="border-t-2 border-dashed border-gray-300 pt-4">
              <div className="max-w-xs ml-auto space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatCurrency(total, currency)}</span>
                </div>
                {taxRate > 0 && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Tax ({taxRate}%)</span>
                    <span>{formatCurrency(taxAmount, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold text-blue-600 border-t-2 border-blue-600 pt-2 mt-2">
                  <span>TOTAL</span>
                  <span>{formatCurrency(grandTotal, currency)}</span>
                </div>
              </div>
            </div>

            {/* Payment Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 my-4">
              <div className="flex justify-between text-sm">
                <span>Payment Method:</span>
                <span className="font-semibold">{paymentMethod === "MOBILE_MONEY" ? "Mobile Money" : paymentMethod}</span>
              </div>
              {paymentMethod === "CASH" && amountPaid && (
                <>
                  <div className="flex justify-between text-sm mt-1">
                    <span>Amount Paid:</span>
                    <span className="font-semibold">{formatCurrency(parseFloat(amountPaid), currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span>Change:</span>
                    <span className="font-semibold text-green-600">{formatCurrency(Math.max(0, change), currency)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="text-center border-t-2 border-dashed border-gray-300 pt-5 mt-5 space-y-2">
              <p className="font-semibold text-gray-800">Served by: {staffName}</p>
              <p className="text-green-600 font-medium">{footerText}</p>
              <p className="text-xs text-gray-500">Please keep this receipt for your records</p>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button onClick={onClose}>Close Preview</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
