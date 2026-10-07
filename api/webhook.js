// api/webhook.js - Vercel Serverless Function (Failover Telegram Bot Webhook)
const admin = require('firebase-admin');
const { Telegraf, Markup } = require('telegraf');

// 1. تهيئة Firebase Admin بشكل متوافق مع بيئة Serverless
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
        serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf8'));
    } catch (e) {
        try {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        } catch (e2) {}
    }
} else if (process.env.SERVICE_ACCOUNT_KEY) {
    try {
        serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);
    } catch (e) {
        try {
            serviceAccount = JSON.parse(Buffer.from(process.env.SERVICE_ACCOUNT_KEY, 'base64').toString('utf8'));
        } catch (e2) {}
    }
}

if (!admin.apps.length) {
    if (serviceAccount) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } else {
        admin.initializeApp();
    }
}

const db = admin.firestore();
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const DEFAULT_STORE_URL = process.env.STORE_URL || 'https://privatespicy.web.app';

const bot = BOT_TOKEN ? new Telegraf(BOT_TOKEN) : null;

// معالجة pre_checkout_query فوراً لمنع تعليق واجهة النجوم
bot.on('pre_checkout_query', async (ctx) => {
    const queryId = ctx.preCheckoutQuery?.id;
    console.log(`⚡ [Vercel] pre_checkout_query from ${ctx.preCheckoutQuery?.from?.id}`);
    try {
        await ctx.answerPreCheckoutQuery(true);
    } catch (e) {
        console.error('❌ [Vercel] pre_checkout_query error:', e.message);
        try {
            await bot.telegram.answerPreCheckoutQuery(queryId, true);
        } catch (e2) {}
    }
});

// معالجة successful_payment مع حماية ذرية عبر Firestore Transactions
bot.on('successful_payment', async (ctx) => {
    const payment = ctx.message?.successful_payment;
    if (!payment) return;

    const rawPayload = payment.invoice_payload || '';
    const starsAmount = payment.total_amount;
    const fromUser = ctx.from;
    const telegramChargeId = payment.telegram_payment_charge_id;

    console.log(`💳 [Vercel] successful_payment: user=${fromUser?.id}, charge=${telegramChargeId}, amount=${starsAmount}`);

    const firstSep = rawPayload.indexOf('_');
    const rest1 = rawPayload.substring(firstSep + 1);
    const secondSep = rest1.indexOf('_');
    const rest2 = rest1.substring(secondSep + 1);
    const thirdSep = rest2.indexOf('_');

    const type = rawPayload.substring(0, firstSep);
    const userId = rest1.substring(0, secondSep);
    const amount = parseInt(rest2.substring(0, thirdSep));
    const docId = thirdSep >= 0 ? rest2.substring(thirdSep + 1) : '';

    try {
        let isAlreadyProcessed = false;
        let celebName = 'محتوى حصري';
        let fileLink = '';

        await db.runTransaction(async (transaction) => {
            const chargeRef = db.collection('processed_payments').doc(telegramChargeId);
            const chargeDoc = await transaction.get(chargeRef);

            if (chargeDoc.exists) {
                console.log(`⚠️ [Vercel] الدفعة ${telegramChargeId} تم تنفيذها مسبقاً.`);
                isAlreadyProcessed = true;
                return;
            }

            // حجز الدفعة
            transaction.set(chargeRef, {
                user_id: userId,
                amount: starsAmount,
                payload: rawPayload,
                server: 'vercel_failover',
                processed_at: admin.firestore.FieldValue.serverTimestamp()
            });

            if (type === 'recharge') {
                if (!userId || !amount || amount <= 0) return;
                const userRef = db.collection('users').doc(userId);
                transaction.set(userRef, {
                    balance: admin.firestore.FieldValue.increment(amount),
                    last_recharge: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });

                if (docId) {
                    const rechargeRef = db.collection('stars_recharge').doc(docId);
                    transaction.update(rechargeRef, {
                        status: 'completed',
                        stars_charged: amount,
                        telegram_charge_id: telegramChargeId,
                        completed_at: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            } else if (type === 'purchase') {
                if (docId) {
                    const purchaseRef = db.collection('stars_purchase').doc(docId);
                    const purchaseDoc = await transaction.get(purchaseRef);
                    if (purchaseDoc.exists) {
                        const pd = purchaseDoc.data();
                        celebName = pd?.celebrity_name || celebName;
                        const celebId = pd?.celebrity_id || '';
                        if (celebId) {
                            const celebRef = db.collection('celebrities').doc(celebId);
                            const celebDoc = await transaction.get(celebRef);
                            if (celebDoc.exists) {
                                fileLink = celebDoc.data()?.file_link || '';
                            }
                        }
                    }
                    transaction.update(purchaseRef, {
                        status: 'completed',
                        telegram_charge_id: telegramChargeId,
                        completed_at: admin.firestore.FieldValue.serverTimestamp()
                    });
                }

                const priceInUsd = parseFloat((amount / 50).toFixed(2));
                const orderRef = db.collection('orders').doc();
                transaction.set(orderRef, {
                    user_id: userId,
                    user_name: fromUser?.first_name || 'يوزر',
                    celebrity_name: celebName,
                    file_link: fileLink || '',
                    price: priceInUsd,
                    stars_paid: amount,
                    telegram_charge_id: telegramChargeId,
                    status: 'approved',
                    created_at: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        });

        if (isAlreadyProcessed) return;

        if (type === 'recharge') {
            await ctx.reply(`✅ تم شحن ${amount} نجمة لرصيدك بنجاح! 🎉\n⭐ رصيدك الجديد محدَّث في المتجر.`).catch(() => {});
            bot.telegram.sendMessage(
                ADMIN_ID,
                `💰 [Vercel Failover] شحن نجوم ناجح!\n👤 ${fromUser?.first_name || 'يوزر'} (ID: ${fromUser?.id})\n💎 ${amount} نجمة\n🆔 charge: ${telegramChargeId}`
            ).catch(() => {});
        } else if (type === 'purchase') {
            if (fileLink) {
                await ctx.reply(`✅ تم شراء محتوى (${celebName}) بنجاح!\n\n🔗 رابطك الخاص:\n${fileLink}`).catch(() => {});
            } else {
                await ctx.reply(`✅ تم شراء (${celebName}) بنجاح!\nسيتم تسليمك المحتوى من الإدارة قريباً.`).catch(() => {});
            }
            bot.telegram.sendMessage(
                ADMIN_ID,
                `🎬 [Vercel Failover] شراء محتوى ناجح!\n👤 ${fromUser?.first_name || 'يوزر'} (ID: ${fromUser?.id})\n🌟 ${celebName}\n💎 ${amount} نجمة\n🆔 charge: ${telegramChargeId}`
            ).catch(() => {});
        }
    } catch (err) {
        console.error('❌ [Vercel] successful_payment transaction error:', err.message);
    }
});

// أوامر البوت الأساسية
bot.start(async (ctx) => {
    const user = ctx.from;
    const userId = user.id.toString();

    try {
        await db.collection('users').doc(userId).set({
            id: userId,
            name: user.first_name || 'مشترك',
            username: user.username || '',
            last_seen: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (e) {}

    try {
        await ctx.setChatMenuButton({
            type: 'web_app',
            text: 'Open-فتح',
            web_app: { url: DEFAULT_STORE_URL }
        }).catch(() => {});
    } catch (e) {}

    const welcomeText = `👑 <b>مرحباً بك في عالم VIP EXCLUSIVE الحصري</b> 👑\n━━━━━━━━━━━━━━━━━━━━\n🛍️ <b>اضغط على الزر بالأسفل لفتح المتجر واستعراض البكجات:</b>`;
    return ctx.replyWithHTML(welcomeText, Markup.inlineKeyboard([
        [Markup.button.webApp('🛍️ تصفح المتجر والحزم الحصرية', DEFAULT_STORE_URL)]
    ]));
});

// تصدير المعالج لـ Vercel Serverless
module.exports = async (req, res) => {
    if (req.method === 'GET') {
        return res.status(200).json({
            status: 'online',
            service: 'VIP Telegram Bot Failover Webhook',
            runtime: 'Vercel Serverless'
        });
    }

    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        const update = req.body;
        if (bot && update) {
            await bot.handleUpdate(update);
        }
    } catch (err) {
        console.error('❌ [Vercel Handler Error]:', err.message);
    }

    // الرد الفوري 200 لتيليجرام
    return res.status(200).json({ ok: true });
};
