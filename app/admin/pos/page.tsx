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
    const printWindow = window.open("", "", "width=300,height=600")
    if (!printWindow) return

    const pharmacyName = settings?.pharmacyName || "Habakkuk Pharmacy"
    const location = settings?.location || ""
    const contact = settings?.contact || ""
    const email = settings?.email || ""
    const footerText = settings?.footerText || "Thank you for your purchase!"
    const currency = settings?.currency || "UGX"
    const logoImg = settings?.logo ? `<img src="${settings.logo}" alt="Logo" style="max-width: 100px; max-height: 100px; margin: 10px auto; display: block;" />` : ""
    const subtotal = total
    const transactionDate = new Date()

    const receiptHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${transaction.transactionNo}</title>
        <style>
          @media print {
            @page { margin: 0; }
            body { margin: 1cm; }
          }
          body { 
            font-family: 'Courier New', monospace; 
            padding: 10px; 
            width: 300px;
            font-size: 12px;
          }
          .center { text-align: center; }
          .line { border-bottom: 1px dashed #000; margin: 5px 0; }
          .bold { font-weight: bold; }
          table { width: 100%; border-collapse: collapse; }
          td { padding: 2px 0; }
          .right { text-align: right; }
          .header { margin-bottom: 10px; }
          .footer { margin-top: 10px; font-size: 10px; }
        </style>
      </head>
      <body onload="window.print(); window.close();">
        <div class="center header">
          ${logoImg}
          <h2 style="margin: 5px 0;">${pharmacyName}</h2>
          ${location ? `<p style="margin: 2px 0;">${location}</p>` : ""}
          ${contact ? `<p style="margin: 2px 0;">Tel: ${contact}</p>` : ""}
          ${email ? `<p style="margin: 2px 0;">${email}</p>` : ""}
        </div>
        <div class="line"></div>
        <div class="center">
          <p style="margin: 5px 0;"><strong>RECEIPT</strong></p>
          <p style="margin: 2px 0;">No: ${transaction.transactionNo}</p>
          <p style="margin: 2px 0;">Date: ${transactionDate.toLocaleDateString()}</p>
          <p style="margin: 2px 0;">Time: ${transactionDate.toLocaleTimeString()}</p>
        </div>
        <div class="line"></div>
        <table>
          <thead>
            <tr>
              <td class="bold">Item</td>
              <td class="bold center">Qty</td>
              <td class="bold right">Price</td>
              <td class="bold right">Total</td>
            </tr>
          </thead>
          <tbody>
          ${cart.map((item) => `
            <tr>
              <td>${item.name}</td>
              <td class="center">${item.cartQuantity} ${item.unitOfMeasure || ""}</td>
              <td class="right">${formatCurrency(item.price, currency)}</td>
              <td class="right">${formatCurrency(item.subtotal, currency)}</td>
            </tr>
          `).join("")}
          </tbody>
        </table>
        <div class="line"></div>
        <table>
          <tr>
            <td class="bold">Subtotal</td>
            <td class="right bold">${formatCurrency(subtotal, currency)}</td>
          </tr>
          ${taxRate > 0 ? `
          <tr>
            <td>Tax (${taxRate}%)</td>
            <td class="right">${formatCurrency(taxAmount, currency)}</td>
          </tr>
          ` : ""}
          <tr>
            <td class="bold">Total</td>
            <td class="right bold">${formatCurrency(grandTotal, currency)}</td>
          </tr>
          ${paymentMethod === "CASH" && amountPaid ? `
          <tr>
            <td>Amount Paid</td>
            <td class="right">${formatCurrency(parseFloat(amountPaid), currency)}</td>
          </tr>
          <tr>
            <td class="bold">Change</td>
            <td class="right bold">${formatCurrency(Math.max(0, change), currency)}</td>
          </tr>
          ` : ""}
          <tr>
            <td>Payment Method</td>
            <td class="right">${paymentMethod}</td>
          </tr>
        </table>
        <div class="line"></div>
        <p class="center footer"><strong>Served by: ${staffName}</strong></p>
        <p class="center footer">${footerText}</p>
        <p class="center footer">Please keep this receipt for your records</p>
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <span>Receipt Preview</span>
            <Button variant="ghost" size="sm" onClick={onClose}>×</Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="font-mono text-sm">
          {/* Header */}
          <div className="text-center space-y-1 mb-4">
            {settings?.logo && (
              <img 
                src={settings.logo} 
                alt="Logo" 
                className="w-16 h-16 mx-auto object-contain"
              />
            )}
            <h3 className="font-bold text-lg">{pharmacyName}</h3>
            {location && <p className="text-xs text-gray-600">{location}</p>}
            {contact && <p className="text-xs text-gray-600">Tel: {contact}</p>}
            {email && <p className="text-xs text-gray-600">{email}</p>}
          </div>

          <div className="border-t border-dashed border-gray-400 my-3"></div>

          {/* Receipt Info */}
          <div className="text-center space-y-1 mb-3">
            <p className="font-bold">RECEIPT</p>
            <p className="text-xs">No: TXN-XXXXXX</p>
            <p className="text-xs">Date: {currentDate.toLocaleDateString()}</p>
            <p className="text-xs">Time: {currentDate.toLocaleTimeString()}</p>
          </div>

          <div className="border-t border-dashed border-gray-400 my-3"></div>

          {/* Items */}
          <div className="space-y-2 mb-3">
            {cart.map((item) => (
              <div key={item.id} className="flex justify-between text-xs">
                <div className="flex-1">
                  <span>{item.name}</span>
                  <span className="text-gray-500 ml-1">x{item.cartQuantity}</span>
                </div>
                <span>{formatCurrency(item.subtotal, currency)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-gray-400 my-3"></div>

          {/* Totals */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatCurrency(total, currency)}</span>
            </div>
            {taxRate > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Tax ({taxRate}%)</span>
                <span>{formatCurrency(taxAmount, currency)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base">
              <span>Total</span>
              <span>{formatCurrency(grandTotal, currency)}</span>
            </div>
            {paymentMethod === "CASH" && amountPaid && (
              <>
                <div className="flex justify-between">
                  <span>Amount Paid</span>
                  <span>{formatCurrency(parseFloat(amountPaid), currency)}</span>
                </div>
                <div className="flex justify-between font-bold text-green-600">
                  <span>Change</span>
                  <span>{formatCurrency(Math.max(0, change), currency)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between">
              <span>Payment</span>
              <span>{paymentMethod}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-400 my-3"></div>

          {/* Footer */}
          <div className="text-center space-y-1 text-xs text-gray-600">
            <p className="font-semibold text-gray-800">Served by: {staffName}</p>
            <p>{footerText}</p>
            <p>Please keep this receipt for your records</p>
          </div>

          <div className="mt-4 flex justify-end">
            <Button onClick={onClose}>Close</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
