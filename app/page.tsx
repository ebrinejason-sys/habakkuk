"use client"

import Link from "next/link"
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
  BarChart3,
  CheckCircle,
  ArrowRight,
  Zap,
  Globe,
  Lock,
  HeartPulse
} from "lucide-react"

export default function LandingPage() {
  const features = [
    {
      icon: ShoppingCart,
      title: "Smart Point of Sale",
      description: "Lightning-fast checkout with receipt generation, multiple payment methods, and real-time inventory updates.",
      color: "text-blue-600"
    },
    {
      icon: Package,
      title: "Intelligent Inventory",
      description: "Track stock levels, set reorder points, bulk upload products via CSV/Excel, and get low-stock alerts automatically.",
      color: "text-green-600"
    },
    {
      icon: Users,
      title: "Staff Management",
      description: "Create user accounts with role-based permissions, send credentials via email, and maintain full audit trails.",
      color: "text-purple-600"
    },
    {
      icon: TrendingUp,
      title: "Business Analytics",
      description: "Real-time dashboards showing sales trends, revenue tracking, and comprehensive transaction history.",
      color: "text-orange-600"
    },
    {
      icon: Globe,
      title: "Customer Portal",
      description: "Let customers browse products, place orders online, and manage their accounts from any device.",
      color: "text-pink-600"
    },
    {
      icon: Lock,
      title: "Enterprise Security",
      description: "Bank-grade encryption, role-based access control, secure authentication, and complete data protection.",
      color: "text-red-600"
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
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-green-50">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <HeartPulse className="h-8 w-8 text-blue-600" />
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                Habakkuk Pharmacy
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/customer/login">
                <Button variant="ghost" className="hidden sm:inline-flex">
                  Customer Portal
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline">Staff Login</Button>
              </Link>
              <Link href="/login">
                <Button className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-20 pb-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-8">
            <div className="inline-flex items-center px-4 py-2 bg-blue-100 rounded-full text-blue-700 text-sm font-medium">
              <Zap className="h-4 w-4 mr-2" />
              Cloud-Based Pharmacy Management System
            </div>
            
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight">
              <span className="block text-gray-900">Modern Pharmacy</span>
              <span className="block bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                Management Made Simple
              </span>
            </h1>
            
            <p className="max-w-2xl mx-auto text-xl text-gray-600">
              Complete point of sale, inventory management, and customer portal in one powerful platform. 
              Trusted by pharmacies to streamline operations and boost revenue.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link href="/login">
                <Button size="lg" className="w-full sm:w-auto text-lg h-14 px-8 bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/customer/shop">
                <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg h-14 px-8">
                  Browse Products
                </Button>
              </Link>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-12">
              {stats.map((stat, index) => (
                <Card key={index} className="border-none shadow-lg bg-white/50 backdrop-blur">
                  <CardContent className="pt-6 text-center">
                    <stat.icon className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                    <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                    <div className="text-sm text-gray-600">{stat.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Run Your Pharmacy
            </h2>
            <p className="text-xl text-gray-600">
              Powerful features designed specifically for modern pharmacies
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-none shadow-xl hover:shadow-2xl transition-shadow duration-300">
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center mb-4`}>
                    <feature.icon className={`h-6 w-6 ${feature.color}`} />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-6">
                Why Pharmacies Choose Habakkuk
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                Join hundreds of pharmacies already using our system to increase efficiency, 
                reduce errors, and deliver better customer service.
              </p>
              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>

            <Card className="border-none shadow-2xl bg-gradient-to-br from-blue-600 to-green-600 text-white">
              <CardHeader>
                <CardTitle className="text-3xl text-white">Ready to Transform Your Pharmacy?</CardTitle>
                <CardDescription className="text-blue-100 text-lg">
                  Get started in minutes. No credit card required.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5" />
                    </div>
                    <span className="text-white">Setup in under 5 minutes</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5" />
                    </div>
                    <span className="text-white">Import your existing inventory</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5" />
                    </div>
                    <span className="text-white">Train your staff in minutes</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5" />
                    </div>
                    <span className="text-white">24/7 support included</span>
                  </div>
                </div>

                <Link href="/login">
                  <Button size="lg" className="w-full bg-white text-blue-600 hover:bg-gray-100 h-14 text-lg font-semibold">
                    Start Your Free Trial
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 to-green-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Modernize Your Pharmacy?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join the future of pharmacy management. Access your system from anywhere, 
            on any device, at habakkukpharmacy.com
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login">
              <Button size="lg" className="w-full sm:w-auto bg-white text-blue-600 hover:bg-gray-100 h-14 px-8 text-lg">
                Staff Login
              </Button>
            </Link>
            <Link href="/customer/login">
              <Button size="lg" variant="outline" className="w-full sm:w-auto border-2 border-white text-white hover:bg-white/10 h-14 px-8 text-lg">
                Customer Portal
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <HeartPulse className="h-6 w-6 text-blue-400" />
                <span className="text-xl font-bold text-white">Habakkuk Pharmacy</span>
              </div>
              <p className="text-gray-400">
                Modern pharmacy management system trusted by pharmacies worldwide.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Quick Links</h3>
              <ul className="space-y-2">
                <li><Link href="/login" className="hover:text-white transition">Staff Login</Link></li>
                <li><Link href="/customer/login" className="hover:text-white transition">Customer Portal</Link></li>
                <li><Link href="/customer/shop" className="hover:text-white transition">Shop Products</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Contact</h3>
              <ul className="space-y-2 text-gray-400">
                <li>Kampala, Uganda</li>
                <li>+256 700 000000</li>
                <li>info@habakkukpharmacy.com</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-500">
            <p>&copy; 2025 Habakkuk Pharmacy POS. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
