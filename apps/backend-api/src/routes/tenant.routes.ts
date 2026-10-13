import { FastifyInstance } from 'fastify';
import { DatabaseRepository } from '@packing-proof/database';
import { authenticateUser } from '../auth/auth.middleware.js';

export async function tenantRoutes(app: FastifyInstance) {
  // 1. List Tenants with usage & plan stats (Strictly Super Admin only)
  app.get('/api/v1/admin/tenants', { preHandler: [authenticateUser] }, async (request, reply) => {
    const user = request.user!;
    const search = (request.query as any)?.search;

    if (user.role !== 'SUPER_ADMIN') {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Chỉ Quản trị viên cấp cao (Super Admin) mới có quyền truy cập danh sách khách hàng thuê' }
      });
    }

    const tenants = await DatabaseRepository.getTenants(search ? String(search).trim() : undefined);
    return reply.status(200).send({
      success: true,
      data: tenants
    });
  });

  // 2. High-level Tenant & MRR Stats (Super Admin)
  app.get('/api/v1/admin/tenants/stats', { preHandler: [authenticateUser] }, async (request, reply) => {
    const user = request.user!;
    if (user.role !== 'SUPER_ADMIN') {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only Super Admin can access SaaS revenue telemetry' }
      });
    }

    const stats = await DatabaseRepository.getTenantDashboardStats();
    return reply.status(200).send({
      success: true,
      data: stats
    });
  });

  // 3. Current Business Plan & Quota Status (For Navbar/Dashboard widgets)
  app.get('/api/v1/admin/tenants/my-quota', { preHandler: [authenticateUser] }, async (request, reply) => {
    const user = request.user!;
    if (!user.businessId) {
      return reply.status(200).send({
        success: true,
        data: {
          isAllowed: true,
          planTier: 'ENTERPRISE',
          monthlyOrderLimit: 999999,
          ordersThisMonth: 0,
          usagePercent: 0,
          subscriptionStatus: 'ACTIVE'
        }
      });
    }

    const quota = await DatabaseRepository.checkTenantQuota(user.businessId);
    return reply.status(200).send({
      success: true,
      data: quota
    });
  });

  // 4. Get Tenant Details
  app.get('/api/v1/admin/tenants/:id', { preHandler: [authenticateUser] }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as any;

    if (user.role !== 'SUPER_ADMIN' && user.businessId !== id) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Unauthorized to view this tenant' }
      });
    }

    const tenant = await DatabaseRepository.getTenantById(id);
    if (!tenant) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Tenant not found' }
      });
    }

    return reply.status(200).send({
      success: true,
      data: tenant
    });
  });

  // 5. Create New Tenant / Customer Onboarding (Super Admin)
  app.post('/api/v1/admin/tenants', { preHandler: [authenticateUser] }, async (request, reply) => {
    const user = request.user!;
    if (user.role !== 'SUPER_ADMIN') {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only Super Admin can onboard new tenants' }
      });
    }

    const body = request.body as any;
    if (!body.name || !body.code) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Tên công ty và Mã định danh (Code) là bắt buộc' }
      });
    }

    try {
      const result = await DatabaseRepository.createTenant({
        name: body.name,
        code: body.code,
        contactName: body.contactName,
        phone: body.phone,
        email: body.email,
        planTier: body.planTier || 'STARTER',
        monthlyOrderLimit: body.monthlyOrderLimit,
        maxStations: body.maxStations,
        retentionDays: body.retentionDays,
        subscriptionMonths: body.subscriptionMonths || 1,
        pricePerMonth: body.pricePerMonth,
        notes: body.notes,
        adminUsername: body.adminUsername,
        adminPassword: body.adminPassword,
        adminFullName: body.adminFullName
      });

      return reply.status(201).send({
        success: true,
        data: result
      });
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: { code: 'CREATE_TENANT_FAILED', message: err.message || 'Lỗi tạo khách hàng' }
      });
    }
  });

  // 6. Update Tenant Settings & Plan (Strictly Super Admin only)
  app.put('/api/v1/admin/tenants/:id', { preHandler: [authenticateUser] }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as any;

    if (user.role !== 'SUPER_ADMIN') {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Chỉ Super Admin mới có quyền cập nhật thông tin và gói cước doanh nghiệp' }
      });
    }

    const body = request.body as any;
    // Non-super-admins cannot upgrade their own plan tier or limits without paying
    const updateData: any = {
      name: body.name,
      contactName: body.contactName,
      phone: body.phone,
      email: body.email,
      notes: body.notes
    };

    if (user.role === 'SUPER_ADMIN') {
      updateData.planTier = body.planTier;
      updateData.monthlyOrderLimit = body.monthlyOrderLimit;
      updateData.maxStations = body.maxStations;
      updateData.retentionDays = body.retentionDays;
      updateData.subscriptionStatus = body.subscriptionStatus;
      updateData.subscriptionExpiresAt = body.subscriptionExpiresAt;
      updateData.pricePerMonth = body.pricePerMonth;
      updateData.isActive = body.isActive;
    }

    await DatabaseRepository.updateTenant(id, updateData);
    const updatedTenant = await DatabaseRepository.getTenantById(id);
    return reply.status(200).send({
      success: true,
      data: updatedTenant
    });
  });

  // 7. Renew Tenant Subscription
  app.post('/api/v1/admin/tenants/:id/renew', { preHandler: [authenticateUser] }, async (request, reply) => {
    const user = request.user!;
    if (user.role !== 'SUPER_ADMIN') {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only Super Admin can renew subscriptions' }
      });
    }

    const { id } = request.params as any;
    const addMonths = Number((request.body as any)?.months) || 1;

    const result = await DatabaseRepository.renewTenantSubscription(id, addMonths);
    return reply.status(200).send({
      success: true,
      data: result
    });
  });

  // 8. Rotate Tenant Ingestion API Key
  app.post('/api/v1/admin/tenants/:id/rotate-api-key', { preHandler: [authenticateUser] }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as any;

    if (user.role !== 'SUPER_ADMIN' && user.businessId !== id) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Bạn không có quyền đổi API Key của công ty này' }
      });
    }

    const newApiKey = await DatabaseRepository.rotateApiKey(id);
    return reply.status(200).send({
      success: true,
      data: {
        apiKey: newApiKey,
        message: 'Đã tạo mới mã Ingestion API Key thành công'
      }
    });
  });
}
