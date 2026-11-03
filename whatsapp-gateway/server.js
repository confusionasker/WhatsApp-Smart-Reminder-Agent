const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const {
    default: makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser
} = require('@whiskeysockets/baileys');
const pino = require('pino');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const AUTH_DIR = path.join(__dirname, 'auth_info_baileys');
const logger = pino({ level: 'silent' });

let sock = null;
let currentQr = null;
let isConnected = false;
let userPhone = null;
let userName = null;
let isStarting = false;

async function startWhatsApp() {
    if (isStarting) return;
    isStarting = true;

    try {
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
        const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));

        console.log('🔄 Initializing WhatsApp Web engine...');

        sock = makeWASocket({
            version,
            logger,
            printQRInTerminal: false,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger)
            },
            browser: Browsers.ubuntu('Chrome'),
            syncFullHistory: false,
            generateHighQualityLinkPreview: false,
            connectTimeoutMs: 120000,
            defaultQueryTimeoutMs: 120000,
            qrTimeout: 120000,
            retryRequestDelayMs: 2000
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                try {
                    currentQr = await qrcode.toDataURL(qr, { scale: 7, margin: 2 });
                    console.log('📌 Active WhatsApp QR Code generated and ready to scan');
                } catch (err) {
                    console.error('Failed to generate QR data URL:', err);
                }
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const errorMsg = lastDisconnect?.error?.message || 'Unknown';
                const isRegistered = sock?.authState?.creds?.registered;

                isConnected = false;
                userPhone = null;
                userName = null;
                isStarting = false;

                console.log(`⚠️ Connection closed [code: ${statusCode || 'none'}]: ${errorMsg}`);

                // CRITICAL FIX: Only delete auth files if an already-registered user deliberately logged out
                // Do NOT delete auth directory during initial QR/pairing handshake!
                if (statusCode === DisconnectReason.loggedOut && isRegistered) {
                    console.log('User logged out from WhatsApp device. Resetting auth directory...');
                    currentQr = null;
                    if (fs.existsSync(AUTH_DIR)) {
                        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
                    }
                    setTimeout(startWhatsApp, 2000);
                } else if (statusCode === 408) {
                    // QR Timeout
                    console.log('⏳ QR code timed out after 2 minutes. Refreshing...');
                    setTimeout(() => {
                        if (!isConnected) startWhatsApp();
                    }, 2000);
                } else {
                    // Normal reconnect (handshake in progress or temporary network dip)
                    console.log('Reconnecting socket in 2s (preserving pairing keys)...');
                    setTimeout(() => {
                        if (!isConnected) startWhatsApp();
                    }, 2000);
                }
            } else if (connection === 'open') {
                console.log('🎉🎉🎉 WhatsApp Web CONNECTED successfully! 🎉🎉🎉');
                isConnected = true;
                isStarting = false;
                currentQr = null;
                const user = sock.user;
                if (user) {
                    userPhone = user.id ? user.id.split(':')[0] : null;
                    userName = user.name || 'User';
                    console.log(`📱 Logged in as: ${userName} (+${userPhone})`);
                }
            }
        });
    } catch (error) {
        console.error('Error starting WhatsApp socket:', error);
        isStarting = false;
        setTimeout(startWhatsApp, 4000);
    }
}

// ─── Endpoints ─────────────────────────────────────────────────────────────

app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        data: {
            connected: isConnected,
            phone: userPhone,
            name: userName,
            hasQr: !!currentQr
        }
    });
});

app.get('/api/qr', (req, res) => {
    res.json({
        success: true,
        data: {
            connected: isConnected,
            qr: currentQr,
            phone: userPhone
        }
    });
});

app.post('/api/refresh-qr', async (req, res) => {
    try {
        isStarting = false;
        if (sock && !isConnected) {
            try { sock.end(new Error('Manual refresh')); } catch (e) {}
        }
        setTimeout(startWhatsApp, 500);
        res.json({ success: true, message: 'Refreshing QR code...' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/reset', async (req, res) => {
    try {
        console.log('🧹 Clearing pairing files for a clean reset...');
        if (sock) {
            try { sock.end(new Error('Reset requested')); } catch (e) {}
        }
        if (fs.existsSync(AUTH_DIR)) {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        }
        isConnected = false;
        userPhone = null;
        userName = null;
        currentQr = null;
        isStarting = false;

        setTimeout(startWhatsApp, 1000);
        res.json({ success: true, message: 'Session reset. Clean QR generated.' });
    } catch (err) {
        console.error('Error resetting session:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Pairing code
app.post('/api/pairing-code', async (req, res) => {
    const { phone } = req.body;
    if (!phone) {
        return res.status(400).json({ success: false, error: 'Phone number is required' });
    }

    try {
        const cleanPhone = String(phone).replace(/[\s\-\(\)\+]/g, '');

        if (!sock) {
            await startWhatsApp();
            await new Promise(r => setTimeout(r, 2000));
        }

        if (sock.authState?.creds?.registered) {
            return res.status(400).json({
                success: false,
                error: 'Already registered and logged in! Click Disconnect first to link another number.'
            });
        }

        const rawCode = await sock.requestPairingCode(cleanPhone);
        const formatted = rawCode?.match(/.{1,4}/g)?.join('-') || rawCode;

        console.log(`🔑 Pairing Code generated for +${cleanPhone}: ${formatted}`);
        return res.json({ success: true, data: { code: formatted, phone: cleanPhone } });
    } catch (err) {
        console.error('Error generating pairing code:', err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Failed to generate pairing code. Please try again.'
        });
    }
});

app.post('/api/send', async (req, res) => {
    const { to, message } = req.body;
    console.log(`\n📤 [SEND REQUEST] Received request to send to "${to}"`);
    console.log(`💬 Message: "${message}"`);

    if (!to || !message) {
        return res.status(400).json({ success: false, error: 'Recipient "to" and "message" are required' });
    }

    if (!isConnected || !sock) {
        console.log('❌ Failed: WhatsApp is not connected.');
        return res.status(503).json({
            success: false,
            error: 'WhatsApp is not connected. Please link your WhatsApp first.'
        });
    }

    try {
        let cleanNumber = String(to).replace(/[\s\-\(\)\+]/g, '');

        // Smart formatting for common local numbers if country code was omitted
        if (cleanNumber.length === 10 && /^[6-9]/.test(cleanNumber)) {
            cleanNumber = '91' + cleanNumber;
            console.log(`ℹ️ Auto-added India country code: ${cleanNumber}`);
        } else if (cleanNumber.length === 11 && cleanNumber.startsWith('01')) {
            cleanNumber = '880' + cleanNumber.substring(1);
            console.log(`ℹ️ Auto-added Bangladesh country code: ${cleanNumber}`);
        }

        const myNumber = userPhone || (sock?.user?.id ? sock.user.id.split(':')[0] : null);
        let jid = `${cleanNumber}@s.whatsapp.net`;

        // Check if sending to oneself
        if (myNumber && cleanNumber === myNumber) {
            jid = jidNormalizedUser(sock.user.id);
            console.log(`ℹ️ Sending message to SELF ("Message yourself" chat): ${jid}`);
        } else {
            // Check if number is registered on WhatsApp
            try {
                const results = await sock.onWhatsApp(cleanNumber);
                if (results && results.length > 0 && results[0]?.exists) {
                    jid = results[0].jid;
                    console.log(`✅ WhatsApp user verified: ${jid}`);
                } else {
                    console.log(`⚠️ Number ${cleanNumber} not found directly via onWhatsApp lookup. Proceeding with ${jid}`);
                }
            } catch (checkErr) {
                console.log(`ℹ️ onWhatsApp check notice: ${checkErr.message}`);
            }
        }

        console.log(`📡 Dispatching WhatsApp message to ${jid}...`);
        const result = await sock.sendMessage(jid, { text: message });
        const msgId = result?.key?.id;

        console.log(`🎉 SUCCESS! Message delivered to WhatsApp network. ID: ${msgId}`);

        return res.json({
            success: true,
            data: {
                messageId: msgId,
                to: cleanNumber,
                jid: jid,
                status: 'SENT'
            }
        });
    } catch (err) {
        console.error('❌ Failed to send message via WhatsApp Web:', err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Failed to send WhatsApp message'
        });
    }
});

app.post('/api/logout', async (req, res) => {
    try {
        if (sock) {
            try { await sock.logout(); } catch (e) {}
        }
        if (fs.existsSync(AUTH_DIR)) {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        }
        isConnected = false;
        userPhone = null;
        userName = null;
        currentQr = null;
        isStarting = false;

        setTimeout(startWhatsApp, 1000);

        return res.json({ success: true, message: 'Logged out successfully' });
    } catch (err) {
        console.error('Error logging out:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

// Start gateway server
app.listen(PORT, () => {
    console.log(`🚀 WhatsApp Web Gateway listening on http://localhost:${PORT}`);
    startWhatsApp();
});
