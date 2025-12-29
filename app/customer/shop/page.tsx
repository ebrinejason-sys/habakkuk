"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"
import { ShoppingCart, Search } from "lucide-react"
import { useRouter } from "next/navigation"

interface Product {
  id: string
  name: string
  sku: string
  category: string
  price: number
  quantity: number
  description?: string
}

export default function CustomerShopPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<{ [key: string]: number }>({})
  const [searchQuery, setSearchQuery] = useState("")
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    const customerId = localStorage.getItem("customerId")
    if (!customerId) {
      router.push("/customer/login")
      return
    }
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const response = await fetch("/api/customer/products")
      const data = await response.json()
      setProducts(data)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch products",
      })
    }
  }

  const addToCart = (productId: string) => {
    setCart((prev) => ({
      ...prev,
      [productId]: (prev[productId] || 0) + 1,
    }))
    toast({
      title: "Added to cart",
      description: "Product added successfully",
    })
  }

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalItems = Object.values(cart).reduce((sum, qty) => sum + qty, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Habakkuk Pharmacy</h1>
            <div className="flex items-center space-x-4">
              <Button variant="outline">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Cart ({totalItems})
              </Button>
              <Button variant="ghost" onClick={() => {
                localStorage.removeItem("customerId")
                router.push("/customer/login")
              }}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <Card key={product.id}>
              <CardHeader>
                <CardTitle className="text-lg">{product.name}</CardTitle>
                <p className="text-sm text-gray-500">{product.category}</p>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                  {product.description || "No description available"}
                </p>
                <div className="flex justify-between items-center">
                  <span className="text-xl font-bold text-primary">
                    {formatCurrency(product.price)}
                  </span>
                  <Button
                    onClick={() => addToCart(product.id)}
                    disabled={product.quantity === 0}
                  >
                    {product.quantity === 0 ? "Out of Stock" : "Add to Cart"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}
