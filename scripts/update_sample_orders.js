const { getDbPool } = require('../packages/database/dist');

async function main() {
  const pool = await getDbPool();

  const info1 = JSON.stringify({
    customerName: 'Anh Tuấn',
    phone: '0912.888.464',
    address: 'Số 88 Cầu Giấy, P. Quan Hoa, Cầu Giấy, Hà Nội',
    note: 'Hàng dễ vỡ, gọi trước khi giao',
    totalAmount: 1240000,
    codAmount: 1240000,
    items: [
      {
        sku: 'V0225YBF01-DEN',
        name: 'Váy Nữ Thiết Kế Dáng Xòe Công Sở Cao Cấp (Màu Đen - Size M)',
        quantity: 1,
        price: 1240000
      }
    ]
  });

  const info2 = JSON.stringify({
    customerName: 'Nguyễn Văn Giang',
    phone: '0984.321.268',
    address: 'Chung cư Eco Green, 286 Nguyễn Xiển, Thanh Xuân, Hà Nội',
    note: 'Giao giờ hành chính',
    totalAmount: 465000,
    codAmount: 465000,
    items: [
      {
        sku: 'B01TX1004T-BE',
        name: 'Balo Du Lịch Thời Trang Unisex Chống Nước (Be Phối Nâu)',
        quantity: 1,
        price: 465000
      }
    ]
  });

  await pool.request()
    .input('info', info1)
    .query("UPDATE orders SET customer_info = @info WHERE tracking_code = 'SPXVN06790262572A'");

  await pool.request()
    .input('info', info2)
    .query("UPDATE orders SET customer_info = @info WHERE tracking_code = 'SPXVN06417961124A'");

  console.log('SUCCESS: Updated 2 orders with full names, SKUs, prices and COD!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
