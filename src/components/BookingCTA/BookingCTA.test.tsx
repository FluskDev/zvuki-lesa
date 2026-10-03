import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BookingCTA } from './BookingCTA';

describe('BookingCTA', () => {
  it('renders anchor with homereserve.ru URL', () => {
    render(<BookingCTA />);
    const link = screen.getByRole('link', { name: /забронировать/i });
    expect(link).toHaveAttribute('href', 'https://homereserve.ru/feEBPdLdgb');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('uses custom label', () => {
    render(<BookingCTA label="Перейти к бронированию" />);
    expect(
      screen.getByRole('link', { name: /перейти к бронированию/i }),
    ).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<BookingCTA className="my-class" />);
    expect(screen.getByRole('link')).toHaveClass('my-class');
  });
});
