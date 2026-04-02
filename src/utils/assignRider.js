export function getDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Pending offers tracker ───────────────────────────────
// { orderId: { riderId, timeoutId, resolve } }
const pendingOffers = new Map();

// Webhook থেকে call হবে — rider accept/reject করলে
export function resolveOffer(orderId, riderId, accepted) {
  const offer = pendingOffers.get(orderId);
  if (!offer || offer.riderId !== riderId) return false;
  clearTimeout(offer.timeoutId);
  pendingOffers.delete(orderId);
  offer.resolve(accepted);
  return true;
}

// ── Offer পাঠাও, response এর জন্য wait করো ─────────────
function sendOffer(telegramChatId, orderId, rider, order, sendTelegramMessage) {
  return new Promise((resolve) => {
    const TIMEOUT_SEC = 45;

    sendTelegramMessage(
      telegramChatId,
`🛵 <b>নতুন Order Offer!</b>

📋 <b>Invoice:</b> #${order.invoiceNumber}
👤 <b>Customer:</b> ${order.customerName}
📞 <b>Phone:</b> ${order.customerPhone}
📍 <b>Address:</b> ${order.customerAddress}, ${order.customerCity}
📏 <b>Distance:</b> ${rider.distance.toFixed(2)} km
⏰ <b>${TIMEOUT_SEC} সেকেন্ডের মধ্যে Accept করুন!</b>`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: "✅ Accept", callback_data: `accept_${orderId}` },
            { text: "❌ Reject", callback_data: `reject_${orderId}` },
          ]],
        },
      }
    );

    const timeoutId = setTimeout(() => {
      pendingOffers.delete(orderId);
      resolve(false);
    }, TIMEOUT_SEC * 1000);

    pendingOffers.set(orderId, { riderId: rider.id, timeoutId, resolve });
  });
}

// ── Main function ────────────────────────────────────────
export async function autoAssignRider(prisma, order, sendTelegramMessage) {
  const { customerLat, customerLng } = order;
  if (!customerLat || !customerLng) return null;

  // ✅ শুধু Online rider যাদের location আছে এবং active order নেই
  const allRiders = await prisma.user.findMany({
    where: {
      roleId: "8b468586-1419-4479-9037-cb355a626085",
      RiderLocation: { isNot: null },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      telegramChatId: true,
      RiderLocation: {
        select: { lat: true, lng: true, isOnline: true },
      },
      orders: {
        where: {
          status: { notIn: ["DELIVERED", "CANCELLED"] },
          isDeleted: false,
        },
        select: { id: true },
        take: 1,
      },
    },
  });

  // ✅ Online + available (active order নেই)
  const sorted = allRiders
    .filter((r) => r.RiderLocation?.isOnline && r.orders.length === 0)
    .map((r) => ({
      ...r,
      distance: getDistanceKm(
        customerLat, customerLng,
        r.RiderLocation.lat, r.RiderLocation.lng
      ),
    }))
    .sort((a, b) => a.distance - b.distance);

  if (!sorted.length) {
    await notifyAdmin(order, sendTelegramMessage);
    return null;
  }

  for (const rider of sorted) {
    if (!rider.telegramChatId) continue;

    // Race condition check
    const activeNow = await prisma.order.count({
      where: {
        deliveryManId: rider.id,
        status: { notIn: ["DELIVERED", "CANCELLED"] },
        isDeleted: false,
      },
    });
    if (activeNow > 0) continue;

    // ✅ Offer পাঠাও
    const accepted = await sendOffer(
      rider.telegramChatId, order.id, rider, order, sendTelegramMessage
    );

    if (!accepted) {
      await sendTelegramMessage(
        rider.telegramChatId,
        `⏰ Order #${order.invoiceNumber} অন্য rider কে দেওয়া হয়েছে।`
      );
      continue;
    }

    // ✅ Assign করো
    await prisma.order.update({
      where: { id: order.id },
      data: { deliveryManId: rider.id, assignedAt: new Date() },
    });

    const bdTime = new Date(Date.now() + 6 * 60 * 60 * 1000)
      .toISOString().replace("T", " ").slice(0, 16);

    await sendTelegramMessage(
      rider.telegramChatId,
`✅ <b>Order Confirmed!</b>

📋 <b>Invoice:</b> #${order.invoiceNumber}
👤 <b>Customer:</b> ${order.customerName}
📞 <b>Phone:</b> <a href="tel:${order.customerPhone}">${order.customerPhone}</a>
📍 <b>Address:</b> ${order.customerAddress}, ${order.customerCity}
📏 <b>Distance:</b> ${rider.distance.toFixed(2)} km
⏰ <b>Assigned:</b> ${bdTime} (BD Time)

👉 <a href="https://admin.i-mall.com.bd/delivery">Dashboard এ যান</a>`
    );

    return rider;
  }

  await notifyAdmin(order, sendTelegramMessage);
  return null;
}

async function notifyAdmin(order, sendTelegramMessage) {
  const ADMIN_ID = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (!ADMIN_ID) return;
  await sendTelegramMessage(ADMIN_ID,
`⚠️ <b>কোনো Rider পাওয়া যায়নি!</b>
📋 Invoice #${order.invoiceNumber}
👤 ${order.customerName} — ${order.customerPhone}
📍 ${order.customerAddress}, ${order.customerCity}
👉 Manual assign করুন।`
  );
}