import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { getToken } from '@/lib/adminApi';

export function RequireAdmin({ children }: { children: ReactNode }) {
  if (!getToken()) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}
