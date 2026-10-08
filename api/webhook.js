// api/webhook.js - Vercel Serverless Function (Telegram Bot Webhook)
const admin = require('firebase-admin');
const { Telegraf, Markup } = require('telegraf');

// 1. تهيئة Firebase Admin بشكل متوافق مع Vercel و Node.js
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

if (!serviceAccount) {
    const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY || `-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDLZjqGTAB29BhO\n1JD9ep6K4uqQJtj80hZrWnVfS8sF42N0KYKVUW86nSFhIAa2fw8GPaqbk3IXNCfD\nQpEqEziKMZSeqMImiHidsaWIkhDuy9B0FNlVsUbwmIM7Y6EOiWrPWgNrxaiZepBJ\nhxCwUToyMOpEfsawCoYCwRblJKAV3UOsNsLMGTfY1k2SX65W1xDAwth6jujLEGfX\nh33DANsKYbeQ5mzVfq6wCBIopbMdeBmfHfLrVEoQBFcQ/W8au6WIuJquasPGK6ve\nvHg1aU3RqQhPgjG12gj3MPsnY/n83CV9Evd6JA7DUSrGn7uNyVogqGhyG5iR58oR\nbcn0qQVPAgMBAAECggEAIK26rBD8kiAC4nIXHrfbTl0ev9eTTStDxtkFuoXRhzn9\nTzsha8lloXkqqmbG1/3vSrAQVRE0vLL4dc/1cAPJNbVkN17NsqXXxcjg24xRhCGN\ndYOpV1yKv+UA+0MKgUIQEw2sjF15X7noAf2H74wIBEBaTcmV39ARBShDUWq3qEtW\n5PbPkI4VZhptQ30wwGnS3kSIdk8UhrMr8pLjyxGdppmggwmSuyUltEwt8347vWWT\nOCjH0xp7pmAaAOBYa+KHgaEN6vQnGiZgXa7eqG+pvPUyckmJrr5IZz5Vsp1vQqY/\nNakqo+BYsCHN+7UKmey60G9szhl9PbAmMBM/a3lyIQKBgQDyhS1n4Q0pzI0dixP5\nPmPuyd2dU24GETIjkl5SqI8pA17+6RGHVf7SDOLiZsO8pOvnSL7BfuyxHpnOkFJ8\nM+fJGM2dermCWOecfB1XeSzDTTbt6izqgyu7nFrm0hXU2mFB5h4Ty1I4JoAm/l0o\n54HjZjbfZh3IyxUJxsoXvYWQXQKBgQDWtGZQuNt6gxFAKH8M+PE4p4UUYJ2XWERR\nKYl82D76JppLS67kily7stJnGg2uF4XcOiLlqrg3oztCbMVvSBKiy5Sj5FEWjCf1\nORTDIXv+bULBfM2950+yVIuonp89emRIBVxsVEUqZlwIrEZwcSGEejPhN6qtVkTM\naQMUkX9BmwKBgQDEiLSROEook4HQbULUe4EUpDaaJmBFPm45cYZKyhqqC/dR8KKp\n4EDPDG5ZNxpsp+Ic3lDoEenSZ5ARW9fcm1u9FgKbGjd3sICRyeslVie2Zb6b82hO\n69nnAgCQibPzeL3UX54EQILyyhCUiRIJ8gLKu6zAQcrlS95Su+xObOHuaQKBgQCR\nMIEYCUnyOPvLZRc1kIqfAzmNJCCtnbTlJa+hyyIbS0t/q3hjd+Vp0G1T51xk4+dT\nm8TJhn74sNt7+c4xiI2BpSWpBtaG5tSGkckmg1g0H3LLITiIOQm90Ep5Bnssub1i\nrq1nXD1BhOKrwsQHeZlu2qyGmnxCp1ny2PiKSjHCDQKBgQCP+l4yVwOTQEKDeYXm\npkf5/upxqHMsvpFLEepEAS5gTENcHsY2Ccto9FBqubicEkS23cfLlYKKfzNaLtlR\nbOXmZFZplvpw0d3hyxjd0j0M8e0lIgo17QDJkR1zKsQf9jwX3mN//7ctVRNWkRCV\nV8JBBBLiLfCyBIWtaj7k5wM/gw==\n-----END PRIVATE KEY-----\n`;

    serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID || "privatespicy",
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "firebase-adminsdk-fbsvc@privatespicy.iam.gserviceaccount.com",
        privateKey: rawPrivateKey.replace(/\\n/g, '\n')
    };
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const DEFAULT_STORE_URL = process.env.STORE_URL || 'https://privatespicy.web.app';

const bot = BOT_TOKEN ? new Telegraf(BOT_TOKEN) : null;

if (bot) {
    bot.catch((err, ctx) => {
        console.error(`⚠️ [Vercel Bot Error] (${ctx?.updateType || 'unknown'}):`, err.message);
    });

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

                transaction.set(chargeRef, {
                    user_id: userId,
                    amount: starsAmount,
                    payload: rawPayload,
                    server: 'vercel_webhook',
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
                if (ADMIN_ID) {
                    bot.telegram.sendMessage(
                        ADMIN_ID,
                        `💰 [Vercel] شحن نجوم ناجح!\n👤 ${fromUser?.first_name || 'يوزر'} (ID: ${fromUser?.id})\n💎 ${amount} نجمة\n🆔 charge: ${telegramChargeId}`
                    ).catch(() => {});
                }
            } else if (type === 'purchase') {
                if (fileLink) {
                    await ctx.reply(`✅ تم شراء محتوى (${celebName}) بنجاح!\n\n🔗 رابطك الخاص:\n${fileLink}`).catch(() => {});
                } else {
                    await ctx.reply(`✅ تم شراء (${celebName}) بنجاح!\nسيتم تسليمك المحتوى من الإدارة قريباً.`).catch(() => {});
                }
                if (ADMIN_ID) {
                    bot.telegram.sendMessage(
                        ADMIN_ID,
                        `🎬 [Vercel] شراء محتوى ناجح!\n👤 ${fromUser?.first_name || 'يوزر'} (ID: ${fromUser?.id})\n🌟 ${celebName}\n💎 ${amount} نجمة\n🆔 charge: ${telegramChargeId}`
                    ).catch(() => {});
                }
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

    // معالجة الرسائل العامة
    bot.on('message', (ctx) => {
        if (!ctx.message?.successful_payment) {
            ctx.reply('للتصفح والشراء، يرجى فتح المتجر عبر /start.').catch(() => {});
        }
    });
}

// تصدير المعالج لـ Vercel Serverless
module.exports = async (req, res) => {
    // 1. التحقق من توفر توكن البوت
    if (!BOT_TOKEN || !bot) {
        console.error('❌ [Vercel Webhook Error]: BOT_TOKEN variable is missing in Vercel settings!');
        return res.status(500).json({
            ok: false,
            error: 'BOT_TOKEN environment variable is missing on Vercel. Please add BOT_TOKEN in project settings.'
        });
    }

    // 2. طلبات GET: فحص الحالة وتفعيل Webhook التلقائي
    if (req.method === 'GET') {
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const currentWebhookUrl = `${protocol}://${host}/api/webhook`;

        // إمكانية ضبط الويب هوك تلقائياً عند فتح ?setWebhook=true أو /set-webhook
        if (req.query?.setWebhook === 'true' || req.query?.set === '1' || req.url.includes('set-webhook')) {
            try {
                const result = await bot.telegram.setWebhook(currentWebhookUrl);
                console.log(`✅ [Vercel Webhook]: Successfully registered webhook to: ${currentWebhookUrl}`);
                return res.status(200).json({
                    ok: true,
                    status: 'webhook_registered',
                    webhook_url: currentWebhookUrl,
                    telegram_response: result
                });
            } catch (err) {
                console.error('❌ [Vercel Webhook]: Failed to register webhook:', err.message);
                return res.status(500).json({
                    ok: false,
                    error: err.message,
                    target_url: currentWebhookUrl
                });
            }
        }

        // الحصول على معلومات الويب هوك الحالية من تيليجرام
        let webhookInfo = null;
        try {
            webhookInfo = await bot.telegram.getWebhookInfo();
        } catch (e) {}

        return res.status(200).json({
            status: 'online',
            service: 'VIP Telegram Bot Vercel Webhook',
            runtime: 'Vercel Serverless Function',
            current_webhook_url: currentWebhookUrl,
            telegram_webhook_info: webhookInfo,
            setup_instruction: `To set this URL as your Telegram Webhook automatically, visit: ${currentWebhookUrl}?setWebhook=true`
        });
    }

    // 3. طلبات POST: استقبال ومعالجة تحديثات تيليجرام أو إرسال الفواتير
    if (req.method === 'POST') {
        try {
            const body = req.body;
            if (!body || typeof body !== 'object') {
                return res.status(400).json({ error: 'Invalid request body' });
            }

            // إذا كان الطلب لإرسال فاتورة (/send-invoice)
            if (body.action === 'send-invoice' || (body.userId && body.type)) {
                const { type, userId, amount, celebrityName, docId } = body;
                if (type === 'recharge') {
                    await bot.telegram.sendInvoice(userId, {
                        title: 'شحن نجوم المتجر',
                        description: `شحن عدد ${amount} نجمة لرصيدك`,
                        payload: `recharge_${userId}_${amount}_${docId}`,
                        provider_token: '',
                        currency: 'XTR',
                        prices: [{ label: 'Stars', amount: parseInt(amount) }]
                    });
                    if (docId) await db.collection('stars_recharge').doc(docId).update({ status: 'sent' });
                } else if (type === 'purchase') {
                    await bot.telegram.sendInvoice(userId, {
                        title: 'شراء محتوى حصري',
                        description: `محتوى: ${celebrityName}`,
                        payload: `purchase_${userId}_${amount}_${docId}`,
                        provider_token: '',
                        currency: 'XTR',
                        prices: [{ label: 'Stars', amount: parseInt(amount) }]
                    });
                    if (docId) await db.collection('stars_purchase').doc(docId).update({ status: 'sent' });
                }
                return res.status(200).json({ success: true });
            }

            // استقبال وتمرير تحديث Telegram
            console.log(`📩 [Vercel Webhook]: Processing update_id=${body.update_id}`);
            await bot.handleUpdate(body);

            return res.status(200).json({ ok: true });
        } catch (err) {
            console.error('❌ [Vercel Webhook Handler Error]:', err.message);
            return res.status(200).json({ ok: true, error: err.message });
        }
    }

    return res.status(405).send('Method Not Allowed');
};
