import { PrismaClient } from '@prisma/client';
import * as crypto from 'node:crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Seeding Packing Video Proof Database ---');

  // 1. Create or Find Default Business
  const business = await prisma.business.upsert({
    where: { code: 'DEFAULT_BIZ' },
    update: {},
    create: {
      name: 'Default Fulfillment Hub',
      code: 'DEFAULT_BIZ',
      isActive: true
    }
  });

  // 2. Create Standard Roles
  const roleNames = [
    { name: 'SUPER_ADMIN', description: 'System Sovereign Administrator' },
    { name: 'ADMIN', description: 'Warehouse Administrator' },
    { name: 'WAREHOUSE_MANAGER', description: 'Warehouse Floor Supervisor' },
    { name: 'PACKING_USER', description: 'Packing Station Operator' },
    { name: 'CUSTOMER_SERVICE', description: 'Customer Dispute Specialist' },
    { name: 'VIEWER', description: 'Auditor Read-Only' }
  ];

  const rolesMap = new Map<string, string>();
  for (const r of roleNames) {
    const role = await prisma.role.upsert({
      where: {
        uq_role_business_name: {
          businessId: business.id,
          name: r.name
        }
      },
      update: {},
      create: {
        businessId: business.id,
        name: r.name,
        description: r.description,
        permissions: []
      }
    });
    rolesMap.set(r.name, role.id);
  }

  // 3. Create Default Warehouse
  const warehouse = await prisma.warehouse.upsert({
    where: { code: 'WH_CENTRAL_01' },
    update: {},
    create: {
      businessId: business.id,
      name: 'Kho Tong Mien Bac 01',
      code: 'WH_CENTRAL_01',
      address: 'KCN Tien Son, Bac Ninh',
      timezone: 'Asia/Ho_Chi_Minh',
      isActive: true
    }
  });

  // 4. Create Default Users (Password: Admin@123 / Packer@123)
  // For seed consistency, we store standard sha256 or argon2 hash
  const adminPasswordHash = crypto.createHash('sha256').update('Admin@123').digest('hex');
  const packerPasswordHash = crypto.createHash('sha256').update('Packer@123').digest('hex');

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      businessId: business.id,
      warehouseId: warehouse.id,
      username: 'admin',
      fullName: 'System Administrator',
      email: 'admin@packingproof.local',
      passwordHash: adminPasswordHash,
      roleId: rolesMap.get('SUPER_ADMIN')!,
      isActive: true
    }
  });

  await prisma.user.upsert({
    where: { username: 'packer01' },
    update: {},
    create: {
      businessId: business.id,
      warehouseId: warehouse.id,
      username: 'packer01',
      fullName: 'Nguyen Van Packer',
      email: 'packer01@packingproof.local',
      passwordHash: packerPasswordHash,
      roleId: rolesMap.get('PACKING_USER')!,
      isActive: true
    }
  });

  // 5. Create Default Packing Station
  const station = await prisma.station.upsert({
    where: { code: 'PACK01' },
    update: {},
    create: {
      warehouseId: warehouse.id,
      name: 'Tram Dong Goi So 01',
      code: 'PACK01',
      computerName: 'PACK-PC-01',
      ipAddress: '192.168.1.51',
      status: 'ONLINE'
    }
  });

  // 6. Create Worker Registration for Station
  const workerTokenHash = crypto.createHash('sha256').update('st_secret_token_pack01').digest('hex');
  await prisma.worker.upsert({
    where: { stationId: station.id },
    update: {},
    create: {
      stationId: station.id,
      tokenHash: workerTokenHash,
      version: '1.0.0',
      status: 'ONLINE',
      ipAddress: '192.168.1.51'
    }
  });

  // 7. Create Default Camera
  const existingCamera = await prisma.camera.findFirst({
    where: { stationId: station.id, name: 'CAM_PACK01' }
  });

  if (!existingCamera) {
    await prisma.camera.create({
      data: {
        stationId: station.id,
        name: 'CAM_PACK01',
        type: 'RTSP',
        rtspUrl: 'rtsp://admin:CameraPass123@192.168.1.101:554/Streaming/Channels/101',
        status: 'ONLINE'
      }
    });
  }

  // 8. Create Storage Configurations
  const storages = [
    {
      storageType: 'LOCAL_TEMP',
      path: 'D:\\PackingVideoTemp',
      retentionDays: 1,
      localRetentionDays: 1,
      enabled: true,
      isDefault: true
    },
    {
      storageType: 'LOCAL_ARCHIVE',
      path: 'D:\\PackingVideo',
      retentionDays: 90,
      localRetentionDays: 14,
      enabled: true,
      isDefault: true
    },
    {
      storageType: 'NAS_SHARE',
      path: '\\\\SERVER\\PackingVideo',
      retentionDays: 90,
      localRetentionDays: 14,
      enabled: true,
      isDefault: true
    }
  ];

  for (const s of storages) {
    const existing = await prisma.storageConfig.findFirst({
      where: { warehouseId: warehouse.id, storageType: s.storageType }
    });
    if (!existing) {
      await prisma.storageConfig.create({
        data: {
          warehouseId: warehouse.id,
          ...s
        }
      });
    }
  }

  console.log('--- Seed Completed Successfully ---');
}

main()
  .catch((e) => {
    console.error('Seed Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
