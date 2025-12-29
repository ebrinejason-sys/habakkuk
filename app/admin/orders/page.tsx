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
import { formatCurrency } from "@/lib/utils"
import { Plus, Search, Eye, CheckCircle, XCircle, Clock, Package, DollarSign } from "lucide-react"

interface Order {
  id: string
  orderNo: string
  totalAmount: number
  status: string
  notes?: string
  deliveryAddress?: string
  createdAt: string
  customer: {
    name: string
    email: string
    phone?: string
  }
  items: Array<{
    id: string
    quantity: number
    unitPrice: number
    totalPrice: number
    product: {
      name: string
      sku: string
      unitOfMeasure: string
    }
  }>
  processedByUser?: {
    name: string
  }
}

interface OrderStats {
  pending: number
  completed: number
  cancelled: number
  totalRevenue: number
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<OrderStats>({ pending: 0, completed: 0, cancelled: 0, totalRevenue: 0 })
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchOrders()
  }, [])

  useEffect(() => {
    let filtered = [...orders]

    if (searchQuery) {
      filtered = filtered.filter(
        (order) =>
          order.orderNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
          order.customer.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    if (statusFilter) {
      filtered = filtered.filter((order) => order.status === statusFilter)
    }

    setFilteredOrders(filtered)
  }, [searchQuery, statusFilter, orders])

  const fetchOrders = async () => {
    try {
      const response = await fetch("/api/admin/orders")
      const data = await response.json()
      setOrders(data.orders)
      setFilteredOrders(data.orders)
      setStats(data.stats)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch orders",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      const response = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, status: newStatus }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: `Order ${newStatus.toLowerCase()} successfully`,
        })
        fetchOrders()
      } else {
        const data = await response.json()
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to update order",
        })
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred",
      })
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Clock className="h-4 w-4" />
      case "COMPLETED":
        return <CheckCircle className="h-4 w-4" />
      case "CANCELLED":
        return <XCircle className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-700"
      case "COMPLETED":
        return "bg-green-100 text-green-700"
      case "CANCELLED":
        return "bg-red-100 text-red-700"
      default:
        return "bg-gray-100 text-gray-700"
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Orders Management</h1>
          <p className="text-gray-500 mt-2">Manage open tabs and customer orders</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Order
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.cancelled}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
          </CardContent>
        </Card>
      </div>

      {showCreateDialog && (
        <CreateOrderDialog
          onClose={() => setShowCreateDialog(false)}
          onSuccess={() => {
            setShowCreateDialog(false)
            fetchOrders()
          }}
        />
      )}

      {selectedOrder && (
        <OrderDetailsDialog
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onStatusChange={handleStatusChange}
        />
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Orders ({filteredOrders.length})</CardTitle>
            <div className="flex gap-4">
              <div className="relative w-48">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  title="Filter by Status"
                  aria-label="Filter by Status"
                >
                  <option value="">All Status</option>
                  <option value="PENDING">Pending</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search orders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.orderNo}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{order.customer.name}</div>
                      <div className="text-xs text-gray-500">{order.customer.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>{order.items.length} items</TableCell>
                  <TableCell className="font-semibold">{formatCurrency(order.totalAmount)}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 text-xs rounded-full flex items-center gap-1 w-fit ${getStatusColor(order.status)}`}>
                      {getStatusIcon(order.status)}
                      {order.status}
                    </span>
                  </TableCell>
                  <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {order.status === "PENDING" && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStatusChange(order.id, "COMPLETED")}
                        >
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStatusChange(order.id, "CANCELLED")}
                        >
                          <XCircle className="h-4 w-4 text-red-600" />
                        </Button>
                      </>
                    )}
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

interface CreateOrderDialogProps {
  onClose: () => void
  onSuccess: () => void
}

function CreateOrderDialog({ onClose, onSuccess }: CreateOrderDialogProps) {
  const [customers, setCustomers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState("")
  const [orderItems, setOrderItems] = useState<Array<{ productId: string; quantity: number }>>([])
  const [notes, setNotes] = useState("")
  const [deliveryAddress, setDeliveryAddress] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchCustomers()
    fetchProducts()
  }, [])

  const fetchCustomers = async () => {
    const response = await fetch("/api/admin/customers")
    const data = await response.json()
    setCustomers(data)
  }

  const fetchProducts = async () => {
    const response = await fetch("/api/admin/inventory")
    const data = await response.json()
    setProducts(data.filter((p: any) => p.quantity > 0))
  }

  const addItem = () => {
    setOrderItems([...orderItems, { productId: "", quantity: 1 }])
  }

  const removeItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: string, value: any) => {
    const updated = [...orderItems]
    updated[index] = { ...updated[index], [field]: value }
    setOrderItems(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedCustomer || orderItems.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select customer and add at least one item",
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
          items: orderItems,
          notes,
          deliveryAddress,
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Order created successfully",
        })
        onSuccess()
      } else {
        const data = await response.json()
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to create order",
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
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>Create New Order</CardTitle>
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
              <div className="flex items-center justify-between">
                <Label>Order Items *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>
              {orderItems.map((item, index) => (
                <div key={index} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <select
                      value={item.productId}
                      onChange={(e) => updateItem(index, "productId", e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      required
                      title="Select Product"
                      aria-label="Select Product"
                    >
                      <option value="">Select Product</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} - {formatCurrency(product.price)} (Stock: {product.quantity})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-24">
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value))}
                      placeholder="Qty"
                      required
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(index)}
                  >
                    <XCircle className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
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

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Creating..." : "Create Order"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

interface OrderDetailsDialogProps {
  order: Order
  onClose: () => void
  onStatusChange: (orderId: string, status: string) => void
}

function OrderDetailsDialog({ order, onClose, onStatusChange }: OrderDetailsDialogProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Order Details - {order.orderNo}</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-600">Customer</Label>
              <p className="font-semibold">{order.customer.name}</p>
              <p className="text-sm text-gray-500">{order.customer.email}</p>
              {order.customer.phone && <p className="text-sm text-gray-500">{order.customer.phone}</p>}
            </div>
            <div>
              <Label className="text-gray-600">Order Date</Label>
              <p className="font-semibold">{new Date(order.createdAt).toLocaleString()}</p>
            </div>
            <div>
              <Label className="text-gray-600">Status</Label>
              <p className="font-semibold">{order.status}</p>
            </div>
            <div>
              <Label className="text-gray-600">Total Amount</Label>
              <p className="font-semibold text-lg">{formatCurrency(order.totalAmount)}</p>
            </div>
          </div>

          {order.deliveryAddress && (
            <div>
              <Label className="text-gray-600">Delivery Address</Label>
              <p>{order.deliveryAddress}</p>
            </div>
          )}

          {order.notes && (
            <div>
              <Label className="text-gray-600">Notes</Label>
              <p>{order.notes}</p>
            </div>
          )}

          <div>
            <Label className="text-gray-600 mb-2 block">Order Items</Label>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.product.name}</TableCell>
                    <TableCell>{item.product.sku}</TableCell>
                    <TableCell className="text-right">
                      {item.quantity} {item.product.unitOfMeasure}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(item.totalPrice)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {order.processedByUser && (
            <div>
              <Label className="text-gray-600">Processed By</Label>
              <p>{order.processedByUser.name}</p>
            </div>
          )}

          {order.status === "PENDING" && (
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  onStatusChange(order.id, "CANCELLED")
                  onClose()
                }}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancel Order
              </Button>
              <Button
                onClick={() => {
                  onStatusChange(order.id, "COMPLETED")
                  onClose()
                }}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Complete Order
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
