require("dotenv").config();
const express = require("express");
const { GoogleSpreadsheet } = require("google-spreadsheet");

const app = express();
app.use(express.json());

/* ===============================
   META WEBHOOK VERIFICATION
================================ */
app.get("/webhook", (req, res) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified");
    return res.status(200).send(challenge);
  }

  console.log("❌ Webhook verification failed");
  return res.sendStatus(403);
});

/* ===============================
   RECEIVE WHATSAPP MESSAGE
================================ */
app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    const message = value?.messages?.[0];
    if (!message) {
      return res.sendStatus(200);
    }

    const from = message.from; // WhatsApp number
    let responseText = "";

    // BUTTON REPLY
    if (message.button) {
      responseText = message.button.text;
    }

    // TEXT MESSAGE (backup)
    if (message.text) {
      responseText = message.text.body;
    }

    if (!responseText) {
      return res.sendStatus(200);
    }

    console.log("📩 Response from:", from);
    console.log("📝 Message:", responseText);

    let status = "PENDING";
    if (responseText.toLowerCase() === "enter") status = "APPROVED";
    if (responseText.toLowerCase() === "deny") status = "DENIED";

    await updateSheet(from, status);

    res.sendStatus(200);
  } catch (err) {
    console.error("🔥 Webhook Error:", err);
    res.sendStatus(500);
  }
});

/* ===============================
   GOOGLE SHEET UPDATE
================================ */
async function updateSheet(phone, status) {
  const doc = new GoogleSpreadsheet(process.env.SHEET_ID);

  await doc.useServiceAccountAuth({
    client_email: process.env.CLIENT_EMAIL,
    private_key: process.env.PRIVATE_KEY.replace(/\\n/g, "\n"),
  });

  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0];

  const rows = await sheet.getRows();

  for (const row of rows) {
    if (
      row.Owner_WhatsApp === phone &&
      row.Status === "PENDING"
    ) {
      row.Status = status;
      row.Owner_Response = status;
      row.Response_Time = new Date().toLocaleString();
      await row.save();

      console.log("✅ Sheet updated for", phone);
      break;
    }
  }
}

/* ===============================
   START SERVER
================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Webhook running on port ${PORT}`)
);
