"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Invalid email or password",
        })
      } else {
        // Fetch session to determine where to redirect
        const response = await fetch("/api/auth/session")
        const session = await response.json()

        if (session?.user) {
          if (session.user.mustChangePassword) {
            router.push("/change-password")
          } else if (session.user.role === "ADMIN") {
            router.push("/admin/dashboard")
          } else {
            router.push("/staff/dashboard")
          }
        }
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred during login",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-purple-50 via-white to-blue-50">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="space-y-3 text-center pb-6">
          <div className="flex justify-center mb-2">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-3xl font-bold text-white">HP</span>
            </div>
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Habakkuk Pharmacy
          </CardTitle>
          <CardDescription className="text-base">Staff & Admin Portal</CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="h-11 transition-all duration-200 focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="h-11 transition-all duration-200 focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-11 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-base font-semibold shadow-lg transition-all duration-200" 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
          <div className="mt-6 pt-6 border-t text-center">
            <p className="text-sm text-gray-600 mb-2">Looking for something else?</p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <a href="/customer/login" className="text-sm text-purple-600 hover:text-purple-700 font-medium hover:underline transition-colors">
                Customer Portal →
              </a>
              <span className="hidden sm:inline text-gray-400">|</span>
              <a href="/" className="text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors">
                ← Back to Home
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
