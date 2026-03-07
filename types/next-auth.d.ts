import NextAuth, { DefaultSession } from "next-auth"
import { JWT } from "next-auth/jwt"

// Using plain string types instead of Prisma enums so this works
// with both the PostgreSQL (cloud) and SQLite (desktop) schemas.
// At runtime, roles are "CEO" | "ADMIN" | "STAFF" and permissions
// are string values like "MANAGE_POS", "CLAIM_ORDERS" etc.

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
      permissions: string[]
      mustChangePassword: boolean
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    email: string
    name: string
    role: string
    permissions: string[]
    mustChangePassword: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: string
    permissions: string[] | any
    mustChangePassword: boolean
  }
}
