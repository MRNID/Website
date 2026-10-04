import { getDbPool } from '../packages/database/dist/index.js';
import sql from 'mssql';
import * as crypto from 'node:crypto';

async function seedOrders() {
  const pool = await getDbPool();
  const whRes = await pool.request().query('SELECT TOP 1 id FROM warehouses');
  const whId = whRes.recordset[0]?.id;
  if (!whId) {
    console.error('No warehouse found');
    process.exit(1);
  }

  const sampleOrders = [
    {
      orderCode: 'ORD-SPX-20261004-01',
      trackingCode: 'SPXVN0888999123',
      platform: 'SPX',
      customerInfo: JSON.stringify({
        customerName: 'Nguyễn Thị Lan Anh',
        phone: '0984.321.890',
        address: 'Số 18, Ngõ 92 Nguyễn Khánh Toàn, Cầu Giấy, Hà Nội',
        note: 'Giao giờ hành chính, gọi trước khi giao',
        items: [
          { sku: 'ATN-COTTON-DEN-L', name: 'Áo Thun Nam Cổ Tròn Cotton 100% Form Rộng (Đen - Size L)', quantity: 2, price: 189000 },
          { sku: 'MLT-VINTAGE-BE', name: 'Mũ Lưỡi Trai Classic Vintage (Be)', quantity: 1, price: 85000 }
        ]
      })
    },
    {
      orderCode: 'ORD-TIKTOK-20261004-02',
      trackingCode: 'TIKTOK9876543210',
      platform: 'TIKTOK',
      customerInfo: JSON.stringify({
        customerName: 'Trần Văn Hùng',
        phone: '0912.888.666',
        address: 'Tòa Landmark 81, 208 Nguyễn Hữu Cảnh, P.22, Bình Thạnh, TP.HCM',
        note: 'Hàng điện tử cao cấp xin nhẹ tay',
        items: [
          { sku: 'TWS-ANC-WHITE', name: 'Tai Nghe Bluetooth TWS Chống Ồn Chủ Động ANC (Trắng)', quantity: 1, price: 650000 },
          { sku: 'CAP-TC-LN-20W', name: 'Cáp Sạc Nhanh Type-C to Lightning Dây Dù 20W (1.2m)', quantity: 2, price: 120000 }
        ]
      })
    },
    {
      orderCode: 'ORD-GHTK-20261004-03',
      trackingCode: 'GHTK1234567890',
      platform: 'GHTK',
      customerInfo: JSON.stringify({
        customerName: 'Lê Hoàng Yến',
        phone: '0973.555.234',
        address: 'Số 45 Trần Phú, P. Hải Châu 1, Q. Hải Châu, Đà Nẵng',
        note: 'Đồ dễ vỡ, bọc xốp chống sốc dày',
        items: [
          { sku: 'PERFUME-ROSE-15ML', name: 'Nước Hoa Nữ Mini Eau De Parfum 15ml (Hương Hoa Hồng)', quantity: 1, price: 320000 },
          { sku: 'LIPSTICK-DOCAM', name: 'Son Kem Lì Mịn Môi Velvet Lip Tint (Đỏ Cam Đất)', quantity: 1, price: 195000 }
        ]
      })
    },
    {
      orderCode: 'ORD-LEX-20261004-04',
      trackingCode: 'LEXVN8829103948',
      platform: 'LAZADA',
      customerInfo: JSON.stringify({
        customerName: 'Phạm Quốc Tuấn',
        phone: '0905.777.112',
        address: 'Khu Công Nghệ Cao, P. Long Thạnh Mỹ, TP. Thủ Đức, TP.HCM',
        note: 'Cho kiểm tra hàng',
        items: [
          { sku: 'BGN-INOX316-800', name: 'Bình Giữ Nhiệt Inox 316 Cao Cấp 800ml (Xanh Rêu)', quantity: 1, price: 280000 }
        ]
      })
    },
    {
      orderCode: 'ORD-GHN-20261004-05',
      trackingCode: 'GHN9928173615',
      platform: 'GHN',
      customerInfo: JSON.stringify({
        customerName: 'Đỗ Thanh Thảo',
        phone: '0938.111.456',
        address: 'Số 102 Chùa Bộc, P. Quang Trung, Q. Đống Đa, Hà Nội',
        note: 'Đóng gói quà tặng',
        items: [
          { sku: 'TOTE-CANVAS-SUA', name: 'Túi Tote Canvas Đi Học Đi Chơi Có Khóa Kéo (Trắng Sữa)', quantity: 1, price: 119000 },
          { sku: 'KEYCHAIN-GAU', name: 'Móc Khóa Gấu Bông Dễ Thương Phong Cách Hàn Quốc', quantity: 2, price: 35000 }
        ]
      })
    }
  ];

  for (const o of sampleOrders) {
    const orderId = crypto.randomUUID();
    await pool.request()
      .input('id', sql.VarChar(36), orderId)
      .input('whId', sql.VarChar(36), whId)
      .input('orderCode', sql.VarChar(100), o.orderCode)
      .input('trackingCode', sql.VarChar(100), o.trackingCode)
      .input('platform', sql.VarChar(50), o.platform)
      .input('customerInfo', sql.NVarChar(4000), o.customerInfo)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM orders WHERE warehouse_id = @whId AND tracking_code = @trackingCode)
          INSERT INTO orders (id, warehouse_id, order_code, tracking_code, platform, customer_info)
          VALUES (@id, @whId, @orderCode, @trackingCode, @platform, @customerInfo)
        ELSE
          UPDATE orders
          SET customer_info = @customerInfo, order_code = @orderCode, platform = @platform
          WHERE warehouse_id = @whId AND tracking_code = @trackingCode
      `);
    console.log(`[SEED] Upserted order: ${o.orderCode} | Tracking: ${o.trackingCode}`);
  }

  console.log('\nSeeding completed successfully!');
  process.exit(0);
}

seedOrders().catch(err => {
  console.error(err);
  process.exit(1);
});
