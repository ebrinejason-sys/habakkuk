import NextAuth, { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: { label: "Email or Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) {
          throw new Error("Invalid credentials")
        }

        const identifier = credentials.identifier.trim().toLowerCase()
        
        // Check if identifier is email or username
        const isEmail = identifier.includes("@")
        
        let user
        if (isEmail) {
          user = await prisma.user.findUnique({
            where: { email: identifier }
          })
        } else {
          user = await prisma.user.findUnique({
            where: { username: identifier }
          })
        }

        if (!user || !user.isActive) {
          throw new Error("Invalid credentials")
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
              role: user.role,
              permissions: user.permissions,
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
          role: user.role,
          permissions: user.permissions,
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
        session.user.id = token.id
        session.user.role = token.role
        session.user.permissions = token.permissions
        session.user.mustChangePassword = token.mustChangePassword
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
