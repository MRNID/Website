import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabaseRepository } from '@packing-proof/database';
import { StationGateway } from '../websocket/station-gateway.js';

interface AuthenticatedApiRequest extends FastifyRequest {
  business?: {
    id: string;
    code: string;
    name: string;
    apiKey: string;
    isActive: boolean;
    subscriptionStatus: string;
    defaultWarehouseId: string;
    defaultWarehouseName: string;
  };
}

/**
 * Open Ingestion API Authentication Guard
 * Supports:
 * - Header: 'x-api-key: pk_live_...'
 * - Header: 'Authorization: Bearer pk_live_...'
 * - Query param: '?apiKey=pk_live_...'
 */
async function authenticateApiKey(request: FastifyRequest, reply: FastifyReply) {
  const req = request as AuthenticatedApiRequest;
  const headerKey = request.headers['x-api-key'] as string;
  const authHeader = request.headers['authorization'];
  const queryKey = (request.query as any)?.apiKey as string;

  let apiKey = headerKey || queryKey;
  if (!apiKey && authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    apiKey = authHeader.slice(7).trim();
  }

  if (!apiKey) {
    return reply.status(401).send({
      success: false,
      error: {
        code: 'MISSING_API_KEY',
        message: 'Yêu cầu API Key để truy cập. Vui lòng gửi qua header x-api-key: pk_live_... hoặc Authorization: Bearer pk_live_...'
      }
    });
  }

  const business = await DatabaseRepository.findBusinessByApiKey(apiKey);
  if (!business || !business.isActive) {
    return reply.status(401).send({
      success: false,
      error: {
        code: 'INVALID_API_KEY',
        message: 'API Key không hợp lệ hoặc tài khoản doanh nghiệp đã bị vô hiệu hóa'
      }
    });
  }

  if (business.subscriptionStatus === 'SUSPENDED') {
    return reply.status(403).send({
      success: false,
      error: {
        code: 'SUBSCRIPTION_SUSPENDED',
        message: 'Tài khoản công ty/shop đã bị tạm dừng dịch vụ. Vui lòng liên hệ ban quản trị.'
      }
    });
  }

  req.business = business;
}

export async function openApiRoutes(app: FastifyInstance) {
  // Hook auth to all /api/v1/open-api routes
  app.addHook('preHandler', async (request, reply) => {
    if (request.url.startsWith('/api/v1/open-api')) {
      await authenticateApiKey(request, reply);
    }
  });

  /**
   * 1. GET /api/v1/open-api/me
   * Get authenticated tenant profile and quota
   */
  app.get('/api/v1/open-api/me', async (request, reply) => {
    const req = request as AuthenticatedApiRequest;
    const business = req.business!;
    const quota = await DatabaseRepository.checkTenantQuota(business.id);

    return reply.status(200).send({
      success: true,
      data: {
        business: {
          id: business.id,
          code: business.code,
          name: business.name
        },
        defaultWarehouse: {
          id: business.defaultWarehouseId,
          name: business.defaultWarehouseName
        },
        subscription: {
          planTier: quota.planTier,
          status: quota.subscriptionStatus,
          monthlyOrderLimit: quota.monthlyOrderLimit,
          ordersThisMonth: quota.ordersThisMonth,
          usagePercent: quota.usagePercent,
          isAllowed: quota.isAllowed
        }
      }
    });
  });

  /**
   * 2. POST /api/v1/open-api/orders/ingest
   * Ingest orders batch from client's ERP, OMS, Sapo, Shopee, TikTok, or Custom Backend
   */
  app.post('/api/v1/open-api/orders/ingest', async (request, reply) => {
    const req = request as AuthenticatedApiRequest;
    const business = req.business!;

    // 1. Quota Check
    const quota = await DatabaseRepository.checkTenantQuota(business.id);
    if (!quota.isAllowed) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'QUOTA_EXCEEDED',
          message: quota.reason || 'Hạn mức đơn hàng trong tháng của tài khoản đã đạt tối đa.'
        }
      });
    }

    const body = request.body as any;
    if (!body) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_PAYLOAD',
          message: 'Payload rỗng hoặc định dạng JSON không hợp lệ'
        }
      });
    }

    // 2. Normalize orders list
    const rawOrders = Array.isArray(body)
      ? body
      : (body.orders ? (Array.isArray(body.orders) ? body.orders : [body.orders]) : [body]);

    if (rawOrders.length === 0) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'EMPTY_ORDERS_LIST',
          message: 'Danh sách đơn hàng cần nạp không được để trống'
        }
      });
    }

    // 3. Resolve warehouse (fallback to default warehouse)
    const targetWarehouseId = business.defaultWarehouseId;
    if (!targetWarehouseId) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'WAREHOUSE_NOT_CONFIGURED',
          message: 'Chưa cấu hình kho hàng mặc định cho doanh nghiệp này'
        }
      });
    }

    // 4. Transform and sanitize each order
    const normalizedOrders = [];
    for (const raw of rawOrders) {
      const orderCode = raw.orderCode || raw.order_number || raw.code || raw.name || '';
      let trackingCode = raw.trackingCode || raw.tracking_code || raw.waybill_code || '';

      // Sapo fulfillments tracking
      if (!trackingCode && raw.fulfillments && Array.isArray(raw.fulfillments) && raw.fulfillments.length > 0) {
        trackingCode = raw.fulfillments[0].tracking_number || raw.fulfillments[0].tracking_code || '';
      }

      if (!trackingCode && !orderCode) continue;

      const customerName = raw.customerName || raw.customer?.name || raw.customer?.full_name || raw.shipping_address?.name || raw.recipient_name || '';
      const phone = raw.phone || raw.customer?.phone || raw.shipping_address?.phone || raw.recipient_phone || '';
      const address = raw.address || (raw.shipping_address ? `${raw.shipping_address.address1 || ''}, ${raw.shipping_address.ward || ''}, ${raw.shipping_address.district || ''}, ${raw.shipping_address.city || ''}` : '');
      const note = raw.note || raw.client_note || raw.order_note || '';
      const totalAmount = Number(raw.totalAmount || raw.total_price || raw.total_amount || 0);
      const codAmount = Number(raw.codAmount || raw.cod_amount || raw.cod || 0);

      // Extract products / line items
      const rawItems = raw.items || raw.line_items || raw.products || [];
      const items = rawItems.map((it: any) => ({
        sku: String(it.sku || it.barcode || it.product_code || it.variant_sku || 'SP-GENERIC').trim(),
        name: String(it.name || it.product_name || it.title || 'Sản phẩm').trim(),
        quantity: Math.max(1, Number(it.quantity) || 1),
        price: Number(it.price || it.unit_price || it.original_price || 0)
      }));

      normalizedOrders.push({
        orderCode: String(orderCode || trackingCode).trim(),
        trackingCode: String(trackingCode || orderCode).trim().toUpperCase(),
        platform: String(raw.platform || raw.source_name || 'API').toUpperCase(),
        customerName: String(customerName).trim(),
        phone: String(phone).trim(),
        address: String(address).trim(),
        note: String(note).trim(),
        totalAmount,
        codAmount,
        items
      });
    }

    if (normalizedOrders.length === 0) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'NO_VALID_ORDERS',
          message: 'Không tìm thấy đơn hàng hợp lệ nào trong danh sách (thiếu orderCode hoặc trackingCode)'
        }
      });
    }

    // 5. Batch Upsert to isolated warehouse
    const result = await DatabaseRepository.upsertOrdersBatch(targetWarehouseId, normalizedOrders);

    // Realtime notify packing workbenches
    try {
      StationGateway.broadcast(
        'ORDERS_UPDATED',
        {
          source: 'OPEN_API',
          inserted: result.inserted,
          updated: result.updated,
          total: result.total
        },
        { businessId: business.id, warehouseId: targetWarehouseId }
      ).catch(() => {});
    } catch {}

    return reply.status(200).send({
      success: true,
      data: {
        business: {
          id: business.id,
          code: business.code,
          name: business.name
        },
        warehouse: {
          id: business.defaultWarehouseId,
          name: business.defaultWarehouseName
        },
        summary: {
          totalReceived: normalizedOrders.length,
          inserted: result.inserted,
          updated: result.updated,
          totalInWarehouse: result.total
        },
        message: `Tiếp nhận thành công ${normalizedOrders.length} đơn hàng (${result.inserted} tạo mới, ${result.updated} cập nhật)`
      }
    });
  });

  /**
   * 3. GET /api/v1/open-api/orders/:trackingCode
   * Query packing proof & video URL for a specific order (Strictly tenant-isolated)
   */
  app.get('/api/v1/open-api/orders/:trackingCode', async (request, reply) => {
    const req = request as AuthenticatedApiRequest;
    const business = req.business!;
    const { trackingCode } = request.params as { trackingCode: string };

    if (!trackingCode) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_TRACKING_CODE', message: 'Mã vận đơn hoặc mã đơn hàng là bắt buộc' }
      });
    }

    const proof = await DatabaseRepository.getOrderProofByTrackingCode(business.id, trackingCode);
    if (!proof) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'ORDER_NOT_FOUND',
          message: `Không tìm thấy đơn hàng với mã '${trackingCode}' trong tài khoản của công ty ${business.name}`
        }
      });
    }

    return reply.status(200).send({
      success: true,
      data: proof
    });
  });
}
