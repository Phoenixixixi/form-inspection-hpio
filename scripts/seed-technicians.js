const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const newTechnicians = [
  { name: 'Alif Al Ghifari', user_id: '040 4 25 05 797', specialization: '082178340556' },
  { name: 'Rizal Mutaqien', user_id: '040 4 25 05 803', specialization: '082122681865' },
  { name: 'Naufal Zhalifunnas', user_id: '040 4 25 05 802', specialization: '081256728669' },
  { name: 'Egi Yudhistira', user_id: '040 4 25 05 804', specialization: '085722232509' },
  { name: 'Fatah Al Khadami', user_id: '040 4 25 801', specialization: '085159177488' },
  { name: 'Muhammad Dustin', user_id: '040 4 25 05 800', specialization: '0895803237723' },
  { name: 'Moch Jalu', user_id: '040 4 25 05 798', specialization: '81221233325' },
  { name: 'Alif Firdaus', user_id: '040 4 25 05 805', specialization: '089618724207' },
  { name: 'Muhammad Rizal', user_id: '040 4 25 05 799', specialization: '088233589736' },
  { name: 'Aliffio', user_id: '040 4 25 06 806', specialization: '081293029572' },
  { name: 'Rahmat Fiyantiko', user_id: '040 4 25 05 806', specialization: '082113031419' },
  { name: 'Mochamad Putra Yarman', user_id: '040 4 26 02 834', specialization: '08561689193' },
  { name: 'Muhammad Zidane Alfaridizi', user_id: '040 4 26 02 835', specialization: '085156900423' },
  { name: 'Reino Wahyu Warsono', user_id: '040 4 26 02 836', specialization: '089537566542' },
  { name: 'Imersto', user_id: '040 4 26 02 837', specialization: '081260798844' },
  { name: 'Nur Fadillah', user_id: '040 4 26 02 833', specialization: '082257197662' },
  { name: 'ahmad ali yasin', user_id: '3201240810020002', specialization: '08517118894' },
  { name: 'Qien Syahdiq', user_id: '1609012309040001', specialization: '082377595041' },
  { name: 'Muhamad Fahmi', user_id: 'tech-fahmi', specialization: '085703220995' },
];

async function main() {
  console.log('Menghapus teknisi lama...');
  const deleted = await prisma.technicians.deleteMany({});
  console.log('Teknisi lama terhapus:', deleted.count);

  console.log('Memasukkan 19 teknisi baru...');
  for (const t of newTechnicians) {
    await prisma.technicians.create({
      data: {
        name: t.name,
        user_id: t.user_id,
        specialization: t.specialization,
      },
    });
  }

  const allTechs = await prisma.technicians.findMany({
    orderBy: { name: 'asc' },
  });
  console.log('Total teknisi berhasil disimpan:', allTechs.length);
  allTechs.forEach((t, i) => {
    console.log(`${i + 1}. ${t.name} | ${t.user_id} | ${t.specialization}`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
