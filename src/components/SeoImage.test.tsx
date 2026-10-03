import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SeoImage } from './SeoImage';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));

describe('SeoImage', () => {
  it('renders with provided alt', () => {
    render(<SeoImage src="/x.jpg" alt="Mountain view" />);
    expect(screen.getByAltText('Mountain view')).toBeInTheDocument();
  });

  it('defaults to lazy loading', () => {
    render(<SeoImage src="/x.jpg" alt="x" />);
    expect(screen.getByAltText('x')).toHaveAttribute('loading', 'lazy');
  });

  it('respects eager loading override', () => {
    render(<SeoImage src="/x.jpg" alt="x" loading="eager" />);
    expect(screen.getByAltText('x')).toHaveAttribute('loading', 'eager');
  });

  it('warns in dev when alt is empty', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<SeoImage src="/x.jpg" alt="" />);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});