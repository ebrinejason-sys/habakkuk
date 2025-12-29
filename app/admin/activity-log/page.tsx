"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"

export const dynamic = 'force-dynamic'

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { 
  Activity,
  Search,
  User,
  Package,
  ShoppingCart,
  Settings,
  FileText,
  Download,
  Filter
} from "lucide-react"

interface AuditLog {
  id: string
  userId: string
  action: string
  entity: string
  entityId?: string
  details?: string
  ipAddress?: string
  createdAt: string
  user: {
    name: string
    email: string
    role: string
  }
}

export default function ActivityLogPage() {
  const { data: session } = useSession()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [entityFilter, setEntityFilter] = useState("")
  const [dateFilter, setDateFilter] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchLogs()
  }, [])

  useEffect(() => {
    let filtered = [...logs]
    
    if (searchQuery) {
      filtered = filtered.filter(
        (log) =>
          log.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (log.details && log.details.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    }
    
    if (entityFilter) {
      filtered = filtered.filter((log) => log.entity === entityFilter)
    }
    
    if (dateFilter) {
      const filterDate = new Date(dateFilter)
      filtered = filtered.filter((log) => {
        const logDate = new Date(log.createdAt)
        return logDate.toDateString() === filterDate.toDateString()
      })
    }
    
    setFilteredLogs(filtered)
  }, [searchQuery, entityFilter, dateFilter, logs])

  const fetchLogs = async () => {
    try {
      const response = await fetch("/api/admin/activity-log")
      const data = await response.json()
      if (Array.isArray(data)) {
        setLogs(data)
        setFilteredLogs(data)
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch activity logs",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getEntityIcon = (entity: string) => {
    switch (entity) {
      case "USER": return <User className="h-4 w-4" />
      case "PRODUCT": return <Package className="h-4 w-4" />
      case "TRANSACTION": return <ShoppingCart className="h-4 w-4" />
      case "ORDER": return <FileText className="h-4 w-4" />
      case "SETTINGS": return <Settings className="h-4 w-4" />
      default: return <Activity className="h-4 w-4" />
    }
  }

  const getEntityColor = (entity: string) => {
    switch (entity) {
      case "USER": return "bg-blue-100 text-blue-700"
      case "PRODUCT": return "bg-green-100 text-green-700"
      case "TRANSACTION": return "bg-purple-100 text-purple-700"
      case "ORDER": return "bg-orange-100 text-orange-700"
      case "SETTINGS": return "bg-gray-100 text-gray-700"
      default: return "bg-gray-100 text-gray-700"
    }
  }

  const getActionColor = (action: string) => {
    if (action.includes("CREATE") || action.includes("ADD")) return "text-green-600"
    if (action.includes("DELETE") || action.includes("REMOVE")) return "text-red-600"
    if (action.includes("UPDATE") || action.includes("EDIT")) return "text-blue-600"
    return "text-gray-600"
  }

  const exportLogs = () => {
    const csvContent = [
      ["Date", "User", "Role", "Action", "Entity", "Details"].join(","),
      ...filteredLogs.map(log => [
        new Date(log.createdAt).toLocaleString(),
        log.user.name,
        log.user.role,
        log.action,
        log.entity,
        log.details || ""
      ].map(field => `"${field}"`).join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `activity-log-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
  }

  const uniqueEntities = [...new Set(logs.map(log => log.entity))]

  // Stats
  const todayLogs = logs.filter(log => {
    const today = new Date()
    const logDate = new Date(log.createdAt)
    return logDate.toDateString() === today.toDateString()
  }).length

  const thisWeekLogs = logs.filter(log => {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const logDate = new Date(log.createdAt)
    return logDate >= weekAgo
  }).length

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Activity Log</h1>
          <p className="text-gray-500 mt-2">Monitor all system activities and user actions</p>
        </div>
        <Button variant="outline" onClick={exportLogs}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Logs</CardTitle>
            <Activity className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{logs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today</CardTitle>
            <Activity className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{todayLogs}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <Activity className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{thisWeekLogs}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Entities</CardTitle>
            <Filter className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{uniqueEntities.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle>Activity Logs ({filteredLogs.length})</CardTitle>
            <div className="flex flex-wrap gap-2">
              <select
                value={entityFilter}
                onChange={(e) => setEntityFilter(e.target.value)}
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                title="Filter by Entity"
              >
                <option value="">All Entities</option>
                {uniqueEntities.map(entity => (
                  <option key={entity} value={entity}>{entity}</option>
                ))}
              </select>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-40"
              />
              <div className="relative w-48">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search..."
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
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm text-gray-500">
                    {new Date(log.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{log.user.name}</div>
                      <div className="text-xs text-gray-500">{log.user.role}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`font-medium ${getActionColor(log.action)}`}>
                      {log.action.replace(/_/g, " ")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 text-xs rounded-full flex items-center gap-1 w-fit ${getEntityColor(log.entity)}`}>
                      {getEntityIcon(log.entity)}
                      {log.entity}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[300px] truncate text-sm text-gray-600">
                    {log.details || "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredLogs.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No activity logs found
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
