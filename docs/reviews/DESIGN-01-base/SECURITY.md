# PACKING VIDEO PROOF - SECURITY SPECIFICATION

> **Design draft:** Read [BASELINE.md](BASELINE.md) first. Examples below require alignment with its open contracts and acceptance gates before implementation; they are not validated production configurations.

> **Document Version:** 1.0.0  
> **Topic:** Authentication, Role-Based Access Control, Credential Encryption & Data Integrity

---

## 1. Password & Credential Security

### 1.1. User Passwords
- All user passwords are encrypted using **Argon2id** (memory cost: 64MB, time cost: 3 iterations, parallelism: 4 threads).
- Legacy algorithms (MD5, SHA1) are prohibited.

### 1.2. Camera & Storage Credentials at Rest
- Sensitive fields in the database (`cameras.password_encrypted`, `storage_configs.password_encrypted`) are encrypted using **AES-256-GCM**.
- Key management: The Master Key (`ENCRYPTION_MASTER_KEY_32B`) is injected strictly via environment variables or Windows Protected Storage, never checked into version control.

---

## 2. Role-Based Access Control (RBAC) Matrix

| Resource / Action | SUPER_ADMIN | ADMIN | WAREHOUSE_MANAGER | PACKING_USER | CUSTOMER_SERVICE | VIEWER |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **System Settings** | Full | View | No | No | No | No |
| **User & Role Admin** | Full | Warehouse | No | No | No | No |
| **Station & Camera Config**| Full | Full | View | No | No | No |
| **Packing Operations** | Yes | Yes | Yes | **Full** | No | No |
| **Video Proof Search** | Full | Full | Full | Own Station | **Full** | View |
| **Video Download** | Yes | Yes | Yes | No | **Yes** | No |
| **Lock / Dispute Toggle** | Yes | Yes | Yes | No | **Yes** | No |
| **Audit Logs View** | Full | Full | View | No | No | View |

---

## 3. Video Integrity & Anti-Tampering Guarantee

1. **Immutable Proof Record:** The original MP4 file is never modified, re-encoded, or overwritten.
2. **SHA-256 Digital Fingerprint:** Calculated immediately upon stream closure.
3. **Audit Log Trail:** Every playback, download, dispute lock, and configuration change generates an immutable log entry in `system_logs`.
