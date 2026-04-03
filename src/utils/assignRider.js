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

const pendingOffers = new Map();

export function resolveOffer(orderId, riderId, accepted) {
  const offer = pendingOffers.get(orderId);
  if (!offer || offer.riderId !== riderId) return false;
  clearTimeout(offer.timeoutId);
  pendingOffers.delete(orderId);
  offer.resolve(accepted);
  return true;
}

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

🛍️ <b>Products:</b>
${order.orderItems?.map(i => `  • ${i.brandName ? i.brandName + " — " : ""}${i.name}${i.size ? ` (${i.size})` : ""} ×${i.quantity} = ৳${i.totalPrice}`).join("\n") || "—"}

🚚 <b>Delivery Charge:</b> ৳${order.deliveryChargeInside ?? order.deliveryChargeOutside ?? 0}
⚙️ <b>Platform Charge:</b> ৳${order.platformCharge ?? 0}
💰 <b>Total:</b> ৳${order.subtotal}
💳 <b>Payment:</b> ${order.paymentMethod || "COD"}

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

export async function autoAssignRider(prisma, order, sendTelegramMessage) {
  const { customerLat, customerLng } = order;

  console.log("🔍 autoAssignRider called", { orderId: order.id, customerLat, customerLng });

  if (!customerLat || !customerLng) {
    console.log("❌ customerLat/customerLng নেই");
    return null;
  }

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
      order: {
        where: {
          status: { notIn: ["DELIVERED", "CANCELED"] },
          isDeleted: false,
        },
        select: { id: true },
        take: 1,
      },
    },
  });

  console.log("👥 Riders found:", allRiders.length);
  allRiders.forEach(r => {
    console.log(`  - ${r.name} | online: ${r.RiderLocation?.isOnline} | activeOrders: ${r.order.length} | telegramId: ${r.telegramChatId}`);
  });

  const sorted = allRiders
    .filter((r) => r.RiderLocation?.isOnline && r.order.length === 0)
    .map((r) => ({
      ...r,
      distance: getDistanceKm(
        customerLat, customerLng,
        r.RiderLocation.lat, r.RiderLocation.lng
      ),
    }))
    .sort((a, b) => a.distance - b.distance);

  console.log("✅ Available online riders:", sorted.length);

  if (!sorted.length) {
    console.log("⚠️ কোনো available rider নেই");
    await notifyAdmin(order, sendTelegramMessage);
    return null;
  }

  for (const rider of sorted) {
    console.log(`📨 Offer পাঠাচ্ছি: ${rider.name} (${rider.distance.toFixed(2)} km)`);

    if (!rider.telegramChatId) {
      console.log(`❌ ${rider.name} এর telegramChatId নেই — skip`);
      continue;
    }

    // ✅ Race condition check
    const activeNow = await prisma.order.count({
      where: {
        deliveryManId: rider.id,
        status: { notIn: ["DELIVERED", "CANCELED"] },
        isDeleted: false,
      },
    });

    if (activeNow > 0) {
      console.log(`⚠️ ${rider.name} busy — skip`);
      continue;
    }

    // ✅ Order এখনো unassigned কিনা check করো
    const freshOrder = await prisma.order.findUnique({
      where: { id: order.id },
      select: { deliveryManId: true },
    });

    if (freshOrder?.deliveryManId) {
      console.log(`✅ Order ইতিমধ্যে assign হয়ে গেছে — stop`);
      return null;
    }

    // ✅ Offer পাঠাও — assign হবে webhook এ
    const accepted = await sendOffer(
      rider.telegramChatId, order.id, rider, order, sendTelegramMessage
    );

    if (!accepted) {
      console.log(`❌ ${rider.name} reject/timeout`);

      // ✅ Timeout এর পরেও webhook এ assign হয়েছে কিনা check করো
      const checkOrder = await prisma.order.findUnique({
        where: { id: order.id },
        select: { deliveryManId: true },
      });

      if (checkOrder?.deliveryManId) {
        console.log(`✅ Webhook এ assign হয়ে গেছে — stop`);
        return null;
      }

      await sendTelegramMessage(
        rider.telegramChatId,
        `⏰ Order #${order.invoiceNumber} অন্য rider কে দেওয়া হয়েছে।`
      );
      continue;
    }

    // ✅ accepted = true মানে webhook এ assign হয়ে গেছে
    console.log(`✅ ${rider.name} accept করেছে`);
    return rider;
  }

  // ✅ সবাই reject/timeout — assign হয়েছে কিনা final check
  const finalCheck = await prisma.order.findUnique({
    where: { id: order.id },
    select: { deliveryManId: true },
  });

  if (!finalCheck?.deliveryManId) {
    console.log("⚠️ সবাই reject করেছে — admin notify");
    await notifyAdmin(order, sendTelegramMessage);
  }

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