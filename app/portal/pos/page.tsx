"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
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

// Debounce hook for search
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

interface Product {
  id: string
  name: string
  sku: string
  price: number
  costPrice: number
  quantity: number
  unitOfMeasure: string
  barcode?: string
  expiryDate?: string
  batchNumber?: string
}

interface CartItem extends Product {
  cartQuantity: number
  costPrice: number  // Original price from inventory (constant)
  sellingPrice: number  // Editable selling price (like Tally)
  subtotal: number
  expiryDate?: string  // Expiry date for receipt
  batchNumber?: string  // Batch number for records
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

interface StaffMember {
  id: string
  name: string
  email: string
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
  const [displayCount, setDisplayCount] = useState(20)
  const [showMobileCart, setShowMobileCart] = useState(false)
  const [showStaffDialog, setShowStaffDialog] = useState(false)
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null)
  const { toast } = useToast()

  // Debounce search query for better performance
  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('pos-cart')
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart))
      } catch (e) {
        console.error('Failed to parse saved cart:', e)
      }
    }
    fetchProducts()
    fetchSettings()
    fetchStaffMembers()
  }, [])

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (cart.length > 0) {
      localStorage.setItem('pos-cart', JSON.stringify(cart))
    } else {
      localStorage.removeItem('pos-cart')
    }
  }, [cart])

  // Check if current user is HABAKKUK master account
  const isHabakkukAccount = session?.user?.name === "HABAKKUK" || session?.user?.email === "habakkuk@habakkukpharmacy.com"

  const fetchStaffMembers = async () => {
    try {
      // Use dedicated staff-list endpoint that doesn't require admin role
      const response = await fetch("/api/admin/staff-list")
      if (response.ok) {
        const data = await response.json()
        setStaffMembers(data)
      }
    } catch (error) {
      console.error("Failed to fetch staff:", error)
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

  const fetchProducts = async () => {
    try {
      const response = await fetch("/api/admin/inventory")
      const data = await response.json()
      if (Array.isArray(data)) {
        // Show all products including zero/negative stock for continuous sales
        setProducts(data)
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

  // Use memoized filtered products with debounced search for better INP
  const allFilteredProducts = useMemo(() => {
    const query = debouncedSearchQuery.toLowerCase()
    if (!query) return products
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query) ||
        (p.barcode && p.barcode.toLowerCase().includes(query))
    )
  }, [products, debouncedSearchQuery])

  // Paginate: show displayCount items, or all when searching
  const filteredProducts = useMemo(() => {
    if (debouncedSearchQuery) return allFilteredProducts
    return allFilteredProducts.slice(0, displayCount)
  }, [allFilteredProducts, displayCount, debouncedSearchQuery])

  const hasMoreProducts = !debouncedSearchQuery && displayCount < products.length

  const addToCart = (product: Product) => {
    const existingItem = cart.find((item) => item.id === product.id)
    
    if (existingItem) {
      // Allow selling beyond stock (negative stock allowed)
      // Move updated item to top of cart
      const updatedItem = {
        ...existingItem,
        cartQuantity: existingItem.cartQuantity + 1,
        subtotal: (existingItem.cartQuantity + 1) * existingItem.sellingPrice,
      }
      setCart([
        updatedItem,
        ...cart.filter((item) => item.id !== product.id)
      ])
    } else {
      // Add new item at the top of cart
      setCart([
        {
          ...product,
          cartQuantity: 1,
          costPrice: product.costPrice,  // Store cost price from inventory
          sellingPrice: product.price,  // Initialize selling price (retail price)
          subtotal: product.price,
        },
        ...cart,
      ])
    }
  }

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.id !== productId))
  }

  const updateCartQuantity = (productId: string, quantity: number) => {
    // Allow any quantity (negative stock allowed for continuous sales)
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
              subtotal: quantity * item.sellingPrice,
            }
          : item
      )
    )
  }

  // Update selling price for an item (Tally-like flexible pricing)
  const updateSellingPrice = (productId: string, newPrice: number) => {
    if (newPrice < 0) return
    
    setCart(
      cart.map((item) =>
        item.id === productId
          ? {
              ...item,
              sellingPrice: newPrice,
              subtotal: item.cartQuantity * newPrice,
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
  
  // For HABAKKUK account, use selected staff name; otherwise use logged-in user
  const staffName = isHabakkukAccount && selectedStaff 
    ? `${selectedStaff.name} of HABAKKUK` 
    : session?.user?.name || "Staff"
  
  // The actual staff ID for transaction recording
  const transactionStaffId = isHabakkukAccount && selectedStaff 
    ? selectedStaff.id 
    : session?.user?.id

  const handleCompleteSale = () => {
    if (cart.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Cart is empty",
      })
      return
    }

    // If logged in as HABAKKUK, show staff selection dialog
    if (isHabakkukAccount && !selectedStaff) {
      setShowStaffDialog(true)
      return
    }

    processTransaction(selectedStaff)
  }

  const processTransaction = async (staffForReceipt?: StaffMember | null) => {
    setIsProcessing(true)

    // Determine staff name for this specific transaction
    const receiptStaffName = isHabakkukAccount && staffForReceipt 
      ? `${staffForReceipt.name} of HABAKKUK` 
      : session?.user?.name || "Staff"
    
    const receiptStaffId = isHabakkukAccount && staffForReceipt 
      ? staffForReceipt.id 
      : session?.user?.id

    try {
      const response = await fetch("/api/admin/pos/transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((item) => ({
            productId: item.id,
            quantity: item.cartQuantity,
            unitPrice: item.sellingPrice,  // Use editable selling price
            costPrice: item.costPrice,  // Include cost price for records
          })),
          paymentMethod,
          staffId: receiptStaffId,  // Pass the actual staff member ID
          staffName: receiptStaffName,  // Pass formatted staff name for receipt
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Success",
          description: "Transaction completed successfully",
        })
        
        // Print receipt with correct staff name
        printReceipt(data.transaction, receiptStaffName)
        
        // Clear cart and localStorage
        setCart([])
        localStorage.removeItem('pos-cart')
        
        // Reset selected staff for next transaction
        setSelectedStaff(null)
        
        // Reset payment fields
        setAmountPaid("")
        
        // Refresh products
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

  const printReceipt = (transaction: any, receiptStaffName: string) => {
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
            margin: 10mm;
          }
          @media print {
            body { margin: 0; }
          }
          * {
            box-sizing: border-box;
          }
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
          .header-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
          }
          .pharmacy-name {
            font-size: 16px;
            font-weight: 700;
            color: #000;
            margin: 5px 0 2px;
          }
          .pharmacy-location {
            font-size: 10px;
            color: #000;
            margin: 1px 0;
          }
          .pharmacy-contact {
            font-size: 10px;
            color: #000;
          }
          .receipt-title {
            text-align: center;
            margin: 8px 0;
          }
          .receipt-title h2 {
            font-size: 12px;
            font-weight: 700;
            color: #000;
            margin: 0;
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
            color: #000;
            text-transform: uppercase;
          }
          .receipt-info-value {
            font-size: 10px;
            font-weight: 600;
            color: #000;
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
          th:last-child {
            text-align: right;
          }
          td {
            padding: 4px 6px;
            border-bottom: 1px solid #ccc;
            font-size: 10px;
            color: #000;
          }
          tr:last-child td {
            border-bottom: none;
          }
          .text-right {
            text-align: right;
          }
          .text-center {
            text-align: center;
          }
          .totals-section {
            border-top: 1px dashed #000;
            padding-top: 8px;
            margin-top: 6px;
          }
          .totals-table {
            width: 100%;
            max-width: 200px;
            margin-left: auto;
          }
          .totals-table td {
            padding: 2px 0;
            border: none;
            font-size: 10px;
          }
          .totals-table .total-row {
            font-size: 14px;
            font-weight: 700;
            color: #000;
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
          .change-amount {
            font-weight: 700;
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
            color: #000;
            margin-bottom: 4px;
          }
          .thank-you {
            font-size: 11px;
            font-weight: 500;
            color: #000;
            margin: 6px 0;
          }
          .footer-note {
            font-size: 9px;
            color: #000;
            margin-top: 4px;
          }
          .barcode-section {
            text-align: center;
            margin-top: 6px;
            padding-top: 6px;
            border-top: 1px solid #ccc;
          }
          .transaction-code {
            font-family: 'Courier New', monospace;
            font-size: 11px;
            letter-spacing: 1px;
            color: #000;
          }
          .item-name {
            font-weight: 600;
          }
          .item-sku {
            font-size: 8px;
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
                <th>Item</th>
                <th class="text-center">Qty</th>
                <th class="text-right">Price</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
            ${cart.map((item, index) => `
              <tr>
                <td>
                  <span class="item-name">${item.name}</span>
                  ${item.sku ? `<br/><span class="item-sku">${item.sku}</span>` : ""}
                  ${item.expiryDate ? `<br/><span class="item-sku">Exp: ${new Date(item.expiryDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>` : ""}
                </td>
                <td class="text-center">${item.cartQuantity}</td>
                <td class="text-right">${formatCurrency(item.sellingPrice, currency)}</td>
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
              <span>Payment:</span>
              <strong>${paymentMethod === "MOBILE_MONEY" ? "Mobile Money" : paymentMethod}</strong>
            </div>
            ${paymentMethod === "CASH" && amountPaid ? `
            <div class="payment-row">
              <span>Paid:</span>
              <strong>${formatCurrency(parseFloat(amountPaid), currency)}</strong>
            </div>
            <div class="payment-row">
              <span>Change:</span>
              <strong class="change-amount">${formatCurrency(Math.max(0, change), currency)}</strong>
            </div>
            ` : ""}
          </div>

          <div class="footer">
            <p class="served-by">Served by: ${receiptStaffName}</p>
            <p class="thank-you">${footerText}</p>
            <p class="footer-note">Keep this receipt for your records</p>
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
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Point of Sale</h1>
        <p className="text-gray-500 mt-1 sm:mt-2 text-sm sm:text-base">
          Process sales and generate receipts
          {isHabakkukAccount && selectedStaff && (
            <span className="ml-2 text-primary font-medium">
              • Selling as: {selectedStaff.name}
            </span>
          )}
        </p>
      </div>

      {/* Staff Selection Dialog for HABAKKUK account */}
      {showStaffDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Who is making this sale?</CardTitle>
              <p className="text-sm text-gray-500">Select your name to complete the sale</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {staffMembers.map((staff) => (
                  <button
                    key={staff.id}
                    onClick={() => {
                      setSelectedStaff(staff)
                      setShowStaffDialog(false)
                      // Pass the staff directly to avoid state timing issues
                      processTransaction(staff)
                    }}
                    className="w-full p-3 text-left border rounded-lg hover:bg-gray-50 hover:border-primary transition-colors"
                  >
                    <div className="font-medium">{staff.name}</div>
                    <div className="text-xs text-gray-500">{staff.email}</div>
                  </button>
                ))}
                {staffMembers.length === 0 && (
                  <p className="text-center text-gray-500 py-4">No staff members found</p>
                )}
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowStaffDialog(false)}
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Products</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    Showing {filteredProducts.length} of {debouncedSearchQuery ? allFilteredProducts.length : products.length} products
                  </p>
                </div>
              </div>
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, SKU, or scan barcode..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setDisplayCount(20) // Reset display count when searching
                  }}
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
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">Cost:</span>
                        <span className="text-xs text-gray-600 font-medium">{formatCurrency(product.costPrice)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-green-600">Sell:</span>
                        <span className="text-primary font-bold">{formatCurrency(product.price)}</span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 pt-1 border-t">Stock: {product.quantity}</div>
                  </button>
                ))}
              </div>
              {hasMoreProducts && (
                <div className="flex justify-center mt-4 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setDisplayCount((prev) => prev + 20)}
                  >
                    Load More ({products.length - displayCount} remaining)
                  </Button>
                </div>
              )}
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
                        <div className="text-xs text-gray-400">Cost: {formatCurrency(item.costPrice)}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFromCart(item.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                    {/* Editable Selling Price (Tally-like) */}
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1">
                        <Label className="text-xs text-gray-500">Selling Price</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.sellingPrice}
                          onChange={(e) =>
                            updateSellingPrice(item.id, parseFloat(e.target.value) || 0)
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs text-gray-500">Qty</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.cartQuantity}
                          onChange={(e) =>
                            updateCartQuantity(item.id, parseInt(e.target.value))
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t">
                      <span className="text-xs text-gray-500">Subtotal</span>
                      <div className="font-semibold">{formatCurrency(item.subtotal)}</div>
                    </div>
                    {item.sellingPrice !== item.costPrice && (
                      <div className={`text-xs mt-1 ${item.sellingPrice > item.costPrice ? 'text-green-600' : 'text-orange-600'}`}>
                        {item.sellingPrice > item.costPrice 
                          ? `+${formatCurrency(item.sellingPrice - item.costPrice)} margin` 
                          : `${formatCurrency(item.sellingPrice - item.costPrice)} discount`}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="border-t mt-4 pt-4 space-y-3" data-checkout-section>
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
                  onClick={handleCompleteSale}
                  className="w-full"
                  disabled={isProcessing || cart.length === 0}
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

      {/* Floating Cart Button for Mobile */}
      <button
        onClick={() => setShowMobileCart(!showMobileCart)}
        className="lg:hidden fixed bottom-6 right-6 z-50 bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 rounded-full shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 hover:scale-110 active:scale-95"
        aria-label="Shopping Cart"
      >
        <div className="relative">
          <ShoppingCart className="h-6 w-6" />
          {cart.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
              {cart.length}
            </span>
          )}
        </div>
      </button>

      {/* Mobile Cart Modal */}
      {showMobileCart && (
        <div className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
          <div className="bg-white w-full max-h-[85vh] rounded-t-3xl overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300">
            {/* Mobile Cart Header */}
            <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-purple-600 to-blue-600 text-white">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Cart ({cart.length})
              </h3>
              <button
                onClick={() => setShowMobileCart(false)}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Mobile Cart Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <ShoppingCart className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p>Your cart is empty</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="bg-gray-50 rounded-xl p-3 border">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm truncate">{item.name}</h4>
                        <p className="text-xs text-gray-500">{item.sku}</p>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="ml-2 p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateCartQuantity(item.id, item.cartQuantity - 1)}
                          className="w-8 h-8 bg-white border rounded-lg flex items-center justify-center hover:bg-gray-100 active:scale-95"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={item.cartQuantity}
                          onChange={(e) => updateCartQuantity(item.id, parseInt(e.target.value) || 1)}
                          className="w-14 h-8 text-center border rounded-lg font-semibold"
                        />
                        <button
                          onClick={() => updateCartQuantity(item.id, item.cartQuantity + 1)}
                          className="w-8 h-8 bg-white border rounded-lg flex items-center justify-center hover:bg-gray-100 active:scale-95"
                        >
                          +
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">
                          @ {formatCurrency(item.sellingPrice)}
                        </p>
                        <p className="font-bold text-green-600">
                          {formatCurrency(item.subtotal)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Mobile Cart Footer */}
            {cart.length > 0 && (
              <div className="border-t p-4 bg-white space-y-3">
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>Total:</span>
                  <span className="text-green-600">
                    {formatCurrency(cart.reduce((sum, item) => sum + item.subtotal, 0))}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setShowMobileCart(false)
                    // Scroll to checkout section
                    const checkoutSection = document.querySelector('[data-checkout-section]')
                    checkoutSection?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg active:scale-95 transition-all"
                >
                  Proceed to Checkout
                </button>
              </div>
            )}
          </div>
        </div>
      )}
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

  const handlePrint = () => {
    const printWindow = window.open("", "", "width=800,height=1000")
    if (!printWindow) return

    const logoImg = settings?.logo ? `<img src="${settings.logo}" alt="Logo" style="width: 60px; height: 60px; object-fit: contain;" />` : ""

    const receiptHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt Preview</title>
        <style>
          @page { size: A4; margin: 10mm; }
          body { font-family: Arial, sans-serif; padding: 10px; max-width: 210mm; margin: 0 auto; color: #000; font-size: 11px; }
          .receipt-container { border: 1px solid #000; padding: 15px; background: #fff; }
          .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
          .pharmacy-name { font-size: 16px; font-weight: 700; margin: 5px 0 2px; }
          .pharmacy-info { font-size: 10px; margin: 1px 0; }
          .receipt-title { text-align: center; margin: 8px 0; font-size: 12px; font-weight: 700; letter-spacing: 2px; }
          .receipt-info { display: flex; justify-content: space-between; border: 1px solid #000; padding: 6px 8px; margin-bottom: 8px; font-size: 10px; }
          .receipt-info-item { text-align: center; }
          .receipt-info-label { font-size: 8px; text-transform: uppercase; }
          .receipt-info-value { font-size: 10px; font-weight: 600; }
          table { width: 100%; border-collapse: collapse; margin: 6px 0; }
          th { background: #000; color: #fff; padding: 4px 6px; text-align: left; font-weight: 600; font-size: 9px; text-transform: uppercase; }
          th:last-child { text-align: right; }
          td { padding: 4px 6px; border-bottom: 1px solid #ccc; font-size: 10px; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .totals-section { border-top: 1px dashed #000; padding-top: 8px; margin-top: 6px; }
          .totals-table { width: 100%; max-width: 180px; margin-left: auto; }
          .totals-table td { padding: 2px 0; border: none; font-size: 10px; }
          .totals-table .total-row { font-size: 13px; font-weight: 700; border-top: 2px solid #000; padding-top: 4px; }
          .payment-info { border: 1px solid #000; padding: 6px 8px; margin: 8px 0; font-size: 10px; }
          .payment-row { display: flex; justify-content: space-between; margin: 2px 0; }
          .footer { text-align: center; border-top: 1px dashed #000; padding-top: 8px; margin-top: 8px; }
          .served-by { font-size: 10px; font-weight: 600; margin-bottom: 4px; }
          .thank-you { font-size: 10px; margin: 4px 0; }
          .footer-note { font-size: 9px; margin-top: 4px; }
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
              <div class="receipt-info-value">TXN-PREVIEW</div>
            </div>
            <div class="receipt-info-item">
              <div class="receipt-info-label">Date</div>
              <div class="receipt-info-value">${currentDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
            </div>
            <div class="receipt-info-item">
              <div class="receipt-info-label">Time</div>
              <div class="receipt-info-value">${currentDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
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
              ${cart.map((item) => `
                <tr>
                  <td><strong>${item.name}</strong>${item.sku ? `<br/><span style="font-size:8px;color:#666">${item.sku}</span>` : ""}</td>
                  <td class="text-center">${item.cartQuantity}</td>
                  <td class="text-right">${formatCurrency(item.sellingPrice, currency)}</td>
                  <td class="text-right"><strong>${formatCurrency(item.subtotal, currency)}</strong></td>
                </tr>
              `).join("")}
            </tbody>
          </table>

          <div class="totals-section">
            <table class="totals-table">
              <tr>
                <td>Subtotal</td>
                <td class="text-right">${formatCurrency(total, currency)}</td>
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
              <span>Payment:</span>
              <strong>${paymentMethod === "MOBILE_MONEY" ? "Mobile Money" : paymentMethod}</strong>
            </div>
            ${paymentMethod === "CASH" && amountPaid ? `
            <div class="payment-row">
              <span>Paid:</span>
              <strong>${formatCurrency(parseFloat(amountPaid), currency)}</strong>
            </div>
            <div class="payment-row">
              <span>Change:</span>
              <strong>${formatCurrency(Math.max(0, change), currency)}</strong>
            </div>
            ` : ""}
          </div>

          <div class="footer">
            <p class="served-by">Served by: ${staffName}</p>
            <p class="thank-you">${footerText}</p>
            <p class="footer-note">Keep this receipt for your records</p>
          </div>
        </div>
      </body>
      </html>
    `

    printWindow.document.write(receiptHTML)
    printWindow.document.close()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <Card className="w-full max-w-xl my-8">
        <CardHeader className="pb-2 flex flex-row items-center justify-between border-b">
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Receipt Preview
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>×</Button>
        </CardHeader>
        <CardContent className="p-4">
          {/* Receipt Preview - Compact B&W Style */}
          <div className="border border-black p-4 bg-white text-black">
            {/* Header */}
            <div className="text-center border-b border-dashed border-black pb-2 mb-2">
              {settings?.logo && (
                <img 
                  src={settings.logo} 
                  alt="Logo" 
                  className="w-14 h-14 mx-auto object-contain mb-2"
                />
              )}
              <h2 className="text-base font-bold">{pharmacyName}</h2>
              {location && <p className="text-[10px]">{location}</p>}
              {contact && <p className="text-[10px]">Tel: {contact}{email ? ` | ${email}` : ""}</p>}
            </div>

            {/* Receipt Title */}
            <div className="text-center mb-2">
              <h3 className="text-xs font-bold tracking-widest">SALES RECEIPT</h3>
            </div>

            {/* Receipt Info */}
            <div className="flex justify-between border border-black p-2 mb-2 text-[10px]">
              <div className="text-center">
                <p className="text-[8px] uppercase">Receipt No</p>
                <p className="font-semibold">TXN-PREVIEW</p>
              </div>
              <div className="text-center">
                <p className="text-[8px] uppercase">Date</p>
                <p className="font-semibold">{currentDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
              </div>
              <div className="text-center">
                <p className="text-[8px] uppercase">Time</p>
                <p className="font-semibold">{currentDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>

            {/* Items Table */}
            <div className="mb-2">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="bg-black text-white">
                    <th className="text-left py-1 px-2 font-medium">Item</th>
                    <th className="text-center py-1 px-1 font-medium">Qty</th>
                    <th className="text-right py-1 px-1 font-medium">Price</th>
                    <th className="text-right py-1 px-2 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => (
                    <tr key={item.id} className="border-b border-gray-300">
                      <td className="py-1 px-2">
                        <span className="font-medium text-[10px]">{item.name}</span>
                        {item.sku && <span className="text-[8px] text-gray-600 block">{item.sku}</span>}
                        {item.expiryDate && <span className="text-[8px] text-gray-600 block">Exp: {new Date(item.expiryDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>}
                      </td>
                      <td className="text-center py-1 px-1">{item.cartQuantity}</td>
                      <td className="text-right py-1 px-1">{formatCurrency(item.sellingPrice, currency)}</td>
                      <td className="text-right py-1 px-2 font-semibold">{formatCurrency(item.subtotal, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="border-t border-dashed border-black pt-2">
              <div className="max-w-[150px] ml-auto space-y-0.5 text-[10px]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatCurrency(total, currency)}</span>
                </div>
                {taxRate > 0 && (
                  <div className="flex justify-between">
                    <span>Tax ({taxRate}%)</span>
                    <span>{formatCurrency(taxAmount, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold border-t-2 border-black pt-1 mt-1">
                  <span>TOTAL</span>
                  <span>{formatCurrency(grandTotal, currency)}</span>
                </div>
              </div>
            </div>

            {/* Payment Info */}
            <div className="border border-black p-2 my-2 text-[10px]">
              <div className="flex justify-between">
                <span>Payment:</span>
                <span className="font-semibold">{paymentMethod === "MOBILE_MONEY" ? "Mobile Money" : paymentMethod}</span>
              </div>
              {paymentMethod === "CASH" && amountPaid && (
                <>
                  <div className="flex justify-between mt-0.5">
                    <span>Paid:</span>
                    <span className="font-semibold">{formatCurrency(parseFloat(amountPaid), currency)}</span>
                  </div>
                  <div className="flex justify-between mt-0.5">
                    <span>Change:</span>
                    <span className="font-bold">{formatCurrency(Math.max(0, change), currency)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="text-center border-t border-dashed border-black pt-2 mt-2 space-y-1">
              <p className="font-semibold text-[10px]">Served by: {staffName}</p>
              <p className="text-[10px]">{footerText}</p>
              <p className="text-[8px]">Keep this receipt for your records</p>
            </div>
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
            <Button size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print Receipt
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
