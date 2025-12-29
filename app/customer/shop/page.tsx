"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"
import { ShoppingCart, Search, Home } from "lucide-react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"

interface Product {
  id: string
  name: string
  sku: string
  category: string
  price: number
  quantity: number
  description?: string
}

interface Settings {
  pharmacyName: string
  location: string
  contact: string
}

export default function CustomerShopPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<{ [key: string]: number }>({})
  const [searchQuery, setSearchQuery] = useState("")
  const [settings, setSettings] = useState<Settings | null>(null)
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    const customerId = localStorage.getItem("customerId")
    if (!customerId) {
      router.push("/customer/login")
      return
    }
    fetchProducts()
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/public/settings")
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
            <Link href="/" className="flex items-center space-x-3">
              <div className="relative w-10 h-10">
                <Image
                  src="/logo.png"
                  alt="Logo"
                  fill
                  className="object-contain rounded-lg"
                />
              </div>
              <span className="text-xl font-bold hidden sm:block">
                {settings?.pharmacyName || "Habakkuk Pharmacy"}
              </span>
            </Link>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <Home className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Home</span>
                </Button>
              </Link>
              <Button variant="outline" size="sm">
                <ShoppingCart className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Cart</span> ({totalItems})
              </Button>
              <Button variant="ghost" size="sm" onClick={() => {
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
