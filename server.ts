import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import firebaseConfig from "./firebase-applet-config.json";

dotenv.config();

// Initialize Firebase Admin
let firebaseApp: admin.app.App;
try {
  if (!admin.apps.length) {
    firebaseApp = admin.initializeApp({
      projectId: firebaseConfig.projectId,
    });
    console.log("Firebase Admin initialized for project:", firebaseConfig.projectId);
  } else {
    firebaseApp = admin.app();
  }
} catch (error) {
  console.error("Firebase Admin initialization error:", error);
  process.exit(1);
}

const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
console.log("Firestore initialized with database ID:", firebaseConfig.firestoreDatabaseId || "(default)");

// Test database connection
(async () => {
  try {
    await db.collection('health_check').doc('ping').set({ timestamp: admin.firestore.FieldValue.serverTimestamp() });
    console.log("Firestore connection check successful.");
  } catch (error) {
    console.error("Firestore connection check failed:", error);
  }
})();

/**
 * Retries a Firestore operation if it fails with a transient error.
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      // Retry on transient errors (e.g., network issues, quota exceeded)
      const isTransient = 
        error.code === 14 || // UNAVAILABLE
        error.code === 4 ||  // DEADLINE_EXCEEDED
        error.message?.toLowerCase().includes('quota exceeded') ||
        error.message?.toLowerCase().includes('unavailable');
      
      if (!isTransient || i === maxRetries - 1) {
        throw error;
      }
      
      await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, i))); // Exponential backoff
    }
  }
  throw lastError;
}

const app = express();
const PORT = 3000;

// In-memory pairing codes (code -> userId)
const pairingCodes = new Map<string, string>();

// Initialize Telegram Bot
let bot: TelegramBot | null = null;
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (TELEGRAM_TOKEN) {
  bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
  console.log("Telegram Bot initialized.");

  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot?.sendMessage(chatId, "Welcome to Jarvis Hub! 🤖\nTo pair your account, send: /pair <YOUR_PAIRING_CODE>\nYou can get your pairing code from the 'Skills & Access' section in the Jarvis Hub web app.");
  });

  bot.onText(/\/pair (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const code = match?.[1]?.toUpperCase();

      if (code && pairingCodes.has(code)) {
        const userId = pairingCodes.get(code);
        try {
          // Store pairing in bot_handshakes for client to complete
          await withRetry(() => db.collection('bot_handshakes').doc(code).set({
            chatId: chatId.toString(),
            userId: userId!,
            username: msg.from?.username || 'unknown',
            firstName: msg.from?.first_name || 'unknown',
            pairedAt: admin.firestore.FieldValue.serverTimestamp()
          }));

          bot?.sendMessage(chatId, "⏳ Pairing in progress... Please wait for the Jarvis Hub web app to confirm.");
          pairingCodes.delete(code);
        } catch (error) {
          console.error("Pairing error:", error);
          bot?.sendMessage(chatId, "❌ Error during pairing. Please try again later.");
        }
      } else {
      bot?.sendMessage(chatId, "❌ Invalid or expired pairing code.");
    }
  });

  // Handle incoming messages
  bot.on('message', async (msg) => {
    if (msg.text?.startsWith('/')) return; // Skip commands

    const chatId = msg.chat.id.toString();
    
    try {
      // Find the user associated with this chatId
      const querySnapshot = await withRetry<admin.firestore.QuerySnapshot>(() => db.collection('telegram_pairings')
        .where("chatId", "==", chatId)
        .get());

      if (!querySnapshot.empty) {
        const userId = querySnapshot.docs[0].id;
        
        // Show typing indicator
        bot?.sendChatAction(chatId, 'typing');
        
        // Store the message in Firestore
        await withRetry(() => db.collection('telegram_messages').add({
          chatId,
          userId,
          text: msg.text,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          processed: false,
          from: {
            username: msg.from?.username,
            firstName: msg.from?.first_name
          }
        }));
        
        console.log(`Telegram message from ${userId} stored.`);
      } else {
        bot?.sendMessage(chatId, "⚠️ Your account is not paired with Jarvis Hub. Please use /pair <code_from_app> to connect.");
      }
    } catch (error) {
      console.error("Error handling Telegram message:", error);
    }
  });
}

app.use(express.json());

// API routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", telegramActive: !!bot });
});

app.post("/api/telegram/pair-code", (req, res) => {
  const { userId } = req.body;
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  pairingCodes.set(code, userId);
  
  // Expire code after 5 minutes
  setTimeout(() => pairingCodes.delete(code), 5 * 60 * 1000);
  
  res.json({ code });
});

app.post("/api/telegram/send", async (req, res) => {
  const { chatId, message } = req.body;
  if (!bot) return res.status(500).json({ error: "Telegram bot not configured" });
  
  try {
    await bot.sendMessage(chatId, message);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to send message" });
  }
});

// Vite middleware for development
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

setupVite();
