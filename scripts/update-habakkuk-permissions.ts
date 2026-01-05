import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Find the habakkuk user
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: 'habakkuk', mode: 'insensitive' } },
        { name: { contains: 'habakkuk', mode: 'insensitive' } },
        { email: { contains: 'habakkuk', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      permissions: true,
    },
  })

  if (users.length === 0) {
    console.log('No user found with "habakkuk" in their name, username, or email')
    
    // List all users to help identify the right one
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        permissions: true,
      },
    })
    console.log('\nAll users in the system:')
    allUsers.forEach((u) => {
      console.log(`- ${u.name} (${u.username || u.email}) - Permissions: ${u.permissions.join(', ') || 'None'}`)
    })
    return
  }

  console.log('Found user(s):')
  users.forEach((u) => {
    console.log(`- ${u.name} (${u.username || u.email}) - Current permissions: ${u.permissions.join(', ') || 'None'}`)
  })

  // Update the first matching user with inventory permissions
  const user = users[0]
  const newPermissions = [...new Set([...user.permissions, 'MANAGE_INVENTORY', 'VIEW_INVENTORY'])]

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      permissions: newPermissions as any,
    },
  })

  console.log(`\n✅ Updated ${updated.name}'s permissions to: ${newPermissions.join(', ')}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
