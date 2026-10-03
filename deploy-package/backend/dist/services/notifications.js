import { db } from '../db/client.js';
import { notifications } from '../db/schema.js';
import { formatBookingMessage, getActiveSubscribers, sendMessage, unsubscribeUser, } from './maxBot.js';
import { getTelegramChatIds, isTelegramEnabled, sendTelegramMessage, } from './telegramBot.js';
async function broadcastBookingToMax(booking) {
    const subscribers = await getActiveSubscribers();
    if (subscribers.length === 0)
        return;
    const text = formatBookingMessage(booking);
    console.log(`[max] sending booking #${booking.id} to ${subscribers.length} subscribers, text length=${text.length}`);
    const results = await Promise.allSettled(subscribers.map((s) => sendMessage(s.userId, text)));
    let successCount = 0;
    for (let i = 0; i < results.length; i++) {
        const sub = subscribers[i];
        const r = results[i];
        if (r.status === 'fulfilled') {
            if (r.value.ok) {
                successCount++;
            }
            else {
                console.error(`[max] send to user ${sub.userId} failed: ${r.value.error}`);
                // MAX возвращает chat.not.found, если пользователь удалил чат с ботом
                // или никогда его не открывал (например, фантомный user_id из тестов).
                // Деактивируем подписчика, чтобы не спамить ошибками.
                if (/chat\.not\.found/i.test(r.value.error ?? '')) {
                    console.log(`[max] deactivating subscriber ${sub.userId} (chat not found)`);
                    await unsubscribeUser(sub.userId);
                }
            }
        }
        else {
            console.error(`[max] send to user ${sub.userId} rejected: ${r.reason}`);
        }
    }
    console.log(`[max] notified ${successCount}/${subscribers.length} subscribers about booking #${booking.id}`);
}
export async function notifyNewBooking(booking) {
    const payload = JSON.stringify(booking);
    await db.insert(notifications).values({
        type: 'new_booking',
        bookingId: booking.id,
        payload,
    });
    console.log(`[BOOKING #${booking.id}] New: ${booking.guestName} ${booking.phone} ${booking.checkInDate}→${booking.checkOutDate}, ${booking.nights} ноч., ₽${booking.totalPrice}`);
    // Рассылка подписчикам MAX — не блокирует основной флоу и не пробрасывает ошибки.
    try {
        await broadcastBookingToMax(booking);
    }
    catch (err) {
        console.error('[max] broadcast failed', err);
    }
    // Рассылка в Telegram (фиксированные chat_id из env) — независимый канал,
    // падение не валит MAX и не валит бронь.
    try {
        await broadcastBookingToTelegram(booking);
    }
    catch (err) {
        console.error('[tg] broadcast failed', err);
    }
}
async function broadcastBookingToTelegram(booking) {
    if (!isTelegramEnabled())
        return;
    const chatIds = getTelegramChatIds();
    if (chatIds.length === 0)
        return;
    const text = formatBookingMessage(booking);
    console.log(`[tg] sending booking #${booking.id} to ${chatIds.length} recipients, text length=${text.length}`);
    const results = await Promise.allSettled(chatIds.map((id) => sendTelegramMessage(id, text)));
    let successCount = 0;
    for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status === 'fulfilled') {
            if (r.value.ok) {
                successCount++;
            }
            else {
                console.error(`[tg] send to chat ${chatIds[i]} failed: ${r.value.error}`);
            }
        }
        else {
            console.error(`[tg] send to chat ${chatIds[i]} rejected: ${r.reason}`);
        }
    }
    console.log(`[tg] notified ${successCount}/${chatIds.length} recipients about booking #${booking.id}`);
}
