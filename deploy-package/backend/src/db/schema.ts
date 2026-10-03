import { pgTable, serial, integer, text, timestamp, date, boolean, doublePrecision, jsonb, primaryKey, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { pgEnum } from 'drizzle-orm/pg-core';

// ============ ENUMS ============
export const cottageImageSectionEnum = pgEnum('cottage_image_section', ['main', 'interior', 'kitchen', 'bathroom', 'amenities']);
export const priceRuleModifierEnum = pgEnum('price_rule_modifier', ['percent', 'fixed']);
export const bookingStatusEnum = pgEnum('booking_status', ['new', 'confirmed', 'cancelled']);
export const bookingSourceEnum = pgEnum('booking_source', ['site', 'manual']);
export const reviewSourceEnum = pgEnum('review_source', ['2gis', 'yandex', 'google', 'manual']);

// ============ COTTAGES ============
export const cottages = pgTable('cottages', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  mapId: text('map_id').unique(),
  name: text('name').notNull(),
  shortDescription: text('short_description').notNull(),
  longDescription: text('long_description').notNull(),
  description: text('description'),
  houseRules: text('house_rules'),
  basePrice: integer('base_price').notNull(),
  area: integer('area').notNull(),
  guests: integer('guests').notNull(),
  bedrooms: integer('bedrooms').notNull(),
  bedsDouble: integer('beds_double').notNull().default(0),
  bedsSingle: integer('beds_single').notNull().default(0),
  checkInTime: text('check_in_time').notNull(),
  checkOutTime: text('check_out_time').notNull(),
  mainImage: text('main_image').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
});

export const cottageImages = pgTable('cottage_images', {
  id: serial('id').primaryKey(),
  cottageId: integer('cottage_id').notNull().references(() => cottages.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  section: cottageImageSectionEnum('section').notNull().default('interior'),
  position: integer('position').notNull().default(0),
}, (t) => ({
  byCottageSection: index('idx_cottage_images_cottage_section').on(t.cottageId, t.section, t.position),
}));

export const amenities = pgTable('amenities', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  icon: text('icon'),
});

export const cottageAmenities = pgTable('cottage_amenities', {
  cottageId: integer('cottage_id').notNull().references(() => cottages.id, { onDelete: 'cascade' }),
  amenityId: integer('amenity_id').notNull().references(() => amenities.id, { onDelete: 'cascade' }),
}, (t) => ({
  pk: primaryKey({ columns: [t.cottageId, t.amenityId] }),
}));

export const recreationItems = pgTable('recreation_items', {
  id: serial('id').primaryKey(),
  cottageId: integer('cottage_id').notNull().references(() => cottages.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  photo: text('photo').notNull(),
  position: integer('position').notNull().default(0),
});

// ============ SITE MAP (статические элементы) ============
// Парковка, Лес1, Лес2, чан — статические элементы SVG-карты, которые НЕ
// привязаны к cottageId. Содержат название, описание и фото для 3D-модели
// на странице домика. mapId используется как первичный ключ, чтобы
// сопоставление с `<g id="_mapId">` в maps.svg было естественным.
export const siteMapElements = pgTable('site_map_elements', {
  mapId: text('map_id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  photoUrl: text('photo_url'),
  hasButton: boolean('has_button').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
});

// ============ SERVICES & PRICING ============
export const services = pgTable('services', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  basePrice: integer('base_price'),
  icon: text('icon').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  position: integer('position').notNull().default(0),
});

export const priceRules = pgTable('price_rules', {
  id: serial('id').primaryKey(),
  cottageId: integer('cottage_id').references(() => cottages.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  modifierType: priceRuleModifierEnum('modifier_type').notNull(),
  modifierValue: integer('modifier_value').notNull(),
  weekendModifier: integer('weekend_modifier'),
  priority: integer('priority').notNull().default(0),
}, (t) => ({
  byDate: index('idx_price_rules_dates').on(t.startDate, t.endDate),
}));

// ============ BOOKINGS ============
export const bookings = pgTable('bookings', {
  id: serial('id').primaryKey(),
  cottageId: integer('cottage_id').notNull().references(() => cottages.id),
  guestName: text('guest_name').notNull(),
  phone: text('phone').notNull(),
  email: text('email'),
  checkInDate: date('check_in_date').notNull(),
  checkOutDate: date('check_out_date').notNull(),
  guests: integer('guests').notNull(),
  notes: text('notes'),
  nights: integer('nights').notNull(),
  subtotal: integer('subtotal').notNull(),
  servicesTotal: integer('services_total').notNull().default(0),
  totalPrice: integer('total_price').notNull(),
  status: bookingStatusEnum('status').notNull().default('new'),
  source: bookingSourceEnum('source').notNull().default('site'),
  managerComment: text('manager_comment'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (t) => ({
  byCottage: index('idx_bookings_cottage').on(t.cottageId, t.checkInDate, t.checkOutDate),
  byStatus: index('idx_bookings_status').on(t.status),
}));

export const bookingServices = pgTable('booking_services', {
  id: serial('id').primaryKey(),
  bookingId: integer('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
  serviceId: integer('service_id').notNull().references(() => services.id),
  quantity: integer('quantity').notNull().default(1),
  priceAtBooking: integer('price_at_booking'),
}, (t) => ({
  byBooking: index('idx_booking_services_booking').on(t.bookingId),
}));

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(),
  bookingId: integer('booking_id').references(() => bookings.id, { onDelete: 'set null' }),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true, mode: 'date' }),
});

// ============ SEO / BLOG ============
export const seoPages = pgTable('seo_pages', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  h1: text('h1').notNull(),
  body: text('body').notNull(),
  metaImage: text('meta_image'),
  intent: text('intent').notNull(),
  schemaJson: text('schema_json').notNull(),
  isPublished: boolean('is_published').notNull().default(false),
  priority: doublePrecision('priority').notNull().default(0.7),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (t) => ({
  byPublishedPriority: index('idx_seo_pages_published_priority').on(t.isPublished, t.priority),
}));

export const blogPosts = pgTable('blog_posts', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  excerpt: text('excerpt').notNull(),
  body: text('body').notNull(),
  coverImage: text('cover_image'),
  author: text('author').notNull().default('Команда Звуки Леса'),
  category: text('category').notNull(),
  readingTimeMin: integer('reading_time_min').notNull().default(5),
  schemaJson: text('schema_json').notNull(),
  isPublished: boolean('is_published').notNull().default(false),
  publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (t) => ({
  byPublishedPublishedAt: index('idx_blog_posts_published_published_at').on(t.isPublished, t.publishedAt),
}));

export const imagesRegistry = pgTable('images_registry', {
  id: serial('id').primaryKey(),
  path: text('path').notNull().unique(),
  alt: text('alt').notNull(),
  caption: text('caption'),
  width: integer('width'),
  height: integer('height'),
  uploadedBy: text('uploaded_by').notNull().default('admin'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
});

export const reviews = pgTable('reviews', {
  id: serial('id').primaryKey(),
  authorName: text('author_name').notNull(),
  rating: integer('rating').notNull(),
  text: text('text').notNull(),
  date: timestamp('date', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  source: reviewSourceEnum('source').notNull().default('manual'),
  externalId: text('external_id'),
  isPublished: boolean('is_published').notNull().default(false),
  // Локальный URL на скачанный и обработанный аватар (webp) из внешнего источника.
  // null = нет аватара, отрисуем инициалы.
  avatarUrl: text('avatar_url'),
  // Ссылка автора на внешней платформе (профиль Яндекс.Карт и т.п.) —
  // для кнопки «Открыть на Яндексе» в админке. null = не импортировано.
  authorUrl: text('author_url'),
}, (t) => ({
  // Публичная лента отзывов: SELECT * FROM reviews WHERE is_published ORDER BY date DESC
  byPublishedDate: index('idx_reviews_published_date').on(t.isPublished, t.date),
  // Дедупликация импорта из внешних источников (Яндекс.Карты и т. п.).
  // Partial index — чтобы NULL external_id (ручные отзывы) не конфликтовали.
  bySourceExternalId: uniqueIndex('uniq_reviews_source_external_id')
    .on(t.source, t.externalId)
    .where(sql`${t.externalId} IS NOT NULL`),
}));

export const maxSubscribers = pgTable('max_subscribers', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().unique(),
  chatId: text('chat_id'),
  joinCode: text('join_code').notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true, mode: 'date' }).notNull(),
  lastNotifiedAt: timestamp('last_notified_at', { withTimezone: true, mode: 'date' }),
  isActive: boolean('is_active').notNull().default(true),
});

export const analyticsEvents = pgTable('analytics_events', {
  id: serial('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  eventType: text('event_type').notNull(),
  page: text('page'),
  label: text('label'),
  referrer: text('referrer'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (t) => ({
  byCreatedAt: index('idx_analytics_events_created_at').on(t.createdAt),
  bySession: index('idx_analytics_events_session').on(t.sessionId),
}));
