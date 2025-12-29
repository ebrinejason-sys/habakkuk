"use client"

import { useEffect, useState } from "react"

// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Plus, Upload, Search, Edit, AlertTriangle, Package } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface Product {
  id: string
  name: string
  sku: string
  category: string
  price: number
  quantity: number
  reorderLevel: number
  expiryDate?: string
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchProducts()
  }, [])

  useEffect(() => {
    const filtered = products.filter(
      (product) =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category.toLowerCase().includes(searchQuery.toLowerCase())
    )
    setFilteredProducts(filtered)
  }, [searchQuery, products])

  const fetchProducts = async () => {
    try {
      const response = await fetch("/api/admin/inventory")
      const data = await response.json()
      setProducts(data)
      setFilteredProducts(data)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch products",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const lowStockProducts = products.filter((p) => p.quantity <= p.reorderLevel)

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-gray-500 mt-2">Manage your pharmacy stock and products</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowBulkUpload(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Bulk Upload
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      {lowStockProducts.length > 0 && (
        <Card className="mb-6 border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center text-orange-800">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Low Stock Alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-orange-700">
              {lowStockProducts.length} product(s) are running low on stock.
            </p>
          </CardContent>
        </Card>
      )}

      {showCreateDialog && (
        <CreateProductDialog
          onClose={() => setShowCreateDialog(false)}
          onSuccess={() => {
            setShowCreateDialog(false)
            fetchProducts()
          }}
        />
      )}

      {showBulkUpload && (
        <BulkUploadDialog
          onClose={() => setShowBulkUpload(false)}
          onSuccess={() => {
            setShowBulkUpload(false)
            fetchProducts()
          }}
        />
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Products</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.sku}</TableCell>
                  <TableCell>{product.category}</TableCell>
                  <TableCell>{formatCurrency(product.price)}</TableCell>
                  <TableCell>
                    <span className={product.quantity <= product.reorderLevel ? "text-orange-600 font-semibold" : ""}>
                      {product.quantity}
                    </span>
                  </TableCell>
                  <TableCell>
                    {product.quantity === 0 ? (
                      <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700">
                        Out of Stock
                      </span>
                    ) : product.quantity <= product.reorderLevel ? (
                      <span className="px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-700">
                        Low Stock
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
                        In Stock
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
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

interface CreateProductDialogProps {
  onClose: () => void
  onSuccess: () => void
}

function CreateProductDialog({ onClose, onSuccess }: CreateProductDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    category: "",
    price: "",
    costPrice: "",
    quantity: "",
    reorderLevel: "10",
    description: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch("/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          price: parseFloat(formData.price),
          costPrice: parseFloat(formData.costPrice),
          quantity: parseInt(formData.quantity),
          reorderLevel: parseInt(formData.reorderLevel),
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Product created successfully",
        })
        onSuccess()
      } else {
        const data = await response.json()
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to create product",
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
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>Add New Product</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Product Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sku">SKU *</Label>
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Price *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="costPrice">Cost Price *</Label>
                <Input
                  id="costPrice"
                  type="number"
                  step="0.01"
                  value={formData.costPrice}
                  onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity *</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Creating..." : "Create Product"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function BulkUploadDialog({ onClose, onSuccess }: CreateProductDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!file) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a file",
      })
      return
    }

    setIsLoading(true)
    const formData = new FormData()
    formData.append("file", file)

    try {
      const response = await fetch("/api/admin/inventory/bulk-upload", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Success",
          description: `${data.count} products uploaded successfully`,
        })
        onSuccess()
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to upload products",
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

  const downloadTemplate = () => {
    const csvContent = "name,sku,category,price,costPrice,quantity,reorderLevel,description\nParacetamol 500mg,PAR500,Pain Relief,5000,3000,100,20,Pain and fever relief\nIbuprofen 400mg,IBU400,Pain Relief,8000,5000,150,25,Anti-inflammatory"
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "product-template.csv"
    a.click()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Bulk Upload Products</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Instructions:</h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Upload a CSV file with product details</li>
              <li>Required columns: name, sku, category, price, costPrice, quantity</li>
              <li>Download the template for correct format</li>
            </ul>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={downloadTemplate}
            className="w-full"
          >
            <Package className="h-4 w-4 mr-2" />
            Download CSV Template
          </Button>

          <div className="space-y-2">
            <Label htmlFor="file">Select CSV File</Label>
            <Input
              id="file"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              disabled={isLoading}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={isLoading || !file}>
              {isLoading ? "Uploading..." : "Upload Products"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
