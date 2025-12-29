"use client"

import { useEffect, useState } from "react"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Upload, X } from "lucide-react"
import Image from "next/image"

interface Settings {
  pharmacyName: string
  location: string
  contact: string
  email: string
  footerText: string
  currency: string
  taxRate: number
  logo?: string
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    pharmacyName: "",
    location: "",
    contact: "",
    email: "",
    footerText: "",
    currency: "UGX",
    taxRate: 0,
    logo: "",
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string>("")
  const { toast } = useToast()

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/admin/settings")
      if (response.ok) {
        const data = await response.json()
        if (data) {
          setSettings(data)
          if (data.logo) {
            setLogoPreview(data.logo)
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setLogoFile(file)
      
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeLogo = () => {
    setLogoFile(null)
    setLogoPreview("")
    setSettings({ ...settings, logo: "" })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      let logoData = settings.logo
      
      // If new logo file is selected, use the preview (base64)
      if (logoFile && logoPreview) {
        logoData = logoPreview
      }

      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, logo: logoData }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Settings saved successfully",
        })
        setLogoFile(null)
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to save settings",
        })
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred",
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-2">Configure pharmacy information and system settings</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Pharmacy Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Pharmacy Logo</Label>
              <div className="flex items-center gap-4">
                {logoPreview && (
                  <div className="relative w-32 h-32 border rounded-lg overflow-hidden">
                    <Image
                      src={logoPreview}
                      alt="Logo preview"
                      fill
                      className="object-contain"
                    />
                    <button
                      type="button"
                      onClick={removeLogo}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      title="Remove Logo"
                      aria-label="Remove Logo"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
                <div>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="mb-2"
                  />
                  <p className="text-xs text-gray-500">Upload your pharmacy logo (PNG, JPG, or GIF)</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pharmacyName">Pharmacy Name *</Label>
                <Input
                  id="pharmacyName"
                  value={settings.pharmacyName}
                  onChange={(e) => setSettings({ ...settings, pharmacyName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location *</Label>
                <Input
                  id="location"
                  value={settings.location}
                  onChange={(e) => setSettings({ ...settings, location: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact">Contact *</Label>
                <Input
                  id="contact"
                  value={settings.contact}
                  onChange={(e) => setSettings({ ...settings, contact: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={settings.email}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Receipt Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="footerText">Receipt Footer Text</Label>
              <Input
                id="footerText"
                value={settings.footerText}
                onChange={(e) => setSettings({ ...settings, footerText: e.target.value })}
                placeholder="Thank you for your purchase!"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Input
                  id="currency"
                  value={settings.currency}
                  onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxRate">Tax Rate (%)</Label>
                <Input
                  id="taxRate"
                  type="number"
                  step="0.01"
                  value={settings.taxRate}
                  onChange={(e) => setSettings({ ...settings, taxRate: parseFloat(e.target.value) })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Settings"
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
