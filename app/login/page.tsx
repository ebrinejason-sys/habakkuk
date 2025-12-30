"use client"

import { useState, useEffect } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

interface Settings {
  pharmacyName: string
}

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [settings, setSettings] = useState<Settings | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // First, check if user requires 2FA
      const checkResponse = await fetch("/api/auth/check-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      })

      const checkData = await checkResponse.json()

      if (checkResponse.ok && checkData.requires2FA) {
        // Send 2FA code
        const sendResponse = await fetch("/api/auth/2fa/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: checkData.email }),
        })

        const sendData = await sendResponse.json()

        if (sendResponse.ok) {
          // Redirect to 2FA page
          toast({
            title: "2FA Required",
            description: `Verification code sent to ${sendData.sentTo}`,
          })
          router.push(`/auth/2fa?email=${encodeURIComponent(checkData.email)}&sentTo=${encodeURIComponent(sendData.sentTo)}`)
          return
        }
      }

      // Normal login flow for non-2FA users
      const result = await signIn("credentials", {
        identifier,
        password,
        redirect: false,
      })

      if (result?.error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Invalid email/username or password",
        })
      } else {
        // Fetch session to determine where to redirect
        const response = await fetch("/api/auth/session")
        const session = await response.json()

        if (session?.user) {
          if (session.user.mustChangePassword) {
            router.push("/change-password")
          } else {
            // All users (admin and staff) go to portal
            router.push("/portal/dashboard")
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="space-y-3 text-center pb-6">
          <Link href="/" className="flex justify-center mb-2">
            <div className="relative w-20 h-20 rounded-2xl overflow-hidden shadow-lg bg-white">
              <Image
                src="/logo.png"
                alt="Pharmacy Logo"
                fill
                className="object-contain p-2"
              />
            </div>
          </Link>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            {settings?.pharmacyName || "Habakkuk Pharmacy"}
          </CardTitle>
          <CardDescription className="text-base">Staff & Admin Portal</CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="identifier" className="text-sm font-medium">Email or Username</Label>
              <Input
                id="identifier"
                type="text"
                placeholder="your@email.com or username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                disabled={isLoading}
                className="h-11 transition-all duration-200 focus:ring-2 focus:ring-emerald-500"
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
                className="h-11 transition-all duration-200 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-base font-semibold shadow-lg transition-all duration-200" 
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
              <Link href="/customer/login" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium hover:underline transition-colors">
                Customer Portal →
              </Link>
              <span className="hidden sm:inline text-gray-400">|</span>
              <Link href="/" className="text-sm text-teal-600 hover:text-teal-700 font-medium hover:underline transition-colors">
                ← Back to Home
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
