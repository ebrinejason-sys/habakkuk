"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2, ShieldCheck, Mail } from "lucide-react"

function TwoFactorContent() {
  const [code, setCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const email = searchParams.get("email")
  const sentTo = searchParams.get("sentTo")

  useEffect(() => {
    if (!email) {
      router.push("/login")
    }
  }, [email, router])

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Success",
          description: "2FA verification successful. Redirecting...",
        })
        
        // Now sign in with NextAuth using the verified user's ID as a special token
        const { signIn } = await import("next-auth/react")
        const result = await signIn("credentials", {
          email: data.user.email,
          password: `2FA_VERIFIED:${data.user.id}`, // Special token for 2FA-verified session
          redirect: false,
        })

        if (result?.ok) {
          if (data.user.mustChangePassword) {
            router.push("/change-password")
          } else if (data.user.role === "ADMIN") {
            router.push("/admin/dashboard")
          } else {
            router.push("/staff/dashboard")
          }
        } else {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to create session",
          })
        }
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Invalid verification code",
        })
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred during verification",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    if (countdown > 0) return

    setIsResending(true)

    try {
      const response = await fetch("/api/auth/2fa/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Code Sent",
          description: `A new verification code has been sent to ${data.sentTo}`,
        })
        setCountdown(60) // 60 seconds cooldown
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to resend code",
        })
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred while resending code",
      })
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-purple-50 via-white to-blue-50">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="space-y-3 text-center pb-6">
          <div className="flex justify-center mb-2">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
              <ShieldCheck className="h-10 w-10 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Two-Factor Authentication
          </CardTitle>
          <CardDescription className="text-base">
            Enter the verification code sent to your email
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          {sentTo && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start space-x-3">
              <Mail className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-900">Code sent to:</p>
                <p className="text-sm text-blue-700 font-mono">{sentTo}</p>
                <p className="text-xs text-blue-600 mt-1">Check your inbox and spam folder</p>
              </div>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="code" className="text-sm font-medium">Verification Code</Label>
              <Input
                id="code"
                type="text"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                disabled={isLoading}
                className="h-14 text-center text-2xl font-bold tracking-widest transition-all duration-200 focus:ring-2 focus:ring-purple-500"
                maxLength={6}
                autoFocus
              />
              <p className="text-xs text-gray-500 text-center">
                Enter the 6-digit code from your email
              </p>
            </div>

            <Button 
              type="submit" 
              className="w-full h-11 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-base font-semibold shadow-lg transition-all duration-200" 
              disabled={isLoading || code.length !== 6}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify & Sign In"
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t space-y-3 text-center">
            <p className="text-sm text-gray-600">Didn't receive the code?</p>
            <Button
              variant="outline"
              onClick={handleResend}
              disabled={isResending || countdown > 0}
              className="w-full"
            >
              {isResending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : countdown > 0 ? (
                `Resend code in ${countdown}s`
              ) : (
                "Resend Code"
              )}
            </Button>
            <div>
              <a href="/login" className="text-sm text-purple-600 hover:text-purple-700 font-medium hover:underline transition-colors">
                ← Back to Login
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function TwoFactorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-purple-50 via-white to-blue-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-purple-600" />
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <TwoFactorContent />
    </Suspense>
  )
}
