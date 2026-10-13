import { FastifyInstance } from 'fastify';
import { DatabaseRepository } from '@packing-proof/database';
import { RoleName } from '@packing-proof/shared-types';
import { authenticateUser } from '../auth/auth.middleware.js';
import {
  requireRoles,
  canAssignRole,
  canEditTargetUser
} from '../auth/authorization.guard.js';
import { StationGateway } from '../websocket/station-gateway.js';

export async function userRoutes(app: FastifyInstance) {
  // 1. Get staff users list (Only SUPER_ADMIN, ADMIN, WAREHOUSE_MANAGER)
  app.get('/api/v1/admin/users', {
    preHandler: [authenticateUser, requireRoles('SUPER_ADMIN', 'ADMIN', 'WAREHOUSE_MANAGER')]
  }, async (request, reply) => {
    const user = request.user!;
    const query = request.query as any;

    let targetBusinessId = query.businessId;
    if (user.role !== 'SUPER_ADMIN') {
      targetBusinessId = user.businessId;
    }

    let targetWarehouseId = query.warehouseId;
    if (user.role === 'WAREHOUSE_MANAGER') {
      // Warehouse manager can only view users in their own warehouse
      targetWarehouseId = user.warehouseId || undefined;
    }

    const users = await DatabaseRepository.getStaffUsers({
      businessId: targetBusinessId,
      warehouseId: targetWarehouseId,
      search: query.search ? String(query.search).trim() : undefined,
      roleName: query.roleName
    });

    return reply.status(200).send({
      success: true,
      data: users
    });
  });

  // 2. Get available roles (Only SUPER_ADMIN, ADMIN, WAREHOUSE_MANAGER)
  app.get('/api/v1/admin/roles', {
    preHandler: [authenticateUser, requireRoles('SUPER_ADMIN', 'ADMIN', 'WAREHOUSE_MANAGER')]
  }, async (request, reply) => {
    const user = request.user!;
    const query = request.query as any;

    let targetBusinessId = query.businessId;
    if (user.role !== 'SUPER_ADMIN') {
      targetBusinessId = user.businessId;
    }

    let roles = await DatabaseRepository.getRoles(targetBusinessId);

    // Filter roles caller is permitted to assign
    if (user.role === 'ADMIN') {
      roles = roles.filter(r => r.name !== 'SUPER_ADMIN');
    } else if (user.role === 'WAREHOUSE_MANAGER') {
      roles = roles.filter(r => r.name === 'PACKING_USER' || r.name === 'VIEWER');
    }

    return reply.status(200).send({
      success: true,
      data: roles
    });
  });

  // 3. Create staff user (Packer, Manager, CSKH)
  app.post('/api/v1/admin/users', {
    preHandler: [authenticateUser, requireRoles('SUPER_ADMIN', 'ADMIN', 'WAREHOUSE_MANAGER')]
  }, async (request, reply) => {
    const user = request.user!;
    const body = request.body as any;

    if (!body.username || !body.password || !body.fullName) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Tên đăng nhập, mật khẩu và họ tên là bắt buộc' }
      });
    }

    // 1. Resolve & Enforce Business Scope
    let businessId = body.businessId;
    if (user.role !== 'SUPER_ADMIN' || !businessId) {
      businessId = user.businessId;
    }

    // 2. Resolve & Enforce Warehouse Scope
    let warehouseId = body.warehouseId;
    if (user.role === 'WAREHOUSE_MANAGER') {
      if (!user.warehouseId) {
        return reply.status(403).send({
          success: false,
          error: { code: 'WAREHOUSE_NOT_ASSIGNED', message: 'Quản lý kho chưa được gán kho làm việc' }
        });
      }
      if (warehouseId && warehouseId !== user.warehouseId) {
        return reply.status(403).send({
          success: false,
          error: { code: 'WAREHOUSE_ACCESS_DENIED', message: 'Quản lý kho không được phép tạo nhân viên cho kho khác' }
        });
      }
      warehouseId = user.warehouseId;
    } else if (warehouseId) {
      // Validate warehouse belongs to business
      const wh = await DatabaseRepository.findWarehouseById(warehouseId);
      if (!wh || (user.role !== 'SUPER_ADMIN' && wh.businessId !== businessId)) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_WAREHOUSE', message: 'Kho hàng không tồn tại hoặc không thuộc doanh nghiệp này' }
        });
      }
    } else {
      warehouseId = user.warehouseId;
    }

    // 3. Role Validation & Escalation Prevention
    let targetRoleName: RoleName = (body.roleName || 'PACKING_USER') as RoleName;
    let targetRoleId = body.roleId;

    if (targetRoleId) {
      const roleRecord = await DatabaseRepository.findRoleById(targetRoleId);
      if (!roleRecord) {
        return reply.status(400).send({
          success: false,
          error: { code: 'ROLE_NOT_FOUND', message: 'Vai trò chỉ định không tồn tại' }
        });
      }
      if (user.role !== 'SUPER_ADMIN' && roleRecord.businessId !== businessId) {
        return reply.status(403).send({
          success: false,
          error: { code: 'ROLE_OUTSIDE_BUSINESS', message: 'Vai trò không thuộc doanh nghiệp của bạn' }
        });
      }
      targetRoleName = roleRecord.name as RoleName;
    }

    if (!canAssignRole(user.role, targetRoleName)) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'PRIVILEGE_ESCALATION_DENIED',
          message: `Vai trò ${user.role} không được phép cấp quyền ${targetRoleName}`
        }
      });
    }

    try {
      const newUser = await DatabaseRepository.createStaffUser({
        businessId,
        warehouseId,
        username: body.username,
        password: body.password,
        fullName: body.fullName,
        email: body.email,
        phone: body.phone,
        roleId: targetRoleId,
        roleName: targetRoleName
      });

      // Audit Log: Sensitive operation USER_CREATED
      await DatabaseRepository.recordAuditLog({
        businessId,
        warehouseId,
        userId: user.sub,
        action: 'USER_CREATED',
        resourceType: 'USER',
        resourceId: newUser.id,
        details: {
          username: body.username,
          roleName: targetRoleName,
          warehouseId
        }
      });

      return reply.status(201).send({
        success: true,
        data: newUser
      });
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: { code: 'USER_CREATION_FAILED', message: err.message || 'Không thể tạo tài khoản nhân viên' }
      });
    }
  });

  // 4. Update staff user profile / password / warehouse / role
  app.put('/api/v1/admin/users/:id', {
    preHandler: [authenticateUser, requireRoles('SUPER_ADMIN', 'ADMIN', 'WAREHOUSE_MANAGER')]
  }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as any;
    const body = request.body as any;

    const existingUser = await DatabaseRepository.getStaffUserById(id);
    if (!existingUser) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Không tìm thấy người dùng' }
      });
    }

    // 1. Permission check to edit target user
    const editCheck = canEditTargetUser(user, existingUser);
    if (!editCheck.allowed) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: editCheck.reason || 'Bạn không có quyền chỉnh sửa tài khoản này' }
      });
    }

    // 2. Prevent Self-Privilege Escalation
    if (id === user.sub) {
      if (body.roleId || body.roleName) {
        return reply.status(403).send({
          success: false,
          error: { code: 'SELF_ROLE_CHANGE_FORBIDDEN', message: 'Không được phép tự thay đổi vai trò của chính mình' }
        });
      }
      if (body.isActive === false) {
        return reply.status(403).send({
          success: false,
          error: { code: 'SELF_DEACTIVATION_FORBIDDEN', message: 'Không thể tự vô hiệu hóa tài khoản của chính mình' }
        });
      }
    }

    // 3. Role Validation & Escalation Prevention if updating role
    let newRoleId = body.roleId;
    let newRoleName = body.roleName as RoleName | undefined;

    if (newRoleId) {
      const roleRecord = await DatabaseRepository.findRoleById(newRoleId);
      if (!roleRecord) {
        return reply.status(400).send({
          success: false,
          error: { code: 'ROLE_NOT_FOUND', message: 'Vai trò chỉ định không tồn tại' }
        });
      }
      if (user.role !== 'SUPER_ADMIN' && roleRecord.businessId !== existingUser.businessId) {
        return reply.status(403).send({
          success: false,
          error: { code: 'ROLE_OUTSIDE_BUSINESS', message: 'Vai trò không thuộc doanh nghiệp này' }
        });
      }
      newRoleName = roleRecord.name as RoleName;
    }

    if (newRoleName && !canAssignRole(user.role, newRoleName)) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'PRIVILEGE_ESCALATION_DENIED',
          message: `Vai trò ${user.role} không được phép cấp quyền ${newRoleName}`
        }
      });
    }

    // 4. Warehouse Scope Check if updating warehouse
    let newWarehouseId = body.warehouseId;
    if (newWarehouseId !== undefined) {
      if (user.role === 'WAREHOUSE_MANAGER') {
        if (newWarehouseId !== user.warehouseId) {
          return reply.status(403).send({
            success: false,
            error: { code: 'WAREHOUSE_ACCESS_DENIED', message: 'Quản lý kho không thể chuyển nhân viên sang kho khác' }
          });
        }
      } else if (newWarehouseId && user.role !== 'SUPER_ADMIN') {
        const wh = await DatabaseRepository.findWarehouseById(newWarehouseId);
        if (!wh || wh.businessId !== existingUser.businessId) {
          return reply.status(400).send({
            success: false,
            error: { code: 'INVALID_WAREHOUSE', message: 'Kho hàng không tồn tại hoặc không thuộc doanh nghiệp này' }
          });
        }
      }
    }

    try {
      const updatedUser = await DatabaseRepository.updateStaffUser(id, {
        fullName: body.fullName,
        email: body.email,
        phone: body.phone,
        warehouseId: newWarehouseId,
        roleId: newRoleId,
        isActive: body.isActive,
        password: body.password
      });

      // Audit Log: Role change
      if (newRoleName && newRoleName !== existingUser.roleName) {
        await DatabaseRepository.recordAuditLog({
          businessId: existingUser.businessId,
          warehouseId: existingUser.warehouseId,
          userId: user.sub,
          action: 'USER_ROLE_CHANGED',
          resourceType: 'USER',
          resourceId: id,
          details: {
            targetUsername: existingUser.username,
            oldRole: existingUser.roleName,
            newRole: newRoleName
          }
        });
      }

      // Audit Log: Password update (never log password itself)
      if (body.password) {
        await DatabaseRepository.recordAuditLog({
          businessId: existingUser.businessId,
          warehouseId: existingUser.warehouseId,
          userId: user.sub,
          action: 'USER_PASSWORD_RESET',
          resourceType: 'USER',
          resourceId: id,
          details: { targetUsername: existingUser.username }
        });
      }

      // Audit Log: Status toggle via PUT
      if (body.isActive !== undefined && body.isActive !== existingUser.isActive) {
        await DatabaseRepository.recordAuditLog({
          businessId: existingUser.businessId,
          warehouseId: existingUser.warehouseId,
          userId: user.sub,
          action: body.isActive ? 'USER_ACTIVATED' : 'USER_LOCKED',
          resourceType: 'USER',
          resourceId: id,
          details: { targetUsername: existingUser.username }
        });
      }

      // Revoke active WebSocket sessions if deactivated, role changed, warehouse changed, or password reset
      if (
        body.isActive === false ||
        (newRoleName && newRoleName !== existingUser.roleName) ||
        (body.warehouseId !== undefined && body.warehouseId !== existingUser.warehouseId) ||
        body.password
      ) {
        StationGateway.revokeUser(id, 'Tài khoản đã bị thay đổi quyền hoặc bị khóa');
      }

      return reply.status(200).send({
        success: true,
        data: updatedUser
      });
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: { code: 'USER_UPDATE_FAILED', message: err.message || 'Cập nhật tài khoản thất bại' }
      });
    }
  });

  // 5. Toggle staff active status (lock/unlock)
  app.patch('/api/v1/admin/users/:id/status', {
    preHandler: [authenticateUser, requireRoles('SUPER_ADMIN', 'ADMIN', 'WAREHOUSE_MANAGER')]
  }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as any;
    const { isActive } = request.body as any;

    if (id === user.sub) {
      return reply.status(403).send({
        success: false,
        error: { code: 'SELF_DEACTIVATION_FORBIDDEN', message: 'Không thể tự thay đổi trạng thái tài khoản của chính mình' }
      });
    }

    const existingUser = await DatabaseRepository.getStaffUserById(id);
    if (!existingUser) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Không tìm thấy người dùng' }
      });
    }

    const editCheck = canEditTargetUser(user, existingUser);
    if (!editCheck.allowed) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: editCheck.reason || 'Bạn không có quyền thay đổi trạng thái tài khoản này' }
      });
    }

    await DatabaseRepository.toggleStaffUserActive(id, !!isActive);

    // Audit Log: Sensitive operation USER_LOCKED / USER_ACTIVATED
    await DatabaseRepository.recordAuditLog({
      businessId: existingUser.businessId,
      warehouseId: existingUser.warehouseId,
      userId: user.sub,
      action: isActive ? 'USER_ACTIVATED' : 'USER_LOCKED',
      resourceType: 'USER',
      resourceId: id,
      details: { targetUsername: existingUser.username }
    });

    if (!isActive) {
      StationGateway.revokeUser(id, 'Tài khoản đã bị khóa bởi quản trị viên');
    }

    return reply.status(200).send({
      success: true,
      data: { id, isActive: !!isActive }
    });
  });

  // 6. Reset staff user password explicitly
  app.post('/api/v1/admin/users/:id/reset-password', {
    preHandler: [authenticateUser, requireRoles('SUPER_ADMIN', 'ADMIN')]
  }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as any;
    const { newPassword } = request.body as any;

    if (!newPassword || newPassword.length < 6) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_PASSWORD', message: 'Mật khẩu mới phải có ít nhất 6 ký tự' }
      });
    }

    const existingUser = await DatabaseRepository.getStaffUserById(id);
    if (!existingUser) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Không tìm thấy người dùng' }
      });
    }

    const editCheck = canEditTargetUser(user, existingUser);
    if (!editCheck.allowed) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: editCheck.reason || 'Bạn không có quyền đặt lại mật khẩu tài khoản này' }
      });
    }

    await DatabaseRepository.updateStaffUser(id, { password: newPassword });

    // Audit Log: Sensitive operation USER_PASSWORD_RESET (no password stored!)
    await DatabaseRepository.recordAuditLog({
      businessId: existingUser.businessId,
      warehouseId: existingUser.warehouseId,
      userId: user.sub,
      action: 'USER_PASSWORD_RESET',
      resourceType: 'USER',
      resourceId: id,
      details: { targetUsername: existingUser.username }
    });

    StationGateway.revokeUser(id, 'Mật khẩu đã được đặt lại');

    return reply.status(200).send({
      success: true,
      message: 'Đặt lại mật khẩu thành công'
    });
  });
}
