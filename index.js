const express = require("express");
const bodyParser = require("body-parser");
const { GoogleSpreadsheet } = require("google-spreadsheet");

const app = express();
app.use(bodyParser.json());

/* ===============================
   VERIFY WEBHOOK (Meta step)
================================ */
app.get("/webhook", (req, res) => {
  const VERIFY_TOKEN = "verify123";

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

/* ===============================
   RECEIVE WHATSAPP RESPONSE
================================ */
app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    const message = value?.messages?.[0];
    if (!message) return res.sendStatus(200);

    const from = message.from; // owner phone
    const buttonText = message.button?.text;

    if (!buttonText) return res.sendStatus(200);

    const status =
      buttonText === "Enter" ? "APPROVED" : "DENIED";

    await updateSheet(from, status);

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

/* ===============================
   GOOGLE SHEET UPDATE
================================ */
async function updateSheet(phone, status) {
  const doc = new GoogleSpreadsheet("1eDFCwhG-PmHz4s3TMbTpR4_dacYt4cXbKARNs_-zDG4");

  await doc.useServiceAccountAuth({
    client_email: process.env.CLIENT_EMAIL,
    private_key: process.env.PRIVATE_KEY.replace(/\\n/g, "\n")
  });

  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0];

  const rows = await sheet.getRows();

  for (const row of rows) {
    if (row.Owner_WhatsApp === phone && row.Status === "PENDING") {
      row.Status = status;
      row.Owner_Response = status;
      row.Response_Time = new Date().toLocaleString();
      await row.save();
      break;
    }
  }
}

app.listen(3000, () => console.log("Webhook running"));
