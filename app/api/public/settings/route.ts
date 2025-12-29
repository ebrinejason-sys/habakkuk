import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Public endpoint - no authentication required
// Returns non-sensitive pharmacy settings for landing page
export async function GET() {
  try {
    const settings = await prisma.settings.findFirst()

    if (!settings) {
      // Return default values if no settings exist
      return NextResponse.json({
        pharmacyName: "Habakkuk Pharmacy",
        location: "Kampala, Uganda",
        contact: "+256 700 000000",
        email: "info@habakkukpharmacy.com",
        logo: null,
        footerText: "Thank you for choosing us!"
      })
    }

    // Return only public/non-sensitive information
    return NextResponse.json({
      pharmacyName: settings.pharmacyName,
      location: settings.location,
      contact: settings.contact,
      email: settings.email,
      logo: settings.logo,
      footerText: settings.footerText
    })
  } catch (error) {
    console.error("Failed to fetch public settings:", error)
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    )
  }
}
