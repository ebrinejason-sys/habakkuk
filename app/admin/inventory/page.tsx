"use client"

import { useEffect, useState, useMemo } from "react"

// Debounce hook for better INP performance
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}

// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Plus, Upload, Search, Edit, AlertTriangle, Package, PackagePlus } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface Product {
  id: string
  name: string
  sku: string
  barcode?: string
  category: string
  price: number
  costPrice: number
  quantity: number
  initialStock?: number
  reorderLevel: number
  unitOfMeasure: string
  description?: string
  expiryDate?: string
  batchNumber?: string
  manufacturer?: string
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showUpdateStock, setShowUpdateStock] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  // Debounce search for better INP performance
  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  // Memoized filtered products using debounced search
  // Show only 20 products initially, search to find more
  const filteredProducts = useMemo(() => {
    const query = debouncedSearchQuery.toLowerCase()
    if (!query) return products.slice(0, 20) // Show first 20 when no search
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query)
    )
  }, [debouncedSearchQuery, products])

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const response = await fetch("/api/admin/inventory")
      const data = await response.json()
      if (Array.isArray(data)) {
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
    } finally {
      setIsLoading(false)
    }
  }

  // Low stock: if current stock is <= half of initial stock or <= reorderLevel
  const isLowStock = (product: Product) => {
    const initialStock = product.initialStock || product.reorderLevel * 2
    return product.quantity <= Math.max(initialStock / 2, product.reorderLevel)
  }

  const lowStockProducts = products.filter((p) => p.quantity > 0 && isLowStock(p))

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-gray-500 mt-2">Manage your pharmacy stock and products</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowUpdateStock(true)}>
            <PackagePlus className="h-4 w-4 mr-2" />
            Update Stock
          </Button>
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
              Low Stock Alert - Replenishment Needed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-orange-700 mb-2">
              {lowStockProducts.length} product(s) need stock replenishment:
            </p>
            <ul className="text-sm text-orange-700 space-y-1">
              {lowStockProducts.slice(0, 5).map((p) => (
                <li key={p.id}>• {p.name} - Current: {p.quantity} units</li>
              ))}
              {lowStockProducts.length > 5 && (
                <li className="font-semibold">...and {lowStockProducts.length - 5} more</li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}

      {showEditDialog && selectedProduct && (
        <EditProductDialog
          product={selectedProduct}
          onClose={() => {
            setShowEditDialog(false)
            setSelectedProduct(null)
          }}
          onSuccess={() => {
            setShowEditDialog(false)
            setSelectedProduct(null)
            fetchProducts()
          }}
        />
      )}

      {showUpdateStock && (
        <UpdateStockDialog
          products={products}
          onClose={() => setShowUpdateStock(false)}
          onSuccess={() => {
            setShowUpdateStock(false)
            fetchProducts()
          }}
        />
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
                    ) : isLowStock(product) ? (
                      <span className="px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-700">
                        Low Stock - Replenish
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
                        In Stock
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedProduct(product)
                        setShowEditDialog(true)
                      }}
                      title="Edit Product"
                    >
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
    unitOfMeasure: "Unit",
    barcode: "",
    description: "",
    batchNumber: "",
    manufacturer: "",
    expiryDate: "",
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
          unitOfMeasure: formData.unitOfMeasure,
          barcode: formData.barcode || null,
          batchNumber: formData.batchNumber || null,
          manufacturer: formData.manufacturer || null,
          expiryDate: formData.expiryDate || null,
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
              </div>              <div className="space-y-2">
                <Label htmlFor="barcode">Barcode</Label>
                <Input
                  id="barcode"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  placeholder="Scan or enter barcode"
                />
              </div>              <div className="space-y-2">
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
              </div>              <div className="space-y-2">
                <Label htmlFor="unitOfMeasure">Unit of Measure</Label>
                <select
                  id="unitOfMeasure"
                  value={formData.unitOfMeasure}
                  onChange={(e) => setFormData({ ...formData, unitOfMeasure: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  title="Unit of Measure"
                >
                  <option value="Unit">Unit</option>
                  <option value="Box">Box</option>
                  <option value="Strip">Strip</option>
                  <option value="Bottle">Bottle</option>
                  <option value="Pack">Pack</option>
                  <option value="Tube">Tube</option>
                  <option value="Vial">Vial</option>
                  <option value="Sachet">Sachet</option>
                  <option value="Carton">Carton</option>
                  <option value="ml">ml</option>
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                  <option value="L">L</option>
                </select>
              </div>              <div className="space-y-2">
                <Label htmlFor="batchNumber">Batch Number</Label>
                <Input
                  id="batchNumber"
                  value={formData.batchNumber}
                  onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                  placeholder="e.g., BATCH-2025-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manufacturer">Manufacturer</Label>
                <Input
                  id="manufacturer"
                  value={formData.manufacturer}
                  onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiryDate">Expiry Date</Label>
                <Input
                  id="expiryDate"
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
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
  const [uploadResult, setUploadResult] = useState<{ count?: number; errors?: string[]; skipped?: string[] } | null>(null)
  const { toast } = useToast()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setUploadResult(null)
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
    setUploadResult(null)
    const formData = new FormData()
    formData.append("file", file)

    try {
      const response = await fetch("/api/admin/inventory/bulk-upload", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (response.ok) {
        setUploadResult({ count: data.count, errors: data.errors, skipped: data.skipped })
        toast({
          title: "Success",
          description: `${data.count} products uploaded successfully`,
        })
        if (!data.errors?.length && !data.skipped?.length) {
          onSuccess()
        }
      } else {
        setUploadResult({ errors: data.details || [data.error], skipped: data.skipped })
        toast({
          variant: "destructive",
          title: "Upload Failed",
          description: data.hint || data.error || "Failed to upload products",
        })
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred during upload",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const downloadTemplate = () => {
    const csvContent = "name,sku,barcode,category,price,costPrice,quantity,reorderLevel,unitOfMeasure,description,batchNumber,manufacturer,expiryDate\nParacetamol 500mg,PAR500,123456789,Pain Relief,5000,3000,100,20,Strip,Pain and fever relief,BATCH-2025-001,Cipla,2027-12-31\nIbuprofen 400mg,IBU400,987654321,Pain Relief,8000,5000,150,25,Box,Anti-inflammatory,BATCH-2025-002,GSK,2026-06-30"
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "product-template.csv"
    a.click()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>Bulk Upload Products</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Instructions:</h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Upload a <strong>CSV or Excel</strong> file with product details</li>
              <li>Supports Tally exports and other formats</li>
              <li>Auto-detects columns: Name/Item Name, Price/Rate/MRP, Qty/Stock, etc.</li>
              <li>SKU will be auto-generated if not provided</li>
            </ul>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="text-xs text-gray-600 font-medium mb-1">Supported column names:</p>
            <p className="text-xs text-gray-500">
              <strong>Name:</strong> Name, Item Name, Stock Item, Product Name<br/>
              <strong>Price:</strong> Price, Rate, MRP, Selling Price<br/>
              <strong>Cost:</strong> Cost Price, Purchase Price, Cost<br/>
              <strong>Quantity:</strong> Quantity, Qty, Stock, Closing Stock<br/>
              <strong>Category:</strong> Category, Group, Under
            </p>
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
            <Label htmlFor="file">Select File (CSV or Excel)</Label>
            <Input
              id="file"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              disabled={isLoading}
            />
            {file && (
              <p className="text-sm text-gray-500">Selected: {file.name}</p>
            )}
          </div>

          {uploadResult && (
            <div className={`rounded-lg p-3 ${uploadResult.count ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              {uploadResult.count && (
                <p className="text-green-700 font-semibold">✓ {uploadResult.count} products uploaded successfully</p>
              )}
              {uploadResult.errors && uploadResult.errors.length > 0 && (
                <div className="mt-2">
                  <p className="text-red-700 font-semibold text-sm">Errors ({uploadResult.errors.length}):</p>
                  <ul className="text-xs text-red-600 max-h-24 overflow-y-auto">
                    {uploadResult.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                    {uploadResult.errors.length > 5 && (
                      <li>...and {uploadResult.errors.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}
              {uploadResult.skipped && uploadResult.skipped.length > 0 && (
                <div className="mt-2">
                  <p className="text-yellow-700 font-semibold text-sm">Skipped ({uploadResult.skipped.length}):</p>
                  <ul className="text-xs text-yellow-600 max-h-24 overflow-y-auto">
                    {uploadResult.skipped.slice(0, 3).map((skip, i) => (
                      <li key={i}>• {skip}</li>
                    ))}
                    {uploadResult.skipped.length > 3 && (
                      <li>...and {uploadResult.skipped.length - 3} more duplicates</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              {uploadResult?.count ? "Done" : "Cancel"}
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

interface EditProductDialogProps {
  product: Product
  onClose: () => void
  onSuccess: () => void
}

function EditProductDialog({ product, onClose, onSuccess }: EditProductDialogProps) {
  const [formData, setFormData] = useState({
    name: product.name,
    sku: product.sku,
    barcode: product.barcode || "",
    category: product.category,
    price: product.price.toString(),
    costPrice: product.costPrice?.toString() || "0",
    quantity: product.quantity.toString(),
    reorderLevel: product.reorderLevel?.toString() || "10",
    unitOfMeasure: product.unitOfMeasure || "Unit",
    description: product.description || "",
    batchNumber: product.batchNumber || "",
    manufacturer: product.manufacturer || "",
    expiryDate: product.expiryDate ? product.expiryDate.split("T")[0] : "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch("/api/admin/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: product.id,
          ...formData,
          price: parseFloat(formData.price),
          costPrice: parseFloat(formData.costPrice),
          quantity: parseInt(formData.quantity),
          reorderLevel: parseInt(formData.reorderLevel),
          barcode: formData.barcode || null,
          batchNumber: formData.batchNumber || null,
          manufacturer: formData.manufacturer || null,
          expiryDate: formData.expiryDate || null,
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Product updated successfully",
        })
        onSuccess()
      } else {
        const data = await response.json()
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to update product",
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
          <CardTitle>Edit Product</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Product Name *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-sku">SKU *</Label>
                <Input
                  id="edit-sku"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  required
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-barcode">Barcode</Label>
                <Input
                  id="edit-barcode"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-category">Category *</Label>
                <Input
                  id="edit-category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-price">Price *</Label>
                <Input
                  id="edit-price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-costPrice">Cost Price *</Label>
                <Input
                  id="edit-costPrice"
                  type="number"
                  step="0.01"
                  value={formData.costPrice}
                  onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-quantity">Quantity</Label>
                <Input
                  id="edit-quantity"
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-reorderLevel">Reorder Level</Label>
                <Input
                  id="edit-reorderLevel"
                  type="number"
                  value={formData.reorderLevel}
                  onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-unitOfMeasure">Unit of Measure</Label>
                <select
                  id="edit-unitOfMeasure"
                  value={formData.unitOfMeasure}
                  onChange={(e) => setFormData({ ...formData, unitOfMeasure: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  title="Unit of Measure"
                >
                  <option value="Unit">Unit</option>
                  <option value="Box">Box</option>
                  <option value="Strip">Strip</option>
                  <option value="Bottle">Bottle</option>
                  <option value="Pack">Pack</option>
                  <option value="Tube">Tube</option>
                  <option value="Vial">Vial</option>
                  <option value="Sachet">Sachet</option>
                  <option value="Carton">Carton</option>
                  <option value="ml">ml</option>
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                  <option value="L">L</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-batchNumber">Batch Number</Label>
                <Input
                  id="edit-batchNumber"
                  value={formData.batchNumber}
                  onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                  placeholder="e.g., BATCH-2025-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-manufacturer">Manufacturer</Label>
                <Input
                  id="edit-manufacturer"
                  value={formData.manufacturer}
                  onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-expiryDate">Expiry Date</Label>
                <Input
                  id="edit-expiryDate"
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
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
                {isLoading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

interface UpdateStockDialogProps {
  products: Product[]
  onClose: () => void
  onSuccess: () => void
}

function UpdateStockDialog({ products, onClose, onSuccess }: UpdateStockDialogProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [unitsToAdd, setUnitsToAdd] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleUpdateStock = async () => {
    if (!selectedProduct || !unitsToAdd) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a product and enter quantity to add",
      })
      return
    }

    const addQuantity = parseInt(unitsToAdd)
    if (isNaN(addQuantity) || addQuantity <= 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a valid positive number",
      })
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/admin/inventory/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProduct.id,
          quantity: addQuantity,
          type: "INCREASE",
          reason: "Stock replenishment",
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: `Added ${addQuantity} units to ${selectedProduct.name}. New stock: ${selectedProduct.quantity + addQuantity}`,
        })
        onSuccess()
      } else {
        const data = await response.json()
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to update stock",
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

  const incrementUnits = (amount: number) => {
    const current = parseInt(unitsToAdd) || 0
    setUnitsToAdd((current + amount).toString())
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <PackagePlus className="h-5 w-5 mr-2" />
            Update Stock
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedProduct ? (
            <>
              <div className="space-y-2">
                <Label>Search Product</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by name or SKU..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto border rounded-lg">
                {filteredProducts.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    No products found
                  </div>
                ) : (
                  filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => setSelectedProduct(product)}
                      className="w-full p-3 text-left hover:bg-gray-50 border-b last:border-b-0 transition-colors"
                    >
                      <div className="font-medium">{product.name}</div>
                      <div className="text-sm text-gray-500">
                        SKU: {product.sku} | Current Stock: {product.quantity} {product.unitOfMeasure}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900">{selectedProduct.name}</h3>
                <p className="text-sm text-blue-800">SKU: {selectedProduct.sku}</p>
                <p className="text-sm text-blue-800 mt-2">
                  Current Stock: <strong>{selectedProduct.quantity} {selectedProduct.unitOfMeasure}</strong>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="units-to-add">Basic Units to Add</Label>
                <div className="flex gap-2">
                  <Input
                    id="units-to-add"
                    type="number"
                    min="1"
                    value={unitsToAdd}
                    onChange={(e) => setUnitsToAdd(e.target.value)}
                    placeholder="Enter quantity"
                    className="flex-1"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button type="button" variant="outline" size="sm" onClick={() => incrementUnits(10)}>
                    +10
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => incrementUnits(25)}>
                    +25
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => incrementUnits(50)}>
                    +50
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => incrementUnits(100)}>
                    +100
                  </Button>
                </div>
              </div>

              {unitsToAdd && parseInt(unitsToAdd) > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-800">
                    New Stock after update: <strong>{selectedProduct.quantity + parseInt(unitsToAdd)} {selectedProduct.unitOfMeasure}</strong>
                  </p>
                </div>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSelectedProduct(null)
                  setUnitsToAdd("")
                }}
              >
                ← Select Different Product
              </Button>
            </>
          )}

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateStock}
              disabled={isLoading || !selectedProduct || !unitsToAdd}
            >
              {isLoading ? "Updating..." : "Update Stock"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
