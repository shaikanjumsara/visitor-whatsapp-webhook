

const express = require("express");
const bodyParser = require("body-parser");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");

const app = express();
app.use(bodyParser.json());

/* ===============================
   CONFIG
================================ */
const SHEET_ID = "1eDFCwhG-PmHz4s3TMbTpR4_dacYt4cXbKARNs_-zDG4";
const VERIFY_TOKEN = "verify123";

const CLIENT_EMAIL =
  "visitor-sheet-bot@visitorsystem-486812.iam.gserviceaccount.com";

const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDi/alFj1stUOd/
Ctg0C+LUWGJx28W9A+5hYxkTcE8apWVx7EtrPoXohaObW/EglgKxTa6aYipeYwTE
WQ0NZ7SAS+UXUEZtKnVz3ZrHPjOIEu7mn1lkmBGf0azBnF555TuXyK0YsZXHN4Z9
ilasDFEuSoKZAbsJ47JzIyWXuZ0sKV57TaNCzfTYzWM6mttFerHwb6X5CUThS7H6
iUqlrrfdk4XErOlZ/LrjLu8QWN9fq6FgsKHJgcKdt89k0UNadtqOzO0oHoV4VcTL
z0X4OMoYUznIHgemNxoHY1ai8hqZxyH2PZewbJyUd6K8RWY1Jw7LbocaOgUm3Ku7
yKP1aY7tAgMBAAECggEABtMbwdlkTfm9fWfuUFbzetvDGUtuB8zkin2KrWIGTYBf
tdvl+ENmOR48KR7hIlAYTyE33huUTLJbRusAKzZtFSFoXHnU+ucYpm3pKiiQLz0V
0o3Dx97m7Wrwr9aGJFHp0i+zUpzTlRcx3jg9+wjDb79HlhbuUHG4iwvUD2/XeP0h
Q4ioCrMwW+6+owtijTjNjxlRSsmeggauVKjuM+QslYFwItqi/7ijuqQSBPMVl1R5
Q+w77bfdirShM3YVzq6xR9EclXs/LkFPJVQ98T9tkXsdhrpciLW1z+BQUww0+xf7
Gh6hTz+Ws3J1i4blVhMoNREjirJA3nQYqqMRqIcAGQ
-----END PRIVATE KEY-----`;

/* ===============================
   VERIFY WEBHOOK
================================ */
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified");
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

/* ===============================
   RECEIVE WHATSAPP RESPONSE
================================ */
app.post("/webhook", async (req, res) => {
  try {
    const message =
      req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) return res.sendStatus(200);

    const from = message.from;
    const buttonText = message.button?.text;

    if (!buttonText) return res.sendStatus(200);

    const status = buttonText === "Enter" ? "APPROVED" : "DENIED";

    console.log("📩 Response from:", from, status);

    await updateSheet(from, status);

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.sendStatus(500);
  }
});

/* ===============================
   UPDATE GOOGLE SHEET
================================ */
async function updateSheet(phone, status) {
  const auth = new JWT({
    email: CLIENT_EMAIL,
    key: PRIVATE_KEY,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const doc = new GoogleSpreadsheet(SHEET_ID, auth);

  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0];
  const rows = await sheet.getRows();

  for (const row of rows) {
    if (
      row.Owner_WhatsApp?.toString().trim() === phone &&
      row.Status === "PENDING"
    ) {
      row.Status = status;
      row.Owner_Response = status;
      row.Response_Time = new Date().toLocaleString();
      await row.save();

      console.log("✅ Sheet updated");
      return;
    }
  }

  console.log("⚠️ No matching PENDING row");
}

/* ===============================
   START SERVER
================================ */
app.listen(3000, () => {
  console.log("🚀 Webhook running on port 3000");
});
