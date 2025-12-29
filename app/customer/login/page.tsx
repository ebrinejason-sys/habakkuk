"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"

export default function CustomerLoginPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch("/api/customer/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, action: "login" }),
      })

      if (response.ok) {
        const data = await response.json()
        localStorage.setItem("customerId", data.customerId)
        router.push("/customer/shop")
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Invalid credentials",
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch("/api/customer/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, action: "register" }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Account created successfully",
        })
        setIsLogin(true)
      } else {
        const data = await response.json()
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Registration failed",
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-green-50 via-white to-blue-50">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="text-center space-y-3 pb-6">
          <div className="flex justify-center mb-2">
            <div className="w-20 h-20 bg-gradient-to-br from-green-600 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-3xl font-bold text-white">HP</span>
            </div>
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
            Habakkuk Pharmacy
          </CardTitle>
          <CardDescription className="text-base">
            {isLogin ? "Customer Portal - Sign In" : "Customer Portal - Create Account"}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-5">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="John Doe"
                  className="h-11 transition-all duration-200 focus:ring-2 focus:ring-green-500"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
                className="h-11 transition-all duration-200 focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="h-11 transition-all duration-200 focus:ring-2 focus:ring-green-500"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-11 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-base font-semibold shadow-lg transition-all duration-200" 
              disabled={isLoading}
            >
              {isLoading ? "Loading..." : isLogin ? "Sign In" : "Create Account"}
            </Button>
          </form>
          <div className="mt-6 pt-6 border-t space-y-3 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm font-medium text-green-600 hover:text-green-700 hover:underline transition-colors"
            >
              {isLogin ? "Don't have an account? Create one →" : "← Already have an account? Sign in"}
            </button>
            <div>
              <a href="/login" className="text-sm text-gray-500 hover:text-gray-700 hover:underline transition-colors">
                Staff/Admin Login
              </a>
              <span className="mx-2 text-gray-400">|</span>
              <a href="/" className="text-sm text-gray-500 hover:text-gray-700 hover:underline transition-colors">
                Back to Home
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
