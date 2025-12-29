import NextAuth, { DefaultSession } from "next-auth"
import { JWT } from "next-auth/jwt"
import { Role, Permission } from "@prisma/client"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: Role
      permissions: Permission[]
      mustChangePassword: boolean
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    email: string
    name: string
    role: Role
    permissions: Permission[]
    mustChangePassword: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: Role
    permissions: Permission[]
    mustChangePassword: boolean
  }
}
