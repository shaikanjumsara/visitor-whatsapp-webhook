const express = require("express");
const bodyParser = require("body-parser");
const { GoogleSpreadsheet } = require("google-spreadsheet");

const app = express();
app.use(bodyParser.json());

/* ===============================
   CONFIG (EDIT ONLY THIS PART)
================================ */

// Google Sheet ID (already correct)
const SHEET_ID = "1eDFCwhG-PmHz4s3TMbTpR4_dacYt4cXbKARNs_-zDG4";

// From service account JSON
const CLIENT_EMAIL = "visitor-sheet-bot@visitorsystem-486812.iam.gserviceaccount.com";

// Paste PRIVATE KEY EXACTLY from JSON
const PRIVATE_KEY = `
-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDi/alFj1stUOd/\nCtg0C+LUWGJx28W9A+5hYxkTcE8apWVx7EtrPoXohaObW/EglgKxTa6aYipeYwTE\nWQ0NZ7SAS+UXUEZtKnVz3ZrHPjOIEu7mn1lkmBGf0azBnF555TuXyK0YsZXHN4Z9\nilasDFEuSoKZAbsJ47JzIyWXuZ0sKV57TaNCzfTYzWM6mttFerHwb6X5CUThS7H6\niUqlrrfdk4XErOlZ/LrjLu8QWN9fq6FgsKHJgcKdt89k0UNadtqOzO0oHoV4VcTL\nz0X4OMoYUznIHgemNxoHY1ai8hqZxyH2PZewbJyUd6K8RWY1Jw7LbocaOgUm3Ku7\nyKP1aY7tAgMBAAECggEABtMbwdlkTfm9fWfuUFbzetvDGUtuB8zkin2KrWIGTYBf\ntdvl+ENmOR48KR7hIlAYTyE33huUTLJbRusAKzZtFSFoXHnU+ucYpm3pKiiQLz0V\n0o3Dx97m7Wrwr9aGJFHp0i+zUpzTlRcx3jg9+wjDb79HlhbuUHG4iwvUD2/XeP0h\nQ4ioCrMwW+6+owtijTjNjxlRSsmeggauVKjuM+QslYFwItqi/7ijuqQSBPMVl1R5\nQ+w77bfdirShM3YVzq6xR9EclXs/LkFPJVQ98T9tkXsdhrpciLW1z+BQUww0+xf7\nGh6hTz+Ws3J1i4blVhMoNREjirJA3nQYqqMRqIcAGQKBgQDzGj7Ciy4w5qvjeiNc\nSuC7oiP5SCP1Ir0xbMU3ZrVltPGn9C1kW0pwOeD7KyIXJ9hyePWk2zeMd0KYwafV\nkIKie/b74WqzAMD8Pu2HPutq0I3BnN3Yh584Wdq7e1FT3FEeXwyEjy8XaTHXmiHz\nKuhqR9t0wT2URFqP7KWRMU34pQKBgQDvCJd91T+uO6y70FuSbn/rbUP4HlsDw7qe\nTgx1nrLtnoXI8hoBN/PKHFJ35K5LRCBoybf0Q8XPInvaAIyZnRDncfEODXYe53d/\nuNepl1r5EL9O2j+N9sXkhmDbPvHl3xVOHsGtD0JmGi2No4xYs8LP7ApvGcX2eLwa\nZJpg/7iiqQKBgAMqA0ka8KX4SqJyU4V+///RM3CqLLWjFx1Okh6PeqrxOPf7qJ+W\nxJhDWJdMT2xHu3x58JCNveJZJwe/9YRFFj4xKNzMaUwdJWXjF8pb2kqQnle3x/dq\nhHsCSGOKTluuEWw4xnvvNSiz2M86lViJ5W6EsumJHlkQrrES3nDOWHp1AoGBAM+p\nvzLq2PAdl+tzEJsetLNrsekVNi0HFlIBrIFi5j/ZwJDbBAya94lXIa5XVbS98woW\ndWIYnvldFAxI/d1WvyDTtIBo4X3nycGEbJhBjh9jlVCD+0LyaOoodG0FOlJihLfh\nsJEQ+LaLd5fdxkgpo83PWyE6WunN6l1jmVs7zsRBAoGBAM+FHnobW/LzgDC/7iCx\nU54ly95cPXmVUoJlB/nUMDHcEK9fLgY44dEztyqLCVzvSahqxX0ORYwY/g15bC4L\n8tpheXcVJgPaGZKfXOVuA/ee0Ovjcp719TeaC2FaJ57rwSiguVeB6o5DDi1Igi9k\n1GHA4JhRpNGbqHH05UWNFiKM\n-----END PRIVATE KEY-----
`.replace(/\\n/g, "\n");

// Webhook verify token (same as Meta dashboard)
const VERIFY_TOKEN = "verify123";

/* ===============================
   VERIFY WEBHOOK (Meta)
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
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    const message = value?.messages?.[0];
    if (!message) return res.sendStatus(200);

    const from = message.from; // WhatsApp number
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
  const doc = new GoogleSpreadsheet(SHEET_ID);

  await doc.useServiceAccountAuth({
    client_email: CLIENT_EMAIL,
    private_key: PRIVATE_KEY
  });

  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0];

  const rows = await sheet.getRows();

  let updated = false;

  for (const row of rows) {
    if (
      row.Owner_WhatsApp?.toString().trim() === phone.toString().trim() &&
      row.Status === "PENDING"
    ) {
      row.Status = status;
      row.Owner_Response = status;
      row.Response_Time = new Date().toLocaleString();

      await row.save();
      updated = true;
      console.log("✅ Sheet updated for", phone);
      break;
    }
  }

  if (!updated) {
    console.log("⚠️ No matching PENDING row found");
  }
}

/* ===============================
   START SERVER
================================ */
app.listen(3000, () => {
  console.log("🚀 Webhook running on port 3000");
});
