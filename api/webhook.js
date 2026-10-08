// api/webhook.js - Vercel Serverless Function (Telegram Bot Webhook)
const admin = require('firebase-admin');
const { Telegraf, Markup } = require('telegraf');

// المفتاح الإفتراضي المشفر لبيانات اعتماد Firebase Admin
const DEFAULT_SERVICE_ACCOUNT_B64 = "ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsCiAgInByb2plY3RfaWQiOiAicHJpdmF0ZXNwaWN5IiwKICAicHJpdmF0ZV9rZXlfaWQiOiAiZjM0N2IyYjc1YjhkMDg4NjdjNGYxMzI0OTA2NDkwYzY5NzE0MTk4ZiIsCiAgInByaXZhdGVfa2V5IjogIi0tLS0tQkVHSU4gUFJJVkFURSBLRVktLS0tLVxuTUlJRXZ3SUJBREFOQmdrcWhraUc5dzBCQVFFRkFBU0NCS2t3Z2dTbEFnRUFBb0lCQVFETFpqcUdUQUIyOUJoT1xuMUpEOWVwNks0dXFRSnRqODBoWnJXblZmUzhzRjQyTjBLWUtWVVc4Nm5TRmhJQWEyZnc4R1BhcWJrM0lYTkNmRFxuUXBFcUV6aUtNWlNlcU1JbWlIaWRzYVdJa2hEdXk5QjBGTmxWc1Vid21JTTdZNkVPaVdyUFdnTnJ4YWlaZXBCSlxuaHhDd1VUb3lNT3BFZnNhd0NvWUN3UmJsSktBVjNVT3NOc0xNR1RmWTFrMlNYNjVXMXhEQXd0aDZqdWpMRUdmWFxuaDMzREFOc0tZYmVRNW16VmZxNndDQklvcGJNZGVCbWZIZkxyVkVvUUJGY1EvVzhhdTZXSXVKcXVhc1BHSzZ2ZVxudkhnMWFVM1JxUWhQZ2pHMTJnajNNUHNuWS9uODNDVjlFdmQ2SkE3RFVTckduN3VOeVZvZ3FHaHlHNWlSNThvUlxuYmNuMHFRVlBBZ01CQUFFQ2dnRUFJSzI2ckJEOGtpQUM0bklYSHJmYlRsMGV2OWVUVFN0RHh0a0Z1b1hSaHpuOVxuVHpzaGE4bGxvWGtxcW1iRzEvM3ZTckFRVlJFMHZMTDRkYy8xY0FQSk5iVmtOMTdOc3FYWHhjamcyNHhSaENHTlxuZFlPcFYxeUt2K1VBKzBNS2dVSVFFdzJzakYxNVg3bm9BZjJINzR3SUJFQmFUY21WMzlBUkJTaERVV3EzcUV0V1xuNVBiUGtJNFZaaHB0UTMwd3dHblMza1NJZGs4VWhyTXI4cExqeXhHZHBwbWdnd21TdXlVbHRFd3Q4MzQ3dldXVFxuT0NqSDB4cDdwbUFhQU9CWWErS0hnYUVONnZRbkdpWmdYYTdlcUcrcHZQVXlja21KcnI1SVp6NVZzcDF2UXFZL1xuTmFrcW8rQllzQ0hOKzdVS21leTYwRzlzemhsOVBiQW1NQk0vYTNseUlRS0JnUUR5aFMxbjRRMHB6STBkaXhQNVxuUG1QdXlkMmRVMjRHRVRJamtsNVNxSThwQTE3KzZSR0hWZjdTRE9MaVpzTzhwT3ZuU0w3QmZ1eXhIcG5Pa0ZKOFxuTStmSkdNMmRlcm1DV09lY2ZCMVhlU3pEVFRidDZpenFneXU3bkZybTBoWFUybUZCNWg0VHkxSTRKb0FtL2wwb1xuNTRIalpqYmZaaDNJeXhVSnhzb1h2WVdRWFFLQmdRRFd0R1pRdU50Nmd4RkFLSDhNK1BFNHA0VVVZSjJYV0VSUlxuS1lsODJENzZKcHBMUzY3a2lseTdzdEpuR2cydUY0WGNPaUxscXJnM296dENiTVZ2U0JLaXk1U2o1RkVXakNmMVxuT1JURElYditiVUxCZk0yOTUwK3lWSXVvbnA4OWVtUklCVnhzVkVVcVpsd0lyRVp3Y1NHRWVqUGhONnF0VmtUTVxuYVFNVWtYOUJtd0tCZ1FERWlMU1JPRW9vazRIUWJVTFVlNEVVcERhYUptQkZQbTQ1Y1laS3locXFDL2RSOEtLcFxuNEVEUERHNVpOeHBzcCtJYzNsRG9FZW5TWjVBUlc5ZmNtMXU5RmdLYkdqZDNzSUNSeWVzbFZpZTJaYjZiODJoT1xuNjlubkFnQ1FpYlB6ZUwzVVg1NEVRSUx5eWhDVWlSSUo4Z0xLdTZ6QVFjcmxTOTVTdSt4T2JPSHVhUUtCZ1FDUlxuTUlFWUNVbnlPUHZMWlJjMWtJcWZBem1OSkNDdG5iVGxKYStoeXlJYlMwdC9xM2hqZCtWcDBHMVQ1MXhrNCtkVFxubThUSmhuNzRzTnQ3K2M0eGlJMkJwU1dwQnRhRzV0U0drY2ttZzFnMEgzTExJVGlJT1FtOTBFcDVCbnNzdWIxaVxucnExblhEMUJoT0tyd3NRSGVabHUycXlHbW54Q3AxbnkyUGlLU2pIQ0RRS0JnUUNQK2w0eVZ3T1RRRUtEZVlYbVxucGtmNS91cHhxSE1zdnBGTEVlcEVBUzVnVEVOY0hzWTJDY3RvOUZCcXViaWNFa1MyM2NmTGxZS0tmek5hTHRsUlxuYk9YbVpGWnBsdnB3MGQzaHl4amQwajBNOGUwbElnbzE3UURKa1IxektzUWY5andYM21OLy83Y3RWUk5Xa1JDVlxuVjhKQkJCTGlMZkN5QklXdGFqN2s1d00vZ3c9PVxuLS0tLS1FTkQgUFJJVkFURSBLRVktLS0tLVxuIiwKICAiY2xpZW50X2VtYWlsIjogImZpcmViYXNlLWFkbWluc2RrLWZic3ZjQHByaXZhdGVzcGljeS5pYW0uZ3NlcnZpY2VhY2NvdW50LmNvbSIsCiAgImNsaWVudF9pZCI6ICIxMTMxMTA1MTgwNzYyNDE0MjQyNjMiLAogICJhdXRoX3VyaSI6ICJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20vby9vYXV0aDIvYXV0aCIsCiAgInRva2VuX3VyaSI6ICJodHRwczovL29hdXRoMi5nb29nbGVhcGlzLmNvbS90b2tlbiIsCiAgImF1dGhfcHJvdmlkZXJfeDUwOV9jZXJ0X3VybCI6ICJodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9vYXV0aDIvdjEvY2VydHMiLAogICJjbGllbnRfeDUwOV9jZXJ0X3VybCI6ICJodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9yb2JvdC92MS9tZXRhZGF0YS94NTA5L2ZpcmViYXNlLWFkbWluc2RrLWZic3ZjJTQwcHJpdmF0ZXNwaWN5LmlhbS5nc2VydmljZWFjY291bnQuY29tIiwKICAidW5pdmVyc2VfZG9tYWluIjogImdvb2dsZWFwaXMuY29tIgp9Cg==";

// 1. تهيئة Firebase Admin بشكل آمن ومتوافق مع Vercel Serverless
let serviceAccount;

try {
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
        serviceAccount = JSON.parse(Buffer.from(DEFAULT_SERVICE_ACCOUNT_B64, 'base64').toString('utf8'));
    }

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }
} catch (err) {
    console.error('❌ [Vercel Admin Init Error]:', err.message);
}

let db = null;
try {
    db = admin.firestore();
} catch (e) {
    console.error('❌ [Vercel Firestore Init Error]:', e.message);
}

// تصدير المعالج لـ Vercel Serverless
module.exports = async (req, res) => {
    const BOT_TOKEN = process.env.BOT_TOKEN;
    const ADMIN_ID = process.env.ADMIN_ID;
    const DEFAULT_STORE_URL = process.env.STORE_URL || 'https://privatespicy.web.app';

    // 1. التحقق من توفر توكن البوت
    if (!BOT_TOKEN) {
        console.error('❌ [Vercel Webhook Error]: BOT_TOKEN environment variable is missing in Vercel settings!');
        return res.status(200).json({
            ok: false,
            status: 'missing_bot_token',
            error: 'BOT_TOKEN environment variable is missing on Vercel. Please add BOT_TOKEN in Vercel project settings.'
        });
    }

    let bot = null;
    try {
        bot = new Telegraf(BOT_TOKEN);
    } catch (e) {
        console.error('❌ [Vercel Telegraf Init Error]:', e.message);
        return res.status(200).json({
            ok: false,
            status: 'bot_init_failed',
            error: e.message
        });
    }

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

            if (db) {
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
            }

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

        if (db) {
            try {
                await db.collection('users').doc(userId).set({
                    id: userId,
                    name: user.first_name || 'مشترك',
                    username: user.username || '',
                    last_seen: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            } catch (e) {}
        }

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
                return res.status(200).json({
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
                    if (db && docId) await db.collection('stars_recharge').doc(docId).update({ status: 'sent' });
                } else if (type === 'purchase') {
                    await bot.telegram.sendInvoice(userId, {
                        title: 'شراء محتوى حصري',
                        description: `محتوى: ${celebrityName}`,
                        payload: `purchase_${userId}_${amount}_${docId}`,
                        provider_token: '',
                        currency: 'XTR',
                        prices: [{ label: 'Stars', amount: parseInt(amount) }]
                    });
                    if (db && docId) await db.collection('stars_purchase').doc(docId).update({ status: 'sent' });
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
