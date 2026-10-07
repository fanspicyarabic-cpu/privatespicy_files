// ==========================================
// VIP Admin Dashboard Core Engine (Optimized & High Speed)
// ==========================================

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
let adminStarPrice = 50;

// In-memory caches for 0ms instant UI responses
let cachedCelebs = new Map();
let cachedPayments = new Map();
let selectedCelebFile = null;

// Modal Helpers (Instant)
window.openModal = function (id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('active');
};
window.closeModal = function (id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('active');
};

window.toggleSidebar = function () {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const icon = document.getElementById('hamburgerIcon');
    const isOpen = sidebar.classList.toggle('open');
    overlay.classList.toggle('active', isOpen);
    icon.className = isOpen ? 'fas fa-times' : 'fas fa-bars';
};

window.closeSidebar = function () {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const icon = document.getElementById('hamburgerIcon');
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    icon.className = 'fas fa-bars';
};

// --- Authentication ---
async function doLogin() {
    const email = document.getElementById('adminEmail').value.trim();
    const pass = document.getElementById('adminPass').value;
    const btn = document.getElementById('loginBtn');
    if (!email || !pass) return alert("يرجى إدخال البريد الإلكتروني وكلمة السر!");

    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> جاري الدخول...`;

    try {
        await firebase.auth().signInWithEmailAndPassword(email, pass);
    } catch (err) {
        alert('خطأ في الدخول: ' + err.message);
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-unlock-keyhole"></i> تسجيل الدخول`;
    }
}
window.doLogin = doLogin;

firebase.auth().onAuthStateChanged((user) => {
    const dash = document.getElementById('dashboard');
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        dash.style.display = '';
        dash.classList.remove('hidden');
        initApp();
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        dash.style.display = 'none';
        dash.classList.add('hidden');
    }
});

let isAppStarted = false;
function initApp() {
    if (isAppStarted) return;
    isAppStarted = true;

    initTabs();
    fetchStats();
    listenToCelebrities();
    listenToPayments();
    listenToOrders();
    listenToRechargeCodes();
    fetchSettings();
}

function initTabs() {
    const navBtns = document.querySelectorAll('.sidebar-nav .nav-btn');
    const sections = document.querySelectorAll('.tab-content');
    const badge = document.getElementById('mobileCurrentTabBadge');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-tab');
            navBtns.forEach(b => b.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            btn.classList.add('active');

            const targetElem = document.getElementById(target);
            if (targetElem) targetElem.classList.add('active');
            if (badge) badge.innerText = btn.innerText.trim();
            closeSidebar();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
}

// --- Statistics (Fast non-blocking fetch) ---
async function fetchStats() {
    try {
        const usersCountSnap = await db.collection('users').get();
        const ordersApprovedSnap = await db.collection('orders').where('status', '==', 'approved').get();

        let totalRevenue = 0;
        ordersApprovedSnap.forEach(doc => {
            totalRevenue += parseFloat(doc.data().price || 0);
        });

        document.getElementById('stat-users').innerText = usersCountSnap.size;
        document.getElementById('stat-orders').innerText = ordersApprovedSnap.size;
        document.getElementById('stat-revenue').innerText = `${totalRevenue.toFixed(2)} $`;
    } catch (e) {
        console.error("Stats Error:", e);
    }
}

// --- Celebrities System (Instant 0ms Edit & Render) ---
function listenToCelebrities() {
    const list = document.getElementById('celebList');
    db.collection('celebrities').onSnapshot(snap => {
        cachedCelebs.clear();
        const items = [];
        snap.forEach(doc => {
            const data = { id: doc.id, ...doc.data() };
            cachedCelebs.set(doc.id, data);
            items.push(data);
        });

        items.sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));

        if (items.length === 0) {
            list.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:30px; color:#666;">لا يوجد مشاهير مضافين حالياً</td></tr>`;
            return;
        }

        const rowsHtml = items.map(data => `
            <tr>
                <td><img src="${data.image_url || 'https://via.placeholder.com/60'}" class="celeb-thumb" onerror="this.src='https://via.placeholder.com/60'"></td>
                <td><strong>${data.name}</strong></td>
                <td><span class="num-font" style="color:var(--primary-gold); font-weight:700;">$${data.price_usd}</span></td>
                <td>
                    <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                        <button class="btn-gold btn-sm" onclick="broadcastCeleb('${data.id}', '${data.name ? data.name.replace(/'/g, "\\'") : ''}')" title="إرسال إشعار فوري لجميع مشتركي البوت"><i class="fas fa-bullhorn"></i> نشر بالبوت</button>
                        <button class="btn-ghost btn-sm" onclick="editCeleb('${data.id}')"><i class="fas fa-edit"></i> تعديل</button>
                        <button class="btn-danger btn-sm" onclick="deleteDoc('celebrities', '${data.id}')"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');

        list.innerHTML = rowsHtml;
    }, err => console.error("Admin Load Error:", err));
}

window.broadcastCeleb = async function (id, name) {
    const data = cachedCelebs.get(id);
    const userCount = document.getElementById('stat-users').innerText || '1400+';
    if (!confirm(`هل تريد نشر "${name || 'هذا المنشور'}" فوراً لجميع المشتركين في البوت (${userCount} مشترك)؟`)) return;
    try {
        // 1. تفعيل النشر على مستند المشهور
        await db.collection('celebrities').doc(id).update({
            notify: true,
            broadcast_at: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 2. إدراج طلب النشر في طابور البث المباشر
        await db.collection('broadcast_queue').add({
            celebrity_id: id,
            name: data?.name || name || 'محتوى جديد',
            price_usd: data?.price_usd || 0,
            image_url: data?.image_url || '',
            file_link: data?.file_link || '',
            status: 'pending',
            created_at: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert(`🚀 تم إرسال أمر النشر بالبوت لـ (${name}) بنجاح!\nجاري البث لجميع المشتركين عبر البوت الآن 🎉`);
    } catch (e) {
        alert('خطأ أثناء النشر: ' + e.message);
    }
};

window.openNewCelebModal = function () {
    clearSelectedImage();
    document.getElementById('celebId').value = '';
    document.getElementById('saveCelebForm').reset();
    document.getElementById('celebModalTitle').innerHTML = '<i class="fas fa-crown" style="color:var(--primary-gold);"></i> ➕ إضافة مشهور جديد';
    openModal('celebModal');
};

window.editCeleb = function (id) {
    const data = cachedCelebs.get(id);
    if (!data) return;

    clearSelectedImage();
    document.getElementById('celebId').value = id;
    document.getElementById('celebName').value = data.name || '';
    document.getElementById('celebPrice').value = data.price_usd || '';
    document.getElementById('celebImage').value = data.image_url || '';
    document.getElementById('celebFile').value = data.file_link || '';

    if (data.image_url) {
        document.getElementById('celebPreviewImg').src = data.image_url;
        document.getElementById('uploadPreviewWrap').style.display = 'block';
        document.getElementById('uploadStatusText').innerHTML = `<i class="fas fa-image"></i> الصورة الحالية محملة`;
    }

    document.getElementById('celebModalTitle').innerHTML = '<i class="fas fa-edit" style="color:var(--primary-gold);"></i> ✏️ تعديل بيانات المشهور';
    openModal('celebModal');
};

let selectedCelebDataUrl = null;

window.handleImageSelect = function (input) {
    if (input.files && input.files[0]) {
        selectedCelebFile = input.files[0];
        const reader = new FileReader();
        reader.onload = function (e) {
            selectedCelebDataUrl = e.target.result;
            const previewImg = document.getElementById('celebPreviewImg');
            if (previewImg) previewImg.src = selectedCelebDataUrl;
            const previewWrap = document.getElementById('uploadPreviewWrap');
            if (previewWrap) previewWrap.style.display = 'block';
            const statusText = document.getElementById('uploadStatusText');
            if (statusText) statusText.innerHTML = `<i class="fas fa-check-circle"></i> تم اختيار الصورة (${(selectedCelebFile.size / 1024).toFixed(0)} KB)`;
            document.getElementById('celebImage').value = '';
        };
        reader.readAsDataURL(selectedCelebFile);
    }
};

window.handleUrlInput = function (url) {
    if (url && url.trim() !== '') {
        selectedCelebFile = null;
        selectedCelebDataUrl = null;
        document.getElementById('celebImageFile').value = '';
        document.getElementById('celebPreviewImg').src = url;
        document.getElementById('uploadPreviewWrap').style.display = 'block';
        document.getElementById('uploadStatusText').innerHTML = `<i class="fas fa-link"></i> رابط صورة مباشر`;
    } else if (!selectedCelebFile) {
        clearSelectedImage();
    }
};

window.clearSelectedImage = function () {
    selectedCelebFile = null;
    selectedCelebDataUrl = null;
    const fileInput = document.getElementById('celebImageFile');
    if (fileInput) fileInput.value = '';
    const imgElem = document.getElementById('celebPreviewImg');
    if (imgElem) imgElem.src = '';
    const previewWrap = document.getElementById('uploadPreviewWrap');
    if (previewWrap) previewWrap.style.display = 'none';
    const urlInput = document.getElementById('celebImage');
    if (urlInput) urlInput.value = '';
};

function compressImageQuick(sourceDataOrFile, maxWidth = 800, quality = 0.82) {
    return new Promise((resolve) => {
        const processImg = (dataUri) => {
            if (!dataUri) return resolve(null);
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    let width = img.naturalWidth || img.width || 400;
                    let height = img.naturalHeight || img.height || 400;
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    const res = canvas.toDataURL('image/jpeg', quality);
                    resolve(res || dataUri);
                } catch (err) {
                    resolve(dataUri);
                }
            };
            img.onerror = () => resolve(dataUri);
            img.src = dataUri;
        };

        if (typeof sourceDataOrFile === 'string') {
            processImg(sourceDataOrFile);
        } else if (sourceDataOrFile instanceof Blob || sourceDataOrFile instanceof File) {
            const reader = new FileReader();
            reader.onload = (e) => processImg(e.target.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(sourceDataOrFile);
        } else {
            resolve(null);
        }
    });
}

async function uploadImageFile(file, statusCallback) {
    if (statusCallback) statusCallback("معالجة وتجهيز الصورة... ⚡");
    const source = selectedCelebDataUrl || file;
    let finalDataUrl = await compressImageQuick(source, 800, 0.82);

    if (!finalDataUrl && selectedCelebDataUrl) finalDataUrl = selectedCelebDataUrl;
    if (!finalDataUrl) throw new Error("تعذر قراءة الصورة من الجهاز، يرجى اختيارها مرة أخرى.");

    let base64Only = finalDataUrl;
    if (finalDataUrl.includes(',')) base64Only = finalDataUrl.split(',')[1];

    if (statusCallback) statusCallback("الرفع السحابي الفوري... ☁️");

    if (window.IMGBB_API_KEY) {
        try {
            const formData = new FormData();
            formData.append('image', base64Only);
            const res = await fetch(`https://api.imgbb.com/1/upload?key=${window.IMGBB_API_KEY}`, {
                method: 'POST',
                body: formData
            });
            if (res.ok) {
                const json = await res.json();
                if (json.success && json.data && json.data.url) return json.data.url;
            }
        } catch (e) { }
    }

    return finalDataUrl;
}

document.getElementById('saveCelebForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('celebId').value;
    const submitBtn = document.getElementById('saveCelebSubmitBtn');
    const originalBtnText = submitBtn.innerHTML;

    let finalImageUrl = document.getElementById('celebImage').value.trim();

    if (selectedCelebFile) {
        submitBtn.disabled = true;
        try {
            finalImageUrl = await uploadImageFile(selectedCelebFile, (msg) => {
                submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${msg}`;
            });
        } catch (uploadErr) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
            return alert('فشل رفع الصورة: ' + uploadErr.message);
        }
    }

    if (!finalImageUrl) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
        return alert('يرجى اختيار صورة من جهازك أو وضع رابط صورة!');
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> جاري الحفظ والنشر...`;

    const shouldNotify = document.getElementById('celebNotify') ? document.getElementById('celebNotify').checked : true;

    const data = {
        name: document.getElementById('celebName').value.trim(),
        price_usd: parseFloat(document.getElementById('celebPrice').value),
        image_url: finalImageUrl,
        file_link: document.getElementById('celebFile').value.trim(),
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (shouldNotify) {
        data.notify = true;
        data.broadcast_at = firebase.firestore.FieldValue.serverTimestamp();
    }

    if (!id) data.created_at = firebase.firestore.FieldValue.serverTimestamp();

    try {
        let savedDocId = id;
        if (id) {
            await db.collection('celebrities').doc(id).update(data);
        } else {
            const newDoc = await db.collection('celebrities').add(data);
            savedDocId = newDoc.id;
        }

        if (shouldNotify) {
            await db.collection('broadcast_queue').add({
                celebrity_id: savedDocId,
                name: data.name,
                price_usd: data.price_usd,
                image_url: data.image_url,
                file_link: data.file_link,
                status: 'pending',
                created_at: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        closeModal('celebModal');
        document.getElementById('saveCelebForm').reset();
        clearSelectedImage();
        alert('✅ تم الحفظ بنجاح!' + (shouldNotify ? ' تم إرسال أمر النشر لجميع مشتركي البوت 🎉' : ''));
    } catch (err) {
        alert('خطأ في الحفظ: ' + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
});

// --- Payment Methods System (Instant 0ms Edit) ---
function listenToPayments() {
    const list = document.getElementById('paymentMethodList');
    db.collection('payment_methods').onSnapshot(snap => {
        cachedPayments.clear();
        const rows = [];
        snap.forEach(doc => {
            const data = { id: doc.id, ...doc.data() };
            cachedPayments.set(doc.id, data);
            rows.push(`
                <tr>
                    <td><strong>${data.name}</strong></td>
                    <td><span style="color:var(--text-muted); font-size:0.85rem;">${data.type}</span></td>
                    <td><span class="status-pill approved">نشط</span></td>
                    <td>
                        <div style="display:flex; gap:6px;">
                            <button class="btn-gold btn-sm" onclick="editPaymentMethod('${doc.id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn-danger btn-sm" onclick="deleteDoc('payment_methods', '${doc.id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `);
        });
        list.innerHTML = rows.join('') || `<tr><td colspan="4" style="text-align:center; padding:20px; color:#666;">لا توجد وسائل دفع مضافة</td></tr>`;
    });
}

window.openNewPaymentModal = function () {
    document.getElementById('payId').value = '';
    document.getElementById('savePaymentForm').reset();
    document.getElementById('paymentModalTitle').innerHTML = '<i class="fas fa-wallet" style="color:var(--primary-gold);"></i> ➕ إضافة وسيلة دفع';
    openModal('paymentModal');
};

window.editPaymentMethod = function (id) {
    const data = cachedPayments.get(id);
    if (!data) return;
    document.getElementById('payId').value = id;
    document.getElementById('payName').value = data.name || '';
    document.getElementById('payType').value = data.type || 'manual';
    document.getElementById('payInstructions').value = data.instructions || '';
    document.getElementById('paymentModalTitle').innerHTML = '<i class="fas fa-edit" style="color:var(--primary-gold);"></i> ✏️ تعديل وسيلة الدفع';
    openModal('paymentModal');
};

document.getElementById('savePaymentForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('payId').value;
    const data = {
        name: document.getElementById('payName').value.trim(),
        type: document.getElementById('payType').value,
        instructions: document.getElementById('payInstructions').value.trim(),
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        if (id) {
            await db.collection('payment_methods').doc(id).update(data);
        } else {
            data.created_at = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('payment_methods').add(data);
        }
        closeModal('paymentModal');
        document.getElementById('savePaymentForm').reset();
        document.getElementById('payId').value = '';
        alert('✅ تم حفظ وسيلة الدفع بنجاح!');
    } catch (err) {
        alert('حدث خطأ: ' + err.message);
    }
});

// --- Orders System (Limit 50) ---
function listenToOrders() {
    const list = document.getElementById('ordersList');
    db.collection('orders').orderBy('created_at', 'desc').limit(50).onSnapshot(snap => {
        const rows = [];
        snap.forEach(doc => {
            const data = doc.data();
            let statusClass = 'pending';
            let statusText = '⏳ معلق';
            if (data.status === 'approved') { statusClass = 'approved'; statusText = '✅ مقبول'; }
            else if (data.status === 'rejected') { statusClass = 'rejected'; statusText = '❌ مرفوض'; }

            const celebData = cachedCelebs.get(data.celebrity_id);
            const resolvedLink = data.file_link || celebData?.file_link || '';
            const safeCelebName = (data.celebrity_name || '').replace(/'/g, "\\'");
            const safeLink = resolvedLink.replace(/'/g, "\\'");

            let linkHtml = '';
            if (resolvedLink) {
                linkHtml = `
                    <div style="display:flex; align-items:center; gap:6px;">
                        <a href="${resolvedLink}" target="_blank" class="btn-sm btn-ghost" style="color:var(--primary-gold); text-decoration:none; padding:4px 8px; font-size:0.75rem;" title="${resolvedLink}">
                            <i class="fas fa-external-link-alt"></i> فتح
                        </a>
                        <button class="btn-gold btn-sm" onclick="openEditOrderLinkModal('${doc.id}', '${safeLink}', '${safeCelebName}')" title="تعديل الرابط" style="padding:4px 8px; font-size:0.75rem;">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                `;
            } else {
                linkHtml = `
                    <button class="btn-gold btn-sm" onclick="openEditOrderLinkModal('${doc.id}', '', '${safeCelebName}')" style="padding:4px 8px; font-size:0.75rem;">
                        <i class="fas fa-plus"></i> إضافة رابط
                    </button>
                `;
            }

            rows.push(`
                <tr>
                    <td><strong>${data.user_name || 'عميل'}</strong><br><small style="color:#666;">ID: ${data.user_id || '-'}</small></td>
                    <td>${data.celebrity_name || '-'}</td>
                    <td><strong class="num-font" style="color:var(--primary-gold);">$${data.price || 0}</strong></td>
                    <td>${linkHtml}</td>
                    <td><span class="status-pill ${statusClass}">${statusText}</span></td>
                    <td>
                        ${data.status === 'pending' ? `
                            <div style="display:flex; gap:6px;">
                                <button class="btn-gold btn-sm" onclick="updateOrderStatus('${doc.id}', 'approved')"><i class="fas fa-check"></i> قبول</button>
                                <button class="btn-danger btn-sm" onclick="openRejectModal('${doc.id}')"><i class="fas fa-times"></i> رفض</button>
                            </div>
                        ` : '<span style="color:#666; font-size:0.8rem;">مكتمل</span>'}
                    </td>
                </tr>
            `);
        });

        list.innerHTML = rows.join('') || `<tr><td colspan="6" style="text-align:center; padding:30px; color:#666;">لا توجد طلبات مسجلة</td></tr>`;
    });
}

window.updateOrderStatus = async (id, status, reason = '') => {
    const doc = await db.collection('orders').doc(id).get();
    const data = doc.data();
    const userId = data?.user_id;

    const updateData = {
        status: status,
        rejection_reason: reason,
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (status === 'approved' && !data?.file_link && data?.celebrity_id) {
        const celeb = cachedCelebs.get(data.celebrity_id);
        if (celeb && celeb.file_link) {
            updateData.file_link = celeb.file_link;
        }
    }

    await db.collection('orders').doc(id).update(updateData);

    if (status === 'rejected') {
        closeModal('rejectModal');
        if (userId) notifyUser(userId, `❌ تم رفض طلب شراء المحتوى الخاص بك.\nالسبب: ${reason}`);
    } else if (status === 'approved') {
        const finalLink = updateData.file_link || data?.file_link;
        if (userId && finalLink) {
            notifyUser(userId, `🎉 تم قبول طلب المحتوى الخاص بك لـ (${data?.celebrity_name || 'المحتوى'}) بنجاح!\n🔗 رابط المحتوى الخاص بك:\n${finalLink}`);
        }
    }

    fetchStats();
};

window.openEditOrderLinkModal = (id, link, name) => {
    document.getElementById('editOrderLinkId').value = id;
    document.getElementById('editOrderLinkInput').value = link || '';
    document.getElementById('editOrderLinkName').innerText = name ? `المحتوى: ${name}` : '';
    openModal('editOrderLinkModal');
};

window.saveOrderLink = async () => {
    const id = document.getElementById('editOrderLinkId').value;
    const link = document.getElementById('editOrderLinkInput').value.trim();
    if (!id) return;
    try {
        await db.collection('orders').doc(id).update({
            file_link: link,
            updated_at: firebase.firestore.FieldValue.serverTimestamp()
        });
        closeModal('editOrderLinkModal');
        alert('✅ تم حفظ وتحديث رابط المحتوى لهذا الطلب بنجاح!');
    } catch (e) {
        alert('خطأ أثناء حفظ الرابط: ' + e.message);
    }
};

window.openRejectModal = (id) => {
    document.getElementById('rejectOrderId').value = id;
    openModal('rejectModal');
};

document.getElementById('rejectOrderForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('rejectOrderId').value;
    const reason = document.getElementById('rejectReason').value;
    updateOrderStatus(id, 'rejected', reason);
});

// --- Recharge Codes (Limit 50) ---
function listenToRechargeCodes() {
    const list = document.getElementById('rechargeCodesList');
    db.collection('code_recharges').orderBy('created_at', 'desc').limit(50).onSnapshot(snap => {
        const rows = [];
        snap.forEach(doc => {
            const data = doc.data();
            const paymentMethod = data.payment_method || 'كود شحن';
            const expectedAmount = data.expected_amount ? `($${data.expected_amount})` : '';

            let statusClass = 'pending';
            let statusText = '⏳ معلق';
            if (data.status === 'approved') { statusClass = 'approved'; statusText = '✅ مقبول'; }
            else if (data.status === 'rejected') { statusClass = 'rejected'; statusText = '❌ مرفوض'; }

            const safeCode = (data.code || '').replace(/'/g, "\\'");
            rows.push(`
                <tr>
                    <td><strong>${data.user_name || 'عميل'}</strong><br><small style="color:#666;">ID: ${data.user_id}</small></td>
                    <td><span style="color:var(--primary-gold); font-weight:600;">${paymentMethod}</span></td>
                    <td>
                        <div style="max-width: 180px; word-break: break-all; background: rgba(255,255,255,0.05); padding: 6px 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
                            <div class="num-font" style="color:#fff; font-size:0.78rem; line-height: 1.35; user-select: all; direction:ltr; text-align:left;">${data.code || '-'}</div>
                            ${expectedAmount ? `<div style="color:var(--primary-gold); font-size:0.8rem; font-weight:700; margin-top:3px;">${expectedAmount}</div>` : ''}
                        </div>
                        ${data.card_type ? `<div style="font-size:0.75rem; color:#888; margin-top:4px;">نوع البطاقة: ${data.card_type}</div>` : ''}
                    </td>
                    <td><span class="status-pill ${statusClass}">${statusText}</span></td>
                    <td>
                        ${data.status === 'pending' ? `
                            <div style="display:flex; gap:6px;">
                                <button class="btn-gold btn-sm" onclick="approveRechargeCode('${doc.id}', '${data.user_id}', '${safeCode}', ${data.expected_amount || 0})"><i class="fas fa-check"></i> شحن</button>
                                <button class="btn-danger btn-sm" onclick="rejectRechargeCode('${doc.id}', '${data.user_id}')"><i class="fas fa-times"></i> رفض</button>
                            </div>
                        ` : '<span style="color:#666; font-size:0.8rem;">مكتمل</span>'}
                    </td>
                </tr>
            `);
        });

        list.innerHTML = rows.join('') || `<tr><td colspan="5" style="text-align:center; padding:30px; color:#666;">لا توجد طلبات شحن</td></tr>`;
    });
}

window.approveRechargeCode = async (docId, userId, code, expectedAmount) => {
    let amount = prompt("كم الرصيد الذي تريد إضافته للمستخدم (بالدولار)؟", expectedAmount || 0);
    amount = parseFloat(amount);
    if (!amount || amount <= 0) return;

    const starsToAdd = Math.round(amount * adminStarPrice);
    if (confirm(`سيتم إضافة ${amount}$ (${starsToAdd} نجمة) لرصيد العميل وتوثيق حسابه.\nهل تريد التأكيد؟`)) {
        await db.collection('users').doc(userId).set({
            balance: firebase.firestore.FieldValue.increment(starsToAdd),
            is_verified: true
        }, { merge: true });

        await db.collection('code_recharges').doc(docId).update({
            status: 'approved',
            added_amount: amount,
            updated_at: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert('✅ تم شحن رصيد العميل وتوثيق حسابه بنجاح!');
        fetchStats();
        notifyUser(userId, `✅ تم قبول طلب الإيداع وإضافة رصيدك بنجاح!`);
    }
};

window.rejectRechargeCode = async (docId, userId) => {
    const reason = prompt("ما هو سبب الرفض؟ سيتم إشعار العميل بهذا السبب.");
    if (reason !== null) {
        await db.collection('code_recharges').doc(docId).update({
            status: 'rejected',
            rejection_reason: reason,
            updated_at: firebase.firestore.FieldValue.serverTimestamp()
        });
        notifyUser(userId, `❌ تم رفض طلب الشحن الخاص بك.\nالسبب: ${reason}`);
    }
};

function notifyUser(userId, message) {
    db.collection('bot_notifications').add({
        user_id: userId,
        message: message,
        created_at: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'pending'
    });
}

window.deleteDoc = async (coll, id) => {
    if (confirm('هل أنت متأكد من الحذف النهائي؟')) {
        try {
            await db.collection(coll).doc(id).delete();
            alert('✅ تم الحذف بنجاح');
        } catch (err) {
            alert('خطأ في الحذف: ' + err.message);
        }
    }
};

async function fetchSettings() {
    const doc = await db.collection('settings').doc('global').get();
    if (doc.exists) {
        const data = doc.data();
        if (document.getElementById('store_url')) document.getElementById('store_url').value = data.store_url || '';
        document.getElementById('support_url').value = data.support_url || '';
        document.getElementById('invite_url').value = data.invite_url || '';
        document.getElementById('binance_wallet').value = data.binance_wallet || '';
        document.getElementById('binance_url').value = data.binance_url || '';
        document.getElementById('binance_qr').value = data.binance_qr || '';
        document.getElementById('binance_info').value = data.binance_info || '';
        document.getElementById('star_price').value = data.star_price || 50;
        if (data.star_price && data.star_price > 0) {
            adminStarPrice = data.star_price;
        }
    }
}

document.getElementById('globalSettingsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await db.collection('settings').doc('global').set({
        store_url: document.getElementById('store_url')?.value?.trim() || 'https://privatespicy.web.app',
        support_url: document.getElementById('support_url').value.trim(),
        invite_url: document.getElementById('invite_url').value.trim(),
        binance_wallet: document.getElementById('binance_wallet').value.trim(),
        binance_url: document.getElementById('binance_url').value.trim(),
        binance_qr: document.getElementById('binance_qr').value.trim(),
        binance_info: document.getElementById('binance_info').value.trim(),
        star_price: parseFloat(document.getElementById('star_price').value) || 50
    }, { merge: true });
    alert('✅ تم حفظ جميع الإعدادات بنجاح!');
});