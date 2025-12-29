"use client"

import { useEffect, useState } from "react"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency, generateTransactionNo } from "@/lib/utils"
import { Search, ShoppingCart, Trash2, Printer } from "lucide-react"

interface Product {
  id: string
  name: string
  sku: string
  price: number
  quantity: number
}

interface CartItem extends Product {
  cartQuantity: number
  subtotal: number
}

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<string>("CASH")
  const [isProcessing, setIsProcessing] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const response = await fetch("/api/admin/inventory")
      const data = await response.json()
      setProducts(data.filter((p: Product) => p.quantity > 0))
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch products",
      })
    }
  }

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase())
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

    const receiptHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt</title>
        <style>
          body { font-family: monospace; padding: 10px; }
          .center { text-align: center; }
          .line { border-bottom: 1px dashed #000; margin: 5px 0; }
          table { width: 100%; }
          .right { text-align: right; }
        </style>
      </head>
      <body>
        <div class="center">
          <h2>Habakkuk Pharmacy</h2>
          <p>Receipt #${transaction.transactionNo}</p>
          <p>${new Date().toLocaleString()}</p>
        </div>
        <div class="line"></div>
        <table>
          ${cart.map((item) => `
            <tr>
              <td>${item.name}</td>
              <td class="right">${item.cartQuantity}x${formatCurrency(item.price)}</td>
            </tr>
            <tr>
              <td colspan="2" class="right">${formatCurrency(item.subtotal)}</td>
            </tr>
          `).join("")}
        </table>
        <div class="line"></div>
        <table>
          <tr>
            <td><strong>Total</strong></td>
            <td class="right"><strong>${formatCurrency(total)}</strong></td>
          </tr>
          <tr>
            <td>Payment Method</td>
            <td class="right">${paymentMethod}</td>
          </tr>
        </table>
        <div class="line"></div>
        <p class="center">Thank you for your purchase!</p>
      </body>
      </html>
    `

    printWindow.document.write(receiptHTML)
    printWindow.document.close()
    printWindow.print()
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Point of Sale</h1>
        <p className="text-gray-500 mt-2">Process sales and generate receipts</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Products</CardTitle>
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search products..."
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
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                    <option value="MOBILE_MONEY">Mobile Money</option>
                  </select>
                </div>

                <Button
                  onClick={processTransaction}
                  className="w-full"
                  disabled={isProcessing || cart.length === 0}
                >
                  {isProcessing ? "Processing..." : "Complete Sale"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
