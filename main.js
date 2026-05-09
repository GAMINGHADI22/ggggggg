const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage,
  getContentType
} = require("baileys");

const P = require("pino");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");

const SAVE_DIR = path.join(__dirname, "downloads");
if (!fs.existsSync(SAVE_DIR)) fs.mkdirSync(SAVE_DIR);

function extFromMime(mime = "") {
  if (mime.includes("image")) return ".jpg";
  if (mime.includes("video")) return ".mp4";
  if (mime.includes("audio")) return ".mp3";
  if (mime.includes("pdf")) return ".pdf";
  return ".bin";
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("session");

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: "silent" })
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) qrcode.generate(qr, { small: true });

    if (connection === "open") {
      console.log("✅ WhatsApp Bot Connected!");
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

      console.log("❌ Connection closed");
      if (shouldReconnect) startBot();
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const type = getContentType(msg.message);

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      "";

    if (text === "/start") {
      await sock.sendMessage(from, {
        text:
`╭━━━〔 💾 MEDIA SAVER BOT 〕━━━╮
┃
┃ 👋 Welcome!
┃
┃ 📥 Send normal media:
┃ 🖼 Photo
┃ 🎬 Video
┃ 🎧 Audio
┃ 📄 Document
┃ 🧩 Sticker
┃
┃ ⚠️ View-once media supported নয়
┃
┣━━━━━━━━━━━━━━━━━━━━╯
┃ 📌 Commands:
┃ /start  - Bot menu
┃ /help   - How to use
┃ /about  - Bot info
╰━━━━━━━━━━━━━━━━━━━━╯`
      });
      return;
    }

    if (text === "/help") {
      await sock.sendMessage(from, {
        text:
`╭━━━〔 📌 HOW TO USE 〕━━━╮
┃
┃ 1️⃣ Normal photo/video পাঠাও
┃ 2️⃣ Bot auto download করবে
┃ 3️⃣ downloads folder এ save হবে
┃
┃ ⚠️ View-once media save হবে না
┃
╰━━━━━━━━━━━━━━━━━━━╯`
      });
      return;
    }

    if (text === "/about") {
      await sock.sendMessage(from, {
        text:
`╭━━━〔 🤖 BOT INFO 〕━━━╮
┃
┃ Name: Media Saver Bot
┃ Version: PRO UI
┃ Status: Online ✅
┃ Developer: Abdur
┃
╰━━━━━━━━━━━━━━━━━━╯`
      });
      return;
    }

    if (type === "viewOnceMessage" || type === "viewOnceMessageV2") {
      await sock.sendMessage(from, {
        text:
`╭━━━〔 ⚠️ NOT SUPPORTED 〕━━━╮
┃
┃ View-once media save করা যাবে না।
┃ Normal photo/video পাঠাও।
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯`
      });
      return;
    }

    const mediaTypes = [
      "imageMessage",
      "videoMessage",
      "audioMessage",
      "documentMessage",
      "stickerMessage"
    ];

    if (!mediaTypes.includes(type)) return;

    try {
      const buffer = await downloadMediaMessage(
        msg,
        "buffer",
        {},
        { logger: P({ level: "silent" }) }
      );

      const media = msg.message[type];

      const ext =
        type === "documentMessage"
          ? path.extname(media.fileName || "") || extFromMime(media.mimetype)
          : extFromMime(media.mimetype);

      const fileName = `${Date.now()}_${type}${ext}`;
      const filePath = path.join(SAVE_DIR, fileName);

      fs.writeFileSync(filePath, buffer);

      await sock.sendMessage(from, {
        text:
`╭━━━〔 ✅ SAVED SUCCESS 〕━━━╮
┃
┃ 📁 File: ${fileName}
┃ 💾 Status: Saved
┃ 📂 Folder: downloads
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯`
      });

      console.log("Saved:", filePath);
    } catch (err) {
      console.log(err);
      await sock.sendMessage(from, {
        text:
`╭━━━〔 ❌ ERROR 〕━━━╮
┃
┃ Media save করতে সমস্যা হয়েছে।
┃ আবার normal media পাঠাও।
┃
╰━━━━━━━━━━━━━━━━━━╯`
      });
    }
  });
}

startBot();
