import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MaintenancePage } from './MaintenancePage';

afterEach(() => {
  document.head.innerHTML = '';
});

describe('MaintenancePage', () => {
  it('показывает заглушку про технические работы', () => {
    render(<MaintenancePage />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Сайт на технических работах',
    );
    expect(screen.getByText(/технические работы/i)).toBeInTheDocument();
  });

  it('даёт забронировать по телефону', () => {
    render(<MaintenancePage />);

    const phone = screen.getByRole('link', { name: /Позвонить и забронировать/ });
    expect(phone).toHaveAttribute('href', 'tel:+79282110249');
    expect(phone).toHaveTextContent('+7 (928) 211-02-49');
  });

  it('не отдаёт заглушку в индекс, но сохраняет переход по ссылкам', () => {
    render(<MaintenancePage />);

    expect(document.title).toContain('технические работы');
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, follow',
    );
  });
});
