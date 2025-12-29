"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  ShoppingCart, 
  Package, 
  Users, 
  TrendingUp, 
  Shield, 
  Clock, 
  Smartphone, 
  CheckCircle,
  ArrowRight,
  Zap,
  Globe,
  Lock,
  HeartPulse,
  Phone,
  Mail,
  MapPin,
  Menu,
  X
} from "lucide-react"

interface Settings {
  pharmacyName: string
  location: string
  contact: string
  email: string
  logo?: string
  footerText?: string
}

export default function LandingPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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

  const pharmacyName = settings?.pharmacyName || "Habakkuk Pharmacy"
  const location = settings?.location || "Kampala, Uganda"
  const contact = settings?.contact || "+256 700 000000"
  const email = settings?.email || "info@habakkukpharmacy.com"

  const features = [
    {
      icon: ShoppingCart,
      title: "Smart Point of Sale",
      description: "Lightning-fast checkout with receipt generation, multiple payment methods, and real-time inventory updates.",
      color: "text-blue-600",
      bg: "bg-blue-50"
    },
    {
      icon: Package,
      title: "Intelligent Inventory",
      description: "Track stock levels, set reorder points, bulk upload products via CSV/Excel, and get low-stock alerts.",
      color: "text-emerald-600",
      bg: "bg-emerald-50"
    },
    {
      icon: Users,
      title: "Staff Management",
      description: "Create user accounts with role-based permissions, send credentials via email, and maintain audit trails.",
      color: "text-purple-600",
      bg: "bg-purple-50"
    },
    {
      icon: TrendingUp,
      title: "Business Analytics",
      description: "Real-time dashboards showing sales trends, revenue tracking, and comprehensive transaction history.",
      color: "text-orange-600",
      bg: "bg-orange-50"
    },
    {
      icon: Globe,
      title: "Customer Portal",
      description: "Let customers browse products, place orders online, and manage their accounts from any device.",
      color: "text-pink-600",
      bg: "bg-pink-50"
    },
    {
      icon: Lock,
      title: "Enterprise Security",
      description: "Bank-grade encryption, role-based access control, secure authentication, and complete data protection.",
      color: "text-red-600",
      bg: "bg-red-50"
    }
  ]

  const stats = [
    { label: "Uptime Guarantee", value: "99.9%", icon: Zap },
    { label: "Response Time", value: "<100ms", icon: Clock },
    { label: "Secure Transactions", value: "SSL", icon: Shield },
    { label: "Mobile Ready", value: "100%", icon: Smartphone }
  ]

  const benefits = [
    "Reduce checkout time by 60% with intuitive POS interface",
    "Eliminate stock-outs with automated reorder alerts",
    "Access your business from anywhere, anytime",
    "Generate detailed reports in seconds, not hours",
    "Scale effortlessly as your pharmacy grows",
    "Automatic daily backups keep your data safe"
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Mobile Navigation - Centered Logo */}
          <div className="md:hidden flex items-center justify-between h-16">
            {/* Mobile Menu Button - Left */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>

            {/* Centered Logo - Mobile */}
            <Link href="/" className="flex flex-col items-center hover:opacity-90 transition-opacity">
              <div className="relative w-10 h-10">
                <Image
                  src="/logo.png"
                  alt={`${pharmacyName} Logo`}
                  fill
                  className="object-contain rounded-lg"
                  priority
                />
              </div>
              <span className="text-xs font-semibold text-gray-900 mt-0.5">{pharmacyName}</span>
            </Link>

            {/* Right spacer for balance */}
            <div className="w-10"></div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex justify-between items-center h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-3 hover:opacity-90 transition-opacity">
              <div className="relative w-12 h-12">
                <Image
                  src="/logo.png"
                  alt={`${pharmacyName} Logo`}
                  fill
                  className="object-contain rounded-lg"
                  priority
                />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold text-gray-900">
                  {pharmacyName}
                </span>
                <span className="text-xs text-gray-500">Your Health, Our Priority</span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <div className="flex items-center space-x-6">
              <Link href="#features" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
                Features
              </Link>
              <Link href="#about" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
                About
              </Link>
              <Link href="#contact" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
                Contact
              </Link>
              <Link href="/customer/shop">
                <Button variant="ghost" className="font-medium">
                  Shop Products
                </Button>
              </Link>
              <Link href="/customer/login">
                <Button variant="outline" className="font-medium">
                  Customer Portal
                </Button>
              </Link>
              <Link href="/login">
                <Button className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 font-medium">
                  Staff Login
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t shadow-lg">
            <div className="px-4 py-4 space-y-3">
              <Link 
                href="#features" 
                className="block py-2 text-gray-600 hover:text-gray-900 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Features
              </Link>
              <Link 
                href="#about" 
                className="block py-2 text-gray-600 hover:text-gray-900 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                About
              </Link>
              <Link 
                href="#contact" 
                className="block py-2 text-gray-600 hover:text-gray-900 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Contact
              </Link>
              <div className="pt-3 space-y-2 border-t">
                <Link href="/customer/shop" className="block">
                  <Button variant="outline" className="w-full justify-center">
                    Shop Products
                  </Button>
                </Link>
                <Link href="/customer/login" className="block">
                  <Button variant="outline" className="w-full justify-center">
                    Customer Portal
                  </Button>
                </Link>
                <Link href="/login" className="block">
                  <Button className="w-full justify-center bg-gradient-to-r from-emerald-600 to-teal-600">
                    Staff Login
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative pt-24 md:pt-32 pb-16 md:pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-teal-50 -z-10" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-bl from-emerald-100/50 to-transparent -z-10" />
        
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="text-center lg:text-left space-y-6 md:space-y-8">
              <div className="inline-flex items-center px-4 py-2 bg-emerald-100 rounded-full text-emerald-700 text-sm font-medium">
                <HeartPulse className="h-4 w-4 mr-2" />
                Your Trusted Healthcare Partner
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight">
                <span className="block text-gray-900">Quality Medicine,</span>
                <span className="block bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  Caring Service
                </span>
              </h1>
              
              <p className="text-lg md:text-xl text-gray-600 max-w-xl mx-auto lg:mx-0">
                {pharmacyName} offers premium healthcare products and professional pharmaceutical services. 
                Your health and well-being are our top priority.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link href="/customer/shop">
                  <Button size="lg" className="w-full sm:w-auto text-base md:text-lg h-12 md:h-14 px-6 md:px-8 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-500/25">
                    Browse Products
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="#contact">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto text-base md:text-lg h-12 md:h-14 px-6 md:px-8 border-2">
                    <Phone className="mr-2 h-5 w-5" />
                    Contact Us
                  </Button>
                </Link>
              </div>

              {/* Quick Contact */}
              <div className="flex flex-wrap justify-center lg:justify-start gap-4 md:gap-6 pt-4 text-sm text-gray-600">
                <a href={`tel:${contact}`} className="flex items-center hover:text-emerald-600 transition-colors">
                  <Phone className="h-4 w-4 mr-2" />
                  {contact}
                </a>
                <a href={`mailto:${email}`} className="flex items-center hover:text-emerald-600 transition-colors">
                  <Mail className="h-4 w-4 mr-2" />
                  {email}
                </a>
              </div>
            </div>

            {/* Right Content - Logo/Image Display */}
            <div className="hidden lg:flex justify-center items-center">
              <div className="relative">
                {/* Decorative Circles */}
                <div className="absolute -top-8 -left-8 w-72 h-72 bg-emerald-200 rounded-full opacity-20 blur-3xl" />
                <div className="absolute -bottom-8 -right-8 w-72 h-72 bg-teal-200 rounded-full opacity-20 blur-3xl" />
                
                {/* Main Logo Card */}
                <div className="relative bg-white rounded-3xl shadow-2xl p-8 md:p-12 border">
                  <div className="relative w-48 h-48 md:w-64 md:h-64 mx-auto">
                    <Image
                      src="/logo.png"
                      alt={`${pharmacyName} Logo`}
                      fill
                      className="object-contain"
                      priority
                    />
                  </div>
                  <div className="text-center mt-6">
                    <h2 className="text-2xl font-bold text-gray-900">{pharmacyName}</h2>
                    <p className="text-gray-500 mt-1">Your Health, Our Priority</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12 md:mt-16">
            {stats.map((stat, index) => (
              <Card key={index} className="border-none shadow-lg bg-white/80 backdrop-blur hover:shadow-xl transition-shadow">
                <CardContent className="p-4 md:pt-6 text-center">
                  <stat.icon className="h-6 w-6 md:h-8 md:w-8 mx-auto mb-2 text-emerald-600" />
                  <div className="text-xl md:text-2xl font-bold text-gray-900">{stat.value}</div>
                  <div className="text-xs md:text-sm text-gray-600">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Comprehensive Healthcare Services
            </h2>
            <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">
              State-of-the-art pharmacy management for better healthcare delivery
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-none shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <CardHeader>
                  <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl ${feature.bg} flex items-center justify-center mb-4`}>
                    <feature.icon className={`h-6 w-6 md:h-7 md:w-7 ${feature.color}`} />
                  </div>
                  <CardTitle className="text-lg md:text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm md:text-base text-gray-600">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-16 md:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 md:gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                Why Choose {pharmacyName}?
              </h2>
              <p className="text-lg text-gray-600">
                We combine years of pharmaceutical expertise with modern technology to deliver 
                exceptional healthcare services. Our commitment to quality and customer care 
                sets us apart.
              </p>
              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <CheckCircle className="h-5 w-5 md:h-6 md:w-6 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700 text-sm md:text-base">{benefit}</span>
                  </div>
                ))}
              </div>
              <div className="pt-4">
                <Link href="/customer/shop">
                  <Button size="lg" className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700">
                    Explore Our Products
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* CTA Card */}
            <Card className="border-none shadow-2xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white">
              <CardHeader>
                <div className="flex justify-center mb-4">
                  <div className="relative w-20 h-20 bg-white rounded-2xl p-2">
                    <Image
                      src="/logo.png"
                      alt={`${pharmacyName} Logo`}
                      fill
                      className="object-contain p-2"
                    />
                  </div>
                </div>
                <CardTitle className="text-2xl md:text-3xl text-white text-center">Ready to Get Started?</CardTitle>
                <CardDescription className="text-emerald-100 text-base md:text-lg text-center">
                  Access our services today
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Link href="/customer/shop" className="block">
                  <Button size="lg" className="w-full bg-white text-emerald-600 hover:bg-gray-100 h-12 md:h-14 text-base md:text-lg font-semibold">
                    <ShoppingCart className="mr-2 h-5 w-5" />
                    Shop Now
                  </Button>
                </Link>
                <Link href="/customer/login" className="block">
                  <Button size="lg" variant="outline" className="w-full border-2 border-white text-white hover:bg-white/10 h-12 md:h-14 text-base md:text-lg">
                    Customer Portal
                  </Button>
                </Link>
                <Link href="/login" className="block">
                  <Button size="lg" variant="outline" className="w-full border-2 border-white text-white hover:bg-white/10 h-12 md:h-14 text-base md:text-lg">
                    Staff Login
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Get In Touch</h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Have questions? We&apos;re here to help. Reach out to us through any of the following channels.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="pt-6 text-center">
                <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Phone className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Call Us</h3>
                <a href={`tel:${contact}`} className="text-emerald-400 hover:text-emerald-300 transition-colors">
                  {contact}
                </a>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="pt-6 text-center">
                <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Email Us</h3>
                <a href={`mailto:${email}`} className="text-emerald-400 hover:text-emerald-300 transition-colors">
                  {email}
                </a>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700 sm:col-span-2 lg:col-span-1">
              <CardContent className="pt-6 text-center">
                <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapPin className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Visit Us</h3>
                <p className="text-gray-400">{location}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 text-gray-400 py-8 md:py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="sm:col-span-2 lg:col-span-1">
              <Link href="/" className="flex items-center space-x-3 mb-4">
                <div className="relative w-10 h-10">
                  <Image
                    src="/logo.png"
                    alt={`${pharmacyName} Logo`}
                    fill
                    className="object-contain rounded-lg"
                  />
                </div>
                <span className="text-lg font-bold text-white">{pharmacyName}</span>
              </Link>
              <p className="text-sm">
                Your trusted healthcare partner. Quality medicine, caring service.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="font-semibold text-white mb-4">Quick Links</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/customer/shop" className="hover:text-white transition-colors">Shop Products</Link></li>
                <li><Link href="/customer/login" className="hover:text-white transition-colors">Customer Portal</Link></li>
                <li><Link href="/login" className="hover:text-white transition-colors">Staff Login</Link></li>
              </ul>
            </div>

            {/* Services */}
            <div>
              <h3 className="font-semibold text-white mb-4">Services</h3>
              <ul className="space-y-2 text-sm">
                <li>Prescription Drugs</li>
                <li>Over-the-Counter Medicine</li>
                <li>Health Consultations</li>
                <li>Home Delivery</li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h3 className="font-semibold text-white mb-4">Contact</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center">
                  <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                  {location}
                </li>
                <li>
                  <a href={`tel:${contact}`} className="flex items-center hover:text-white transition-colors">
                    <Phone className="h-4 w-4 mr-2 flex-shrink-0" />
                    {contact}
                  </a>
                </li>
                <li>
                  <a href={`mailto:${email}`} className="flex items-center hover:text-white transition-colors">
                    <Mail className="h-4 w-4 mr-2 flex-shrink-0" />
                    {email}
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm">
            <p>&copy; {new Date().getFullYear()} {pharmacyName}. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
