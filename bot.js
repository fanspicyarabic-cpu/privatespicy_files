const { Telegraf, Markup } = require("telegraf");
const admin = require("firebase-admin");
const express = require("express");

// ─── إعداد Firebase ───────────────────────────────────────────────────────────
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// ─── إعداد البوت والسيرفر ──────────────────────────────────────────────────────
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const DEFAULT_STORE_URL = process.env.STORE_URL || "";

const bot = BOT_TOKEN ? new Telegraf(BOT_TOKEN) : null;
const app = express();
app.use(express.json());

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
    } catch (e) { }
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
    ).catch(() => { });

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
        ).catch(() => { });

    } else if (payload.startsWith("purchase_")) {
        const [, userId, amount, docId] = payload.split("_");
        await db.collection("stars_purchase").doc(docId).update({ status: "completed" });
        const purchaseDoc = await db.collection("stars_purchase").doc(docId).get();
        const celebName = purchaseDoc.data()?.celebrity_name || '';
        const celebId = purchaseDoc.data()?.celebrity_id || '';

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
        ).catch(() => { });
    }
});

bot.on("message", (ctx) => {
    if (!ctx.message.successful_payment) {
        ctx.reply("للتصفح والشراء، يرجى فتح المتجر عبر /start.");
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// معالجة الفواتير وإرسالها فورياً عبر Render (بدون الحاجة لـ Triggers معطلة)
// ══════════════════════════════════════════════════════════════════════════════
app.post("/send-invoice", async (req, res) => {
    try {
        const { type, userId, amount, celebrityName, docId } = req.body;

        if (type === "recharge") {
            await bot.telegram.sendInvoice(userId, {
                title: "شحن نجوم المتجر",
                description: `شحن عدد ${amount} نجمة لرصيدك`,
                payload: `recharge_${userId}_${amount}_${docId}`,
                provider_token: "",
                currency: "XTR",
                prices: [{ label: "Stars", amount: parseInt(amount) }]
            });
            await db.collection("stars_recharge").doc(docId).update({ status: "sent" });
        } else if (type === "purchase") {
            await bot.telegram.sendInvoice(userId, {
                title: "شراء محتوى حصري",
                description: `محتوى: ${celebrityName}`,
                payload: `purchase_${userId}_${amount}_${docId}`,
                provider_token: "",
                currency: "XTR",
                prices: [{ label: "Stars", amount: parseInt(amount) }]
            });
            await db.collection("stars_purchase").doc(docId).update({ status: "sent" });
        }

        res.status(200).send({ success: true });
    } catch (err) {
        res.status(500).send({ success: false, error: err.message });
    }
});

// إعداد Webhook لتيليجرام على سيرفر Express
app.use(bot.webhookCallback("/telegram-webhook"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    // يمكنك ربط الـ Webhook تلقائياً هنا إذا رغبت، أو ضبطه عبر BotFather
});