import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NotFoundPage } from './NotFoundPage';

afterEach(() => {
  document.head.innerHTML = '';
  document.title = '';
});

describe('NotFoundPage', () => {
  it('рендерит страницу с CTA на главную и популярными разделами', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );

    // Заголовок и пояснение.
    expect(screen.getByRole('heading', { level: 1, name: /страница не найдена/i })).toBeInTheDocument();

    // CTA на главную.
    const homeLinks = screen.getAllByRole('link', { name: /на главную/i });
    expect(homeLinks.length).toBeGreaterThan(0);
    homeLinks.forEach((link) => {
      expect(link).toHaveAttribute('href', '/');
    });

    // Популярные разделы — должны присутствовать.
    expect(screen.getByRole('link', { name: /домики/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /блог/i })).toBeInTheDocument();

    // Контакты в футере.
    expect(screen.getByRole('link', { name: /\+7 \(928\) 211-02-49/i })).toHaveAttribute(
      'href',
      'tel:+79282110249',
    );
    expect(screen.getByRole('link', { name: /booking@zvuki-lesa\.ru/i })).toHaveAttribute(
      'href',
      'mailto:booking@zvuki-lesa.ru',
    );
  });

  it('проставляет noindex/nofollow и canonical на главную', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );

    expect(document.title).toBe('Страница не найдена | Звуки Леса');
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow',
    );
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://zvuki-lesa.ru/',
    );
  });
});
