import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Akses ditolak: Harap login sebagai administrator' },
        { status: 401 }
      );
    }

    const { station_id } = await request.json();

    if (!station_id) {
      return NextResponse.json(
        { success: false, error: 'station_id wajib diberikan' },
        { status: 400 }
      );
    }

    const station = await prisma.stations.findUnique({
      where: { id: station_id },
      include: { rooms: true },
    });

    if (!station) {
      return NextResponse.json(
        { success: false, error: 'Stasiun tidak ditemukan' },
        { status: 404 }
      );
    }

    // Default template rooms & items
    const templates = [
      {
        name: 'Datacenter Server Room',
        location: 'Lantai 2 - Area IT',
        items: [
          'Rack Server 01 (Host & VM)',
          'Rack Server 02 (Storage)',
          'Core Switch & Backbone Router',
          'Precision AC 01 (In-Row)',
          'Precision AC 02 (Backup)',
          'FM200 Fire Suppression System',
          'PDU & Energy Meter',
          'CCTV Datacenter & Access Door',
        ],
      },
      {
        name: 'UPS & Battery Room',
        location: 'Lantai 1 - Power Center',
        items: [
          'Main UPS Unit 60kVA',
          'Battery String Bank A (32 Blocks)',
          'Battery String Bank B (32 Blocks)',
          'Static Transfer Switch (STS)',
          'Exhaust & Ventilation Blower',
          'Temperature Safety Sensor',
        ],
      },
      {
        name: 'Telecom & Transmission Room',
        location: 'Lantai 2 - Ruang Transmisi',
        items: [
          'ODF Fiber Optic Distribution',
          'SDH / DWDM Transmission Unit',
          'Radio Train Dispatcher Unit',
          'DC Power Rectifier 48V',
        ],
      },
      {
        name: 'Station Area',
        location: 'Concourse & Hall Stasiun',
        items: [
          'Ticket Vending Machine (TVM) IT',
          'Automatic Fare Gate Reader',
          'Passenger Information Display System (PIDS)',
          'Public Address (PA) IT Controller',
          'Station LAN Switch Hub',
        ],
      },
    ];

    const createdRooms = [];

    for (const tpl of templates) {
      // Check if room with this name already exists in this station
      const existing = station.rooms.find(
        (r) => r.name.toLowerCase() === tpl.name.toLowerCase()
      );

      if (!existing) {
        const newRoom = await prisma.rooms.create({
          data: {
            station_id,
            name: tpl.name,
            location: tpl.location,
            is_active: true,
            items: {
              create: tpl.items.map((itemName) => ({
                name: itemName,
                is_active: true,
              })),
            },
          },
          include: { items: true },
        });
        createdRooms.push(newRoom);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil menambahkan ${createdRooms.length} ruangan template`,
      createdRooms,
    });
  } catch (error: any) {
    console.error('Error seeding station rooms:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal generate template' },
      { status: 500 }
    );
  }
}
