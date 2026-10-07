const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const { Telegraf, Markup } = require("telegraf");

// ─── إعداد Firebase ───────────────────────────────────────────────────────────
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// ─── إعداد البوت ──────────────────────────────────────────────────────────────
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID  = process.env.ADMIN_ID;
const DEFAULT_STORE_URL = process.env.STORE_URL || "";

const bot = BOT_TOKEN ? new Telegraf(BOT_TOKEN) : null;

// دالة مساعدة لترميز HTML بأمان
function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// جلب الإعدادات العامة من Firestore
async function getGlobalSettings() {
    try {
        const doc = await db.collection('settings').doc('global').get();
        if (doc.exists) {
            const data = doc.data();
            return {
                starPrice: data.star_price > 0 ? data.star_price : 50,
                storeUrl: data.store_url?.trim() || DEFAULT_STORE_URL
            };
        }
    } catch (e) {}
    return { starPrice: 50, storeUrl: DEFAULT_STORE_URL };
}

// معالجة الأخطاء لتفادي توقف البوت
bot.catch((err, ctx) => {
    console.error(`⚠️ Telegraf Error (${ctx?.updateType || 'unknown'}):`, err.message);
});

// ══════════════════════════════════════════════════════════════════════════════
// أوامر البوت
// ══════════════════════════════════════════════════════════════════════════════
bot.start(async (ctx) => {
    const user = ctx.from;
    const name = user.first_name + (user.last_name ? " " + user.last_name : "");
    const { storeUrl } = await getGlobalSettings();

    bot.telegram.sendMessage(
        ADMIN_ID,
        `🔔 مستخدم جديد دخل البوت!\n👤 الاسم: ${name}\n🔗 اليوزر: ${user.username ? "@" + user.username : "لا يوجد"}\n🆔 الآيدي: ${user.id}`
    ).catch(() => {});

    await db.collection("users").doc(user.id.toString()).set({
        name: user.first_name,
        username: user.username || "",
        last_seen: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    const welcomeText = 
`👑 <b>مرحباً بك في عالم VIP EXCLUSIVE الحصري</b> 👑
━━━━━━━━━━━━━━━━━━━━

🌟 وجهتك الأولى لمحتوى وسنابات المشاهير الحصرية بجودة فائقة 4K.
💎 عند شرائك أي بكج تحصل على كافة التحديثات والإضافات الجديدة مجاناً داخل نفس البكج!

━━━━━━━━━━━━━━━━━━━━
🛍️ <b>اضغط على الزر بالأسفل لفتح المتجر واستعراض البكجات المتاحة:</b>`;

    ctx.replyWithHTML(
        welcomeText,
        Markup.inlineKeyboard([
            [Markup.button.webApp("🛍️ فتح المتجر واستعراض البكجات", storeUrl)]
        ])
    );
});

bot.on("pre_checkout_query", (ctx) => ctx.answerPreCheckoutQuery(true));

bot.on("successful_payment", async (ctx) => {
    const payload = ctx.message.successful_payment.invoice_payload;
    const { starPrice } = await getGlobalSettings();

    if (payload.startsWith("recharge_")) {
        const [, userId, amount, docId] = payload.split("_");
        await db.collection("users").doc(userId).set(
            { balance: admin.firestore.FieldValue.increment(parseInt(amount)) },
            { merge: true }
        );
        await db.collection("stars_recharge").doc(docId).update({ status: "completed" });
        ctx.reply(`✅ تم شحن ${amount} نجمة لرصيدك بنجاح!`);
        bot.telegram.sendMessage(ADMIN_ID,
            `💰 شحن ناجح!\n👤 ${ctx.from.first_name}\n💎 ${amount} نجمة`
        ).catch(() => {});

    } else if (payload.startsWith("purchase_")) {
        const [, userId, amount, docId] = payload.split("_");
        await db.collection("stars_purchase").doc(docId).update({ status: "completed" });
        const purchaseDoc = await db.collection("stars_purchase").doc(docId).get();
        const celebName = purchaseDoc.data()?.celebrity_name || '';
        const celebId   = purchaseDoc.data()?.celebrity_id || '';

        let fileLink = "";
        if (celebId) {
            const celebDoc = await db.collection("celebrities").doc(celebId).get();
            if (celebDoc.exists) fileLink = celebDoc.data().file_link || "";
        }

        await db.collection("orders").add({
            user_id: userId,
            user_name: ctx.from.first_name || "يوزر",
            celebrity_id: celebId,
            celebrity_name: celebName,
            price: parseFloat((parseInt(amount) / starPrice).toFixed(2)),
            status: "approved",
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });

        ctx.reply(fileLink
            ? `✅ تم شراء المحتوى (${celebName}) بنجاح!\n\n🔗 رابط المحتوى:\n${fileLink}`
            : `✅ تم شراء المحتوى (${celebName}) بنجاح!\nسيتم تسليمك المحتوى من الإدارة قريباً.`
        );
        bot.telegram.sendMessage(ADMIN_ID,
            `🎬 شراء ناجح!\n👤 ${ctx.from.first_name}\n🌟 ${celebName}\n💎 ${amount} نجمة`
        ).catch(() => {});
    }
});

bot.on("message", (ctx) => {
    if (!ctx.message.successful_payment) {
        ctx.reply("للتصفح والشراء، يرجى فتح المتجر عبر /start.");
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// 1. WEBHOOK — استقبال رسائل Telegram (HTTP Function)
// ══════════════════════════════════════════════════════════════════════════════
exports.telegramBotWebhook = onRequest(
    { region: "us-central1", timeoutSeconds: 60 },
    (req, res) => {
        bot.handleUpdate(req.body, res);
    }
);

// ══════════════════════════════════════════════════════════════════════════════
// 2. FIRESTORE TRIGGERS
// ══════════════════════════════════════════════════════════════════════════════

// --- منشور جديد أو محدَّث → إشعار ونشر فوري لجميع المستخدمين ---
exports.onNewCelebrity = onDocumentWritten(
    { document: "celebrities/{docId}", region: "us-central1", timeoutSeconds: 540, memory: "512MiB" },
    async (event) => {
        const after = event.data?.after?.data();
        if (!after || !after.notify) return null;

        // إلغاء تفعيل notify فوراً لمنع التكرار
        await event.data.after.ref.update({ notify: false });

        const usersSnap = await db.collection("users").get();
        const { starPrice: STAR_PRICE_RATE, storeUrl } = await getGlobalSettings();
        
        const celebName = after.name || 'محتوى حصري';
        const priceUsd = after.price_usd || 0;
        const starPrice = Math.round(priceUsd * STAR_PRICE_RATE);

        const captionHtml = 
`💎 <b>المحتوى الحصري:</b> <b>${escapeHtml(celebName)}</b>
📦 <b>الباقة:</b> بكج المحتوى الحصري الكامل VIP

💰 <b>سعر البكج:</b> <b>${priceUsd}$</b> (أو <b>${starPrice}</b> نجمة ⭐️)

💎 <b>ميزة البكج الخاصة:</b>
عند شراء البكج ستحصل على أي تحديث أو محتوى جديد مجاناً ومباشرةً داخل نفس البكج مدى الحياة! 🔥

━━━━━━━━━━━━━━━━━━━━
👇 <b>اضغط على الزر بالأسفل لفتح المتجر واستلام البكج:</b>`;

        const replyMarkup = {
            inline_keyboard: [
                [{ text: "🛍️ فتح المتجر وشراء البكج", web_app: { url: storeUrl } }]
            ]
        };

        // تجهيز الصورة واستخراج file_id
        let fileId = null;
        let photoPayload = null;

        if (after.image_url) {
            if (after.image_url.startsWith('data:image')) {
                const base64Data = after.image_url.split(',')[1];
                if (base64Data) photoPayload = { source: Buffer.from(base64Data, 'base64') };
            } else {
                photoPayload = after.image_url;
            }

            if (photoPayload) {
                try {
                    const adminSent = await bot.telegram.sendPhoto(ADMIN_ID, photoPayload, {
                        caption: captionHtml,
                        parse_mode: "HTML",
                        reply_markup: replyMarkup
                    });
                    if (adminSent && adminSent.photo && adminSent.photo.length > 0) {
                        fileId = adminSent.photo[adminSent.photo.length - 1].file_id;
                    }
                } catch (adminErr) {
                    console.error("Error sending initial photo to admin:", adminErr.message);
                }
            }
        }

        const userDocs = usersSnap.docs;
        let sent = 0, failed = 0, blocked = 0;

        for (let i = 0; i < userDocs.length; i++) {
            const userDoc = userDocs[i];
            const userId = userDoc.id;
            if (userId === ADMIN_ID && fileId) {
                sent++;
                continue;
            }

            try {
                if (fileId) {
                    await bot.telegram.sendPhoto(userId, fileId, {
                        caption: captionHtml,
                        parse_mode: "HTML",
                        reply_markup: replyMarkup
                    });
                } else {
                    await bot.telegram.sendMessage(userId, captionHtml, {
                        parse_mode: "HTML",
                        reply_markup: replyMarkup
                    });
                }
                sent++;
            } catch (err) {
                const errMsg = err.message || '';
                if (err.response && err.response.error_code === 429) {
                    const retryAfter = (err.response.parameters && err.response.parameters.retry_after) || 2;
                    await sleep((retryAfter + 1) * 1000);
                    i--; // إعادة المحاولة لنفس المستخدم
                    continue;
                }
                if (errMsg.includes('blocked') || errMsg.includes('deactivated') || errMsg.includes('chat not found')) {
                    blocked++;
                } else {
                    failed++;
                }
            }

            await sleep(35);
        }

        return bot.telegram.sendMessage(ADMIN_ID,
            `📢 <b>تقرير نشر المحتوى الجديد: (${escapeHtml(celebName)})</b>\n\n✅ تم الإرسال بنجاح إلى: <b>${sent}</b> مشترك\n🚫 حسابات محظورة/غير مفعلة: <b>${blocked}</b>\n❌ تعذر مع: <b>${failed}</b>`,
            { parse_mode: "HTML" }
        ).catch(() => {});
    }
);

// --- طلب شحن بالنجوم → إرسال فاتورة ---
exports.onStarsRecharge = onDocumentCreated(
    { document: "stars_recharge/{docId}", region: "us-central1" },
    async (event) => {
        const data = event.data.data();
        if (data.status !== "pending") return null;

        const { user_id: userId, amount } = data;
        try {
            await bot.telegram.sendInvoice(userId, {
                title: "شحن نجوم المتجر",
                description: `شحن عدد ${amount} نجمة لرصيدك`,
                payload: `recharge_${userId}_${amount}_${event.params.docId}`,
                provider_token: "",
                currency: "XTR",
                prices: [{ label: "Stars", amount: parseInt(amount) }]
            });
            await event.data.ref.update({ status: "sent" });
        } catch (err) {
            await event.data.ref.update({ status: "failed", error: err.message });
        }
        return null;
    }
);

// --- طلب شراء محتوى بالنجوم → إرسال فاتورة ---
exports.onStarsPurchase = onDocumentCreated(
    { document: "stars_purchase/{docId}", region: "us-central1" },
    async (event) => {
        const data = event.data.data();
        if (data.status !== "pending") return null;

        const { user_id: userId, amount, celebrity_name: celebName } = data;
        try {
            await bot.telegram.sendInvoice(userId, {
                title: "شراء محتوى حصري",
                description: `محتوى: ${celebName}`,
                payload: `purchase_${userId}_${amount}_${event.params.docId}`,
                provider_token: "",
                currency: "XTR",
                prices: [{ label: "Stars", amount: parseInt(amount) }]
            });
            await event.data.ref.update({ status: "sent" });
        } catch (err) {
            await event.data.ref.update({ status: "failed", error: err.message });
        }
        return null;
    }
);

// --- إشعار للمستخدم من لوحة التحكم ---
exports.onBotNotification = onDocumentCreated(
    { document: "bot_notifications/{docId}", region: "us-central1" },
    async (event) => {
        const { user_id: userId, message, status } = event.data.data();
        if (status !== "pending" || !userId || !message) return null;

        try {
            await bot.telegram.sendMessage(userId, message);
            await event.data.ref.update({ status: "sent" });
        } catch (e) {
            await event.data.ref.update({ status: "failed", error: e.message });
        }
        return null;
    }
);

// --- إشعار الأدمن بطلبات الشحن اليدوية ---
exports.onCodeRecharge = onDocumentCreated(
    { document: "code_recharges/{docId}", region: "us-central1" },
    async (event) => {
        const data = event.data.data();
        if (data.status !== "pending") return null;
        const msg = `🚨 طلب تعبئة رصيد جديد!\n👤 العميل: ${data.user_name}\n💳 الوسيلة: ${data.payment_method || "كود شحن"}\n🎫 الكود/الإثبات: ${data.code}\n💰 المطلوب: ${data.expected_amount || "غير محدد"}$`;
        try {
            await bot.telegram.sendMessage(ADMIN_ID, msg);
            await event.data.ref.update({ notified_admin: true });
        } catch (e) {}
        return null;
    }
);
