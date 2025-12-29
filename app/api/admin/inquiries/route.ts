import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "../../auth/[...nextauth]/route"
import { sendEmail } from "@/lib/email"

// GET - List all inquiries (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== "ADMIN" && session.user.role !== "CEO") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const inquiries = await prisma.inquiry.findMany({
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(inquiries)
  } catch (error) {
    console.error("Error fetching inquiries:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Create new inquiry (public endpoint for password reset, or authenticated for feature requests)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userEmail, userName, type, subject, message, userId } = body

    if (!userEmail || !userName || !type || !subject || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Create the inquiry
    const inquiry = await prisma.inquiry.create({
      data: {
        userId: userId || null,
        userEmail,
        userName,
        type,
        subject,
        message,
      },
    })

    // Send email notification to admin
    const adminEmail = process.env.ADMIN_EMAIL || "ebrinetushabe@gmail.com"
    
    const typeLabels: Record<string, string> = {
      FEATURE_REQUEST: "Feature Request",
      PASSWORD_RESET: "Password Reset Request",
      ACCESS_REQUEST: "Access Request",
      DELETE_REQUEST: "Delete Request",
      OTHER: "General Inquiry",
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9f9f9; padding: 30px; border-radius: 5px; margin-top: 20px; }
          .info-box { background-color: white; padding: 15px; border-left: 4px solid #4F46E5; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
          .badge-yellow { background-color: #FEF3C7; color: #92400E; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New User Inquiry</h1>
          </div>
          <div class="content">
            <p><span class="badge badge-yellow">${typeLabels[type] || type}</span></p>
            
            <div class="info-box">
              <p><strong>From:</strong> ${userName}</p>
              <p><strong>Email:</strong> ${userEmail}</p>
              <p><strong>Subject:</strong> ${subject}</p>
              <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
            </div>
            
            <h3>Message:</h3>
            <div style="background-color: white; padding: 15px; border-radius: 5px;">
              <p>${message}</p>
            </div>
            
            <p style="margin-top: 30px;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/admin/inquiries" 
                 style="display: inline-block; padding: 12px 30px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px;">
                View in Dashboard
              </a>
            </p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Habakkuk Pharmacy. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `

    await sendEmail({
      to: adminEmail,
      subject: `[Habakkuk] ${typeLabels[type]}: ${subject}`,
      html: emailHtml,
    })

    return NextResponse.json({ success: true, inquiry })
  } catch (error) {
    console.error("Error creating inquiry:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH - Update inquiry status (admin only)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== "ADMIN" && session.user.role !== "CEO") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { id, status, adminResponse } = body

    if (!id) {
      return NextResponse.json({ error: "Inquiry ID required" }, { status: 400 })
    }

    const inquiry = await prisma.inquiry.update({
      where: { id },
      data: {
        status,
        adminResponse,
        respondedAt: new Date(),
      },
    })

    // If resolved, send email to user
    if (status === "RESOLVED" && adminResponse) {
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9f9f9; padding: 30px; border-radius: 5px; margin-top: 20px; }
            .response-box { background-color: white; padding: 15px; border-left: 4px solid #10B981; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Your Inquiry Has Been Resolved</h1>
            </div>
            <div class="content">
              <h2>Hello ${inquiry.userName},</h2>
              <p>Your inquiry regarding "<strong>${inquiry.subject}</strong>" has been reviewed and resolved.</p>
              
              <div class="response-box">
                <h3 style="margin-top: 0; color: #10B981;">Admin Response:</h3>
                <p>${adminResponse}</p>
              </div>
              
              <p>If you have any further questions, please don't hesitate to reach out.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Habakkuk Pharmacy. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `

      await sendEmail({
        to: inquiry.userEmail,
        subject: `Re: ${inquiry.subject} - Resolved`,
        html: emailHtml,
      })
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE_INQUIRY",
        entity: "INQUIRY",
        entityId: id,
        details: `Updated inquiry status to ${status}`,
      },
    })

    return NextResponse.json(inquiry)
  } catch (error) {
    console.error("Error updating inquiry:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
