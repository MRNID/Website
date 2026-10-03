# PACKING VIDEO PROOF - SECURITY & AUDIT SPECIFICATION

> **Document Version:** 2.2.0 (Post Codex R1 Review - Findings D01-03, D01-08, D01-09 Addressed)  
> **Topic:** Resource-Scoped Authorization, Credential Protection, Filesystem Hardening & Audit Trails

---

## 1. Password & Credential Security (D01-09)

### 1.1. User Passwords (Argon2id)
All user passwords are encrypted using **Argon2id** with the following parameters:
- Memory cost: $65536\text{ KB}$ (64 MB)
- Time cost / iterations: $3$
- Parallelism: $4\text{ threads}$
- Salt: 16 bytes cryptographically secure random bytes (`crypto.randomBytes(16)`).

### 1.2. Camera & Storage Credentials at Rest (AES-256-GCM)
Sensitive fields in the database (`cameras.password_encrypted`, `storage_configs.password_encrypted`) are encrypted at rest using **AES-256-GCM**:
- Key: 256-bit Master Key (`ENCRYPTION_MASTER_KEY_32B`) injected via environment variable.
- IV: Unique 96-bit (12-byte) initialization vector per encryption operation.
- Authentication Tag: 128-bit (16-byte) tag appended to ciphertext to detect tampering.
- Stored Format: `iv_hex:tag_hex:ciphertext_hex`.

---

## 2. Resource-Scoped Access Control (D01-08)

### 2.1. Multi-Warehouse Boundary Scoping
- A user assigned to warehouse $W_1$ is strictly forbidden from accessing, operating, or viewing stations and videos belonging to warehouse $W_2$.
- The backend evaluates authorization against the database entity: `user.warehouse_id === station.warehouse_id`.
- Client-provided identifiers in URLs, headers, or localStorage are never trusted as authorization credentials.

### 2.2. Role-Based Access Control (RBAC) Matrix

| Resource / Action | SUPER_ADMIN | ADMIN | WAREHOUSE_MANAGER | PACKING_USER | CUSTOMER_SERVICE | VIEWER |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **System Settings** | Full Global | View Global | No | No | No | No |
| **User & Role Admin** | Full Global | Own Warehouse | No | No | No | No |
| **Station & Camera Config**| Full Global | Own Warehouse | View Own | No | No | No |
| **Packing Operations** | Yes | Yes | Yes | **Full Own Station** | No | No |
| **Force-Unlock Station** | Yes | Yes | **Yes** | No | No | No |
| **Video Proof Search** | Full Global | Own Warehouse | Own Warehouse | Own Station | **Full Global** | View Own |
| **Video Download** | Yes | Yes | Yes | No | **Yes** | No |
| **Lock / Dispute Toggle** | Yes | Yes | Yes | No | **Yes** | No |
| **Audit Logs View** | Full Global | Own Warehouse | View Own | No | No | View Own |

*Scope Distinction:*
- `SUPER_ADMIN`: Cross-warehouse sovereignty across the business.
- `CUSTOMER_SERVICE`: Global read & dispute lock authority across all warehouses to handle e-commerce customer claims.
- `ADMIN`, `WAREHOUSE_MANAGER`, `PACKING_USER`: Strictly confined to their `user.warehouse_id`.

---

## 3. Filesystem Hardening & Protection of Evidence (D01-09)

### 3.1. NTFS Access Control Lists (Windows Station PC)
To prevent operators or standard Windows user accounts from deleting or altering video evidence:
- **Dedicated Service Account:** The Video Worker runs under a dedicated, unprivileged Windows service account: `NT SERVICE\PackingVideoWorker`.
- **Temp Ingestion Directory (`D:\PackingVideoTemp`):**
  - `NT SERVICE\PackingVideoWorker`: Full Control `(OI)(CI)F`.
  - `BUILTIN\Administrators`: Full Control `(OI)(CI)F`.
  - `BUILTIN\Users`: **No Access** (Deny).
- **Archive Directory (`D:\PackingVideo`):**
  - `NT SERVICE\PackingVideoWorker`: Modify / Write / Read `(OI)(CI)M`.
  - `BUILTIN\Administrators`: Full Control `(OI)(CI)F`.
  - `BUILTIN\Users`: **Read & Execute Only** `(OI)(CI)RX` (Standard users cannot delete or overwrite video files).
- **Physical Machine Caveat:** A local user with Windows Administrator credentials can physically override NTFS ACLs. Therefore, cryptographic SHA-256 sealing in the remote PostgreSQL database provides the immutable forensic proof of tamper detection.

---

## 4. Retention & Dispute Race Prevention (D01-03)

- Videos marked `is_locked = TRUE` or `dispute_status = 'DISPUTE'` are excluded from retention sweeps.
- Deletion uses two-phase intent: marking `purge_status = 'PENDING_PURGE'` under row locks before any physical disk removal.
- If CSKH attempts to lock a video that has already entered `PENDING_PURGE` or `PURGED`, the API immediately returns `409 Conflict` (`VIDEO_ALREADY_PURGED_OR_PURGE_IN_PROGRESS`), guaranteeing no false positive dispute confirmation is ever issued.
