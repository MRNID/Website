import * as fs from 'node:fs';

export interface GoogleDriveTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
  email: string;
}

export class GoogleDriveService {
  static async generateFileId(accessToken: string): Promise<string> {
    const response = await fetch('https://www.googleapis.com/drive/v3/files/generateIds?count=1&space=drive&type=files', {
      headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(30000)
    });
    const result = await response.json();
    if (!response.ok || !result.ids?.[0]) throw new Error('Không thể cấp ID video trên Drive');
    return result.ids[0];
  }

  static async getFileMetadata(accessToken: string, fileId: string): Promise<any | null> {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,size,sha256Checksum,trashed,appProperties`, {
      headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(30000)
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Không thể kiểm tra video trên Drive (${response.status})`);
    return response.json();
  }

  static async createResumableUpload(params: { accessToken: string; fileId: string; folderId: string; filename: string; fileSize: number; mimeType: string; videoId: string }): Promise<string> {
    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id', {
      method: 'POST', headers: {
        Authorization: `Bearer ${params.accessToken}`, 'Content-Type': 'application/json',
        'X-Upload-Content-Type': params.mimeType, 'X-Upload-Content-Length': String(params.fileSize)
      },
      body: JSON.stringify({ id: params.fileId, name: params.filename, parents: [params.folderId], appProperties: { packingVideoId: params.videoId } }),
      signal: AbortSignal.timeout(30000)
    });
    const location = response.headers.get('location');
    if (!response.ok || !location) throw new Error(`Không thể mở phiên tải lên Drive (${response.status})`);
    return location;
  }

  static async downloadRange(accessToken: string, fileId: string, start: number, end: number): Promise<Response> {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}`, Range: `bytes=${start}-${end}` }, signal: AbortSignal.timeout(30000)
    });
    if (response.status !== 206 && !(start === 0 && response.status === 200)) {
      await response.body?.cancel();
      throw new Error(`Không thể đọc bản sao Drive (${response.status})`);
    }
    return response;
  }

  private static requiredEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`Chưa cấu hình ${name} cho Google Drive.`);
    return value;
  }

  private static validateToken(token: string): void {
    if (typeof token !== 'string' || !token || token.startsWith('mock_')) {
      throw new Error('Thông tin Google Drive không hợp lệ. Vui lòng liên kết lại qua Google.');
    }
  }

  private static get clientId(): string {
    return this.requiredEnv('GOOGLE_CLIENT_ID');
  }
  private static get clientSecret(): string {
    return this.requiredEnv('GOOGLE_CLIENT_SECRET');
  }
  private static get redirectUri(): string {
    return process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/v1/auth/google/callback';
  }

  static get adminReturnUrl(): string {
    const fallback = new URL(this.redirectUri);
    fallback.port = '3001';
    return new URL('/tenants', process.env.ADMIN_WEB_URL || fallback.origin).toString();
  }

  /**
   * Generate official Google OAuth 2.0 Consent URL
   */
  static getAuthUrl(businessId: string): string {
    this.clientSecret; // Fail before opening consent if credentials are incomplete.
    const scope = encodeURIComponent('https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email');
    const state = encodeURIComponent(businessId);
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(
      this.redirectUri
    )}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${state}`;
  }

  /**
   * Exchange OAuth Code for Tokens
   */
  static async exchangeCodeForTokens(code: string): Promise<GoogleDriveTokens> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error_description || data.error || 'Lỗi cấp quyền Google OAuth');
    }

    this.validateToken(data.access_token);
    this.validateToken(data.refresh_token);

    // Do not persist a connection unless Google confirms the account identity.
    const aboutRes = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
      headers: { Authorization: `Bearer ${data.access_token}` }
    });
    const aboutData = await aboutRes.json();
    if (!aboutRes.ok || !aboutData?.user?.emailAddress) {
      throw new Error('Không thể xác nhận tài khoản Google Drive. Vui lòng liên kết lại.');
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      email: aboutData.user.emailAddress
    };
  }

  /**
   * Refresh expired access token
   */
  static async refreshAccessToken(refreshToken: string): Promise<string> {
    this.validateToken(refreshToken);

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error('Không thể làm mới token Google Drive: ' + (data.error_description || data.error));
    }
    this.validateToken(data.access_token);
    return data.access_token;
  }

  /**
   * Ensure root folder exists in customer's Google Drive
   */
  static async ensureFolder(accessToken: string, folderName = 'PackingProof_Videos'): Promise<string> {
    this.validateToken(accessToken);

    // Search if folder already exists
    const escapedName = folderName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const query = new URLSearchParams({ q: `name='${escapedName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`, fields: 'files(id,name)' });
    const searchUrl = `https://www.googleapis.com/drive/v3/files?${query}`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const searchData = await searchRes.json();
    if (!searchRes.ok || !Array.isArray(searchData.files)) {
      throw new Error('Không thể kiểm tra thư mục Google Drive.');
    }

    if (searchData.files.length > 0 && searchData.files[0].id) {
      return searchData.files[0].id;
    }

    // Create new folder
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
      })
    });

    const createData = await createRes.json();
    if (!createRes.ok || !createData.id) throw new Error('Không thể tạo thư mục Google Drive.');
    return createData.id;
  }

  /**
   * Upload video file directly to customer's Google Drive
   */
  static async uploadVideo(params: {
    accessToken: string;
    folderId: string;
    filePath: string;
    filename: string;
    mimeType?: string;
  }): Promise<{ fileId: string; webViewLink?: string }> {
    this.validateToken(params.accessToken);
    if (!params.folderId || params.folderId.includes('mock_')) throw new Error('Thư mục Google Drive không hợp lệ.');

    if (!fs.existsSync(params.filePath)) {
      throw new Error(`File video ${params.filePath} không tồn tại trên ổ cứng.`);
    }

    const fileBuffer = fs.readFileSync(params.filePath);
    const metadata = {
      name: params.filename,
      parents: [params.folderId]
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody = Buffer.concat([
      Buffer.from(
        delimiter +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(metadata) +
          delimiter +
          `Content-Type: ${params.mimeType || (params.filename.endsWith('.webm') ? 'video/webm' : params.filename.endsWith('.mkv') ? 'video/x-matroska' : 'video/mp4')}\r\n\r\n`
      ),
      fileBuffer,
      Buffer.from(closeDelimiter)
    ]);

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'Content-Length': multipartRequestBody.length.toString()
        },
        body: multipartRequestBody
      }
    );

    const uploadData = await uploadRes.json();
    if (!uploadRes.ok || !uploadData.id || String(uploadData.id).startsWith('mock_')) {
      throw new Error('Lỗi tải video lên Google Drive: ' + (uploadData.error?.message || 'Upload failed'));
    }

    return {
      fileId: uploadData.id,
      webViewLink: uploadData.webViewLink || `https://drive.google.com/file/d/${encodeURIComponent(uploadData.id)}/view`
    };
  }

}
