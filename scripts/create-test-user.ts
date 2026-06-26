import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const hash = await bcrypt.hash('123456', 12);

  const user = await prisma.user.upsert({
    where: { email: 'teste@hubby.com' },
    update: { password_hash: hash },
    create: {
      email: 'teste@hubby.com',
      password_hash: hash,
      role: 'client',
      provider: 'credentials',
    },
  });

  console.log('Usuário criado/atualizado:');
  console.log('  Email:   teste@hubby.com');
  console.log('  Senha:   123456');
  console.log('  Role:    client');
  console.log('  ID:     ', user.id);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
