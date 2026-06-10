import Constants from 'expo-constants';
import { api } from './client';

/**
 * Real-person verification (VERIFY1). The user records a selfie photo or a
 * short video performing a randomly-issued pose, submits it, and an admin
 * approves it in the AdminVerifications dashboard → green "verified" seal.
 */

function unwrap<T>(p: Promise<{ data: { data?: T } & T }>): Promise<T> {
  return p.then((r) => {
    const body = r.data as any;
    return (body?.data ?? body) as T;
  });
}

const ORIGIN = (
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  'https://gaymeet-api.onrender.com'
).replace(/\/+$/, '');

/** Resolve a stored media path. Full URLs pass through; bare `/uploads/...`
 *  disk paths get the API origin prefixed so <Image> can load them. */
export function resolveMediaUrl(path?: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
}

export type VerificationStatus = 'none' | 'pending' | 'approved' | 'rejected';

export interface VerificationState {
  status: VerificationStatus;
  pose?: string;
  verificationType?: 'photo' | 'video';
  rejectedReason?: string | null;
  createdAt?: string;
  reviewedAt?: string | null;
}

export const getVerificationStatus = () =>
  unwrap<VerificationState>(api.get('/verification/status'));

export const getVerificationPose = () =>
  unwrap<{ pose: string }>(api.get('/verification/pose'));

const UPLOAD_TIMEOUT = 60_000;

/** Submit a selfie photo (file:// uri) performing the issued pose. */
export const submitSelfieVerification = (uri: string, pose: string) => {
  const ext = (uri.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
  const fd = new FormData();
  fd.append('selfie', { uri, name: `selfie.${ext}`, type: `image/${ext === 'jpg' ? 'jpeg' : ext}` } as any);
  fd.append('pose', pose);
  return unwrap<{ status: string; pose: string }>(
    api.post('/verification/submit', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: (d) => d,
      timeout: UPLOAD_TIMEOUT,
    }) as any,
  );
};

/** Submit a short pose video (file:// uri). Premium-gated server-side (403). */
export const submitVideoVerification = (uri: string, pose: string) => {
  const ext = (uri.split('?')[0].split('.').pop() || 'mp4').toLowerCase();
  const type = ext === 'mov' ? 'video/quicktime' : `video/${ext}`;
  const fd = new FormData();
  fd.append('video', { uri, name: `verify.${ext}`, type } as any);
  fd.append('pose', pose);
  return unwrap<{ status: string; verificationType: string }>(
    api.post('/verification/submit-video', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: (d) => d,
      timeout: UPLOAD_TIMEOUT,
    }) as any,
  );
};
