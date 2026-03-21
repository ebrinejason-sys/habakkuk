import NextAuth, { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

/**
 * Normalises the permissions field so it works with both backends:
 * - PostgreSQL: array of Permission enum values  →  returned as-is
 * - SQLite:     comma-separated string            →  split into array
 */
function parsePermissions(raw: any): string[] {
  if (Array.isArray(raw)) return raw as string[]
  if (typeof raw === "string") return raw ? raw.split(",").filter(Boolean) : []
  return []
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: { label: "Email or Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async authorize(credentials): Promise<any> {
        if (!credentials?.identifier || !credentials?.password) {
          throw new Error("Invalid credentials")
        }

        const identifier = credentials.identifier.trim().toLowerCase()

        // Check if identifier is email or username
        const isEmail = identifier.includes("@")

        let user;
        if (isEmail) {
          user = await prisma.user.findUnique({
            where: { email: identifier }
          });
        } else {
          user = await prisma.user.findUnique({
            where: { username: identifier }
          });
        }

        // ── Cloud Fallback ──────────────────────────────────────────────────
        // If user not found locally AND we are in desktop mode, try cloud verification
        if (!user && process.env.NEXT_PUBLIC_IS_DESKTOP === 'true') {
          console.log(`[Auth] User ${identifier} not found locally. Trying cloud fallback...`);
          try {
            const CLOUD_URL = process.env.SYNC_SERVER_URL || 'https://habakkukpharmacy.com';
            const cloudResponse = await fetch(`${CLOUD_URL}/api/auth/cloud-verify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Sync-Key': process.env.SYNC_API_KEY || ''
              },
              body: JSON.stringify({ identifier, password: credentials.password }),
            });

            if (cloudResponse.ok) {
              const cloudData = await cloudResponse.json();
              console.log(`[Auth] Cloud verification successful for ${identifier}. Creating local record.`);

              // Create the user locally so they can log in offline next time
              user = await prisma.user.create({
                data: {
                  ...cloudData.user,
                  password: await bcrypt.hash(credentials.password, 10), // Store hashed password locally
                }
              });
            }
          } catch (cloudErr) {
            console.error('[Auth] Cloud fallback failed:', cloudErr);
          }
        }

        if (!user || !user.isActive) {
          throw new Error("Invalid credentials");
        }

        // Check if this is a 2FA-verified session (special token passed)
        if (credentials.password.startsWith("2FA_VERIFIED:")) {
          const token = credentials.password.replace("2FA_VERIFIED:", "")
          // Verify the token matches user ID (simple verification)
          if (token === user.id) {
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role as string,
              permissions: parsePermissions(user.permissions),
              mustChangePassword: user.mustChangePassword,
            }
          }
          throw new Error("Invalid 2FA session")
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          throw new Error("Invalid credentials")
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as string,
          permissions: parsePermissions(user.permissions),
          mustChangePassword: user.mustChangePassword,
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.permissions = user.permissions
        token.mustChangePassword = user.mustChangePassword
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string

        // Fetch fresh user data from database to get updated permissions
        const freshUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            role: true,
            permissions: true,
            mustChangePassword: true,
          }
        })

        if (freshUser) {
          session.user.role = freshUser.role as string
          session.user.permissions = parsePermissions(freshUser.permissions)
          session.user.mustChangePassword = freshUser.mustChangePassword
        } else {
          // Fallback to token values if user not found
          session.user.role = token.role
          session.user.permissions = parsePermissions(token.permissions)
          session.user.mustChangePassword = token.mustChangePassword
        }
      }
      return session
    }
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
