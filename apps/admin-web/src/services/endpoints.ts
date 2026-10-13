/// <reference types="vite/client" />
import { resolveBackendEndpoints } from '@packing-proof/shared-utils/backend-url';

export const { apiBase: API_BASE } = resolveBackendEndpoints(window.location.href, import.meta.env.VITE_BACKEND_ORIGIN);
