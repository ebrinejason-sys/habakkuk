import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Resend } from "resend"

// Lazy instance — avoids throwing at module load time when key is absent
let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY || 'placeholder')
  return _resend
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        twoFactorEnabled: true,
        twoFactorEmail: true,
      },
    })

    if (!user || !user.twoFactorEnabled) {
      return NextResponse.json(
        { error: "2FA not enabled for this account" },
        { status: 400 }
      )
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const expiry = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    // Save code to database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorCode: code,
        twoFactorExpiry: expiry,
      },
    })

    // Send email to the 2FA email address
    const recipientEmail = user.twoFactorEmail || user.email
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@habakkukpharmacy.com'

    await getResend().emails.send({
      from: `Habakkuk Pharmacy <${fromEmail}>`,
      to: recipientEmail,
      subject: "Your 2FA Verification Code - Habakkuk Pharmacy",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .container {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 10px;
                padding: 30px;
                color: white;
              }
              .code-box {
                background: white;
                color: #667eea;
                font-size: 32px;
                font-weight: bold;
                text-align: center;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
                letter-spacing: 5px;
              }
              .info {
                background: rgba(255, 255, 255, 0.1);
                padding: 15px;
                border-radius: 5px;
                margin-top: 20px;
              }
              .footer {
                text-align: center;
                margin-top: 20px;
                font-size: 12px;
                color: rgba(255, 255, 255, 0.8);
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h2>🔐 Two-Factor Authentication</h2>
              <p>Hello ${user.name},</p>
              <p>You are attempting to sign in to your Habakkuk Pharmacy admin account.</p>
              <p>Your verification code is:</p>
              
              <div class="code-box">${code}</div>
              
              <div class="info">
                <p><strong>⏰ This code will expire in 10 minutes</strong></p>
                <p>If you did not attempt to sign in, please contact support immediately.</p>
              </div>
              
              <div class="footer">
                <p>Habakkuk Pharmacy POS System</p>
                <p>This is an automated message, please do not reply.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    })

    return NextResponse.json({
      success: true,
      message: "2FA code sent successfully",
      sentTo: recipientEmail,
    })
  } catch (error) {
    console.error("2FA send error:", error)
    return NextResponse.json(
      { error: "Failed to send 2FA code" },
      { status: 500 }
    )
  }
}
