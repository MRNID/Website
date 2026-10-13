import { FastifyInstance } from 'fastify';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { DatabaseRepository } from '@packing-proof/database';
import { GoogleDriveService } from '../services/google-drive.service.js';
import { authenticateUser } from '../auth/auth.middleware.js';
import {
  requireRoles,
  checkBusinessAccess,
  OAuthStateManager
} from '../auth/authorization.guard.js';

export async function googleDriveRoutes(app: FastifyInstance) {
  // 1. Get Google OAuth URL - Requires SUPER_ADMIN or business ADMIN
  app.get(
    '/api/v1/auth/google/url',
    {
      preHandler: [authenticateUser, requireRoles('SUPER_ADMIN', 'ADMIN')]
    },
    async (request, reply) => {
      const user = request.user!;
      const { businessId } = request.query as { businessId?: string };
      const targetBizId = businessId || user.businessId;

      if (!targetBizId) {
        return reply.status(400).send({
          success: false,
          error: { code: 'BUSINESS_ID_REQUIRED', message: 'Cần chỉ định businessId để cấp quyền Google Drive' }
        });
      }

      // Check tenant scope: ADMIN can only authorize their own business
      if (!checkBusinessAccess(user, targetBizId)) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Không có quyền thao tác trên doanh nghiệp này' }
        });
      }

      // Generate cryptographically secure, single-use, expiring state tied to creator and authorized business
      const stateToken = OAuthStateManager.generateState(targetBizId, user.sub, 600);
      const authUrl = GoogleDriveService.getAuthUrl(stateToken);

      return reply.send({
        success: true,
        authUrl,
        data: { authUrl }
      });
    }
  );

  // 2. Google OAuth Callback (redirected by Google)
  // Verifies single-use, expiring state token tied to creator and authorized business
  app.get('/api/v1/auth/google/callback', async (request, reply) => {
    const { code, state, error } = request.query as { code?: string; state?: string; error?: string };
    const isJsonRequest = request.headers.accept?.includes('application/json');

    if (error || !code || !state) {
      if (isJsonRequest) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_OAUTH_REQUEST', message: error || 'Thiếu authorization code hoặc state token' }
        });
      }
      return reply.redirect(GoogleDriveService.adminReturnUrl + '?tab=tenants&google_status=error&msg=' + encodeURIComponent(error || 'Thiếu authorization code hoặc state'));
    }

    // Verify and consume state (single-use, expires in 10 minutes)
    const stateRecord = OAuthStateManager.consumeState(state);
    if (!stateRecord) {
      if (isJsonRequest) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_OR_EXPIRED_STATE',
            message: 'OAuth state không hợp lệ, đã hết hạn hoặc đã được sử dụng (CSRF protection)'
          }
        });
      }
      return reply.redirect(GoogleDriveService.adminReturnUrl + '?tab=tenants&google_status=error&msg=' + encodeURIComponent('Trạng thái xác thực không hợp lệ, đã hết hạn hoặc đã được sử dụng'));
    }

    try {
      const businessId = stateRecord.businessId;
      const tokens = await GoogleDriveService.exchangeCodeForTokens(code);
      const folderId = await GoogleDriveService.ensureFolder(tokens.accessToken, 'PackingProof_Videos');

      await DatabaseRepository.saveBusinessGoogleDrive({
        businessId,
        email: tokens.email,
        refreshToken: tokens.refreshToken,
        folderId
      });

      // Audit Log: Sensitive operation GOOGLE_DRIVE_OAUTH_CONNECTED (never log tokens)
      await DatabaseRepository.recordAuditLog({
        businessId,
        userId: stateRecord.userId,
        action: 'GOOGLE_DRIVE_OAUTH_CONNECTED',
        resourceType: 'GOOGLE_DRIVE',
        resourceId: businessId,
        details: { email: tokens.email, folderId }
      });

      return reply.redirect(GoogleDriveService.adminReturnUrl + '?tab=tenants&google_status=success&email=' + encodeURIComponent(tokens.email));
    } catch (err: any) {
      console.error('[GoogleDriveCallback] Error:', err);
      if (isJsonRequest) {
        return reply.status(500).send({
          success: false,
          error: { code: 'OAUTH_EXCHANGE_FAILED', message: err.message }
        });
      }
      return reply.redirect(GoogleDriveService.adminReturnUrl + '?tab=tenants&google_status=error&msg=' + encodeURIComponent(err.message));
    }
  });

  // Legacy clients must use the real consent flow in every environment.
  app.post('/api/v1/businesses/:id/google-drive/instant-connect', {
    preHandler: [authenticateUser, requireRoles('SUPER_ADMIN', 'ADMIN')]
  }, async (_request, reply) => reply.status(410).send({
    success: false,
    error: { code: 'OAUTH_REQUIRED', message: 'Vui lòng đăng nhập Google để liên kết Drive.' }
  }));

  // 4. Get Google Drive connection status - Requires SUPER_ADMIN or business ADMIN
  app.get(
    '/api/v1/businesses/:id/google-drive',
    {
      preHandler: [authenticateUser, requireRoles('SUPER_ADMIN', 'ADMIN')]
    },
    async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };
      if (!checkBusinessAccess(user, id)) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Không có quyền truy cập thông tin doanh nghiệp này' }
        });
      }

      const status = await DatabaseRepository.getBusinessGoogleDrive(id);
      // Strictly omit refreshToken and any sensitive credential from API response
      const { refreshToken, accessToken, clientSecret, ...safeStatus } = (status || {}) as any;

      return reply.send({
        success: true,
        data: {
          ...safeStatus,
          folderName: 'Google Drive / PackingProof_Videos',
          autoPurgeEnabled: false,
          quotaEstimate: '15 GB (Miễn phí từ Google)'
        }
      });
    }
  );

  // 5. Disconnect Google Drive - Requires SUPER_ADMIN or business ADMIN
  app.delete(
    '/api/v1/businesses/:id/google-drive',
    {
      preHandler: [authenticateUser, requireRoles('SUPER_ADMIN', 'ADMIN')]
    },
    async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };
      if (!checkBusinessAccess(user, id)) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Không có quyền thao tác trên doanh nghiệp này' }
        });
      }

      await DatabaseRepository.disconnectBusinessGoogleDrive(id);

      // Audit Log: Sensitive operation GOOGLE_DRIVE_DISCONNECTED
      await DatabaseRepository.recordAuditLog({
        businessId: id,
        userId: user.sub,
        action: 'GOOGLE_DRIVE_DISCONNECTED',
        resourceType: 'GOOGLE_DRIVE',
        resourceId: id
      });

      return reply.send({
        success: true,
        message: 'Đã hủy liên kết Google Drive thành công.'
      });
    }
  );

  // 6. Upload a real text file to test the connection - Requires SUPER_ADMIN or business ADMIN
  app.post(
    '/api/v1/businesses/:id/google-drive/test-sync',
    {
      preHandler: [authenticateUser, requireRoles('SUPER_ADMIN', 'ADMIN')]
    },
    async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };
      if (!checkBusinessAccess(user, id)) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Không có quyền thao tác trên doanh nghiệp này' }
        });
      }

      const config = await DatabaseRepository.getBusinessGoogleDrive(id);

      if (!config.connected) {
        return reply.status(400).send({
          success: false,
          error: { code: 'NOT_CONNECTED', message: 'Shop chưa liên kết Google Drive.' }
        });
      }

      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'packing-drive-test-'));
      const filename = 'packing-proof-connection-test.txt';
      const tempFile = path.join(tempDir, filename);
      try {
        const accessToken = await GoogleDriveService.refreshAccessToken(config.refreshToken || '');
        const contents = Buffer.from('Packing Proof: Google Drive connection test.\n');
        fs.writeFileSync(tempFile, contents);
        const uploaded = await GoogleDriveService.uploadVideo({
          accessToken,
          folderId: config.folderId || 'root',
          filePath: tempFile,
          filename,
          mimeType: 'text/plain'
        });
        return reply.send({
          success: true,
          message: 'Đã tải tệp kiểm tra lên Google Drive.',
          data: {
            filename,
            size: contents.length + ' bytes',
            driveUrl: uploaded.webViewLink,
            syncedAt: new Date().toISOString()
          }
        });
      } catch (err: any) {
        return reply.status(502).send({
          success: false,
          error: { code: 'DRIVE_SYNC_FAILED', message: err.message || 'Không thể tải tệp lên Google Drive.' }
        });
      } finally {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        fs.rmdirSync(tempDir);
      }
    }
  );
}
