import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RequireAdmin } from './RequireAdmin';
import { TOKEN_KEY } from '@/lib/adminApi';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/login" element={<div>LOGIN PAGE</div>} />
        <Route path="/admin" element={<RequireAdmin><div>DASHBOARD</div></RequireAdmin>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireAdmin', () => {
  beforeEach(() => localStorage.clear());

  it('redirects to login without a token', () => {
    renderAt('/admin');
    expect(screen.getByText('LOGIN PAGE')).toBeInTheDocument();
  });

  it('renders children with a token', () => {
    localStorage.setItem(TOKEN_KEY, 'tok');
    renderAt('/admin');
    expect(screen.getByText('DASHBOARD')).toBeInTheDocument();
  });
});
