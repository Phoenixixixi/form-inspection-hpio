import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Adding session column to inspections table...');
  await prisma.$executeRawUnsafe(
    "ALTER TABLE inspections ADD COLUMN IF NOT EXISTS session VARCHAR(20) DEFAULT 'PAGI'"
  );
  console.log('Column session added successfully or already exists!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
