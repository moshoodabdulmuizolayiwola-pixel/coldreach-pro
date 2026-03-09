import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { google } from "googleapis";
import Database from "better-sqlite3";
import cron from "node-cron";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// --- Database Setup ---
const db = new Database("coldreach.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expiry_date INTEGER NOT NULL,
    stage INTEGER DEFAULT 1,
    reputation_score INTEGER DEFAULT 50,
    target_send INTEGER DEFAULT 5,
    sent_count INTEGER DEFAULT 0,
    spam_rate INTEGER DEFAULT 0,
    delivery_count INTEGER DEFAULT 0,
    inbox_rate INTEGER DEFAULT 0,
    reversed_count INTEGER DEFAULT 0,
    is_warming_up BOOLEAN DEFAULT 0,
    send_interval_seconds INTEGER DEFAULT 300,
    last_sent_at INTEGER DEFAULT 0,
    daily_limit INTEGER DEFAULT 5,
    daily_sent INTEGER DEFAULT 0,
    last_reset_date TEXT DEFAULT ''
  );
`);

// Add new columns to existing table if they don't exist
try {
  db.exec("ALTER TABLE accounts ADD COLUMN last_sent_at INTEGER DEFAULT 0");
} catch (e) { /* Ignore if column exists */ }
try {
  db.exec("ALTER TABLE accounts ADD COLUMN daily_limit INTEGER DEFAULT 5");
} catch (e) { /* Ignore if column exists */ }
try {
  db.exec("ALTER TABLE accounts ADD COLUMN daily_sent INTEGER DEFAULT 0");
} catch (e) { /* Ignore if column exists */ }
try {
  db.exec("ALTER TABLE accounts ADD COLUMN last_reset_date TEXT DEFAULT ''");
} catch (e) { /* Ignore if column exists */ }
try {
  db.exec("ALTER TABLE accounts ADD COLUMN reply_rate INTEGER DEFAULT 0");
} catch (e) { /* Ignore if column exists */ }

// --- OAuth Setup ---
function getOAuth2Client(redirectUri?: string) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in environment variables.');
  }
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
}

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email'
];

// --- API Routes ---

app.get('/api/auth/url', (req, res) => {
  const redirectUri = req.query.redirect_uri as string;
  const client = getOAuth2Client(redirectUri);
  const state = redirectUri ? Buffer.from(JSON.stringify({ redirectUri })).toString('base64') : undefined;
  
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Force to get refresh token
    state
  });
  res.json({ url });
});

app.get('/api/auth/redirect', (req, res) => {
  const redirectUri = req.query.redirect_uri as string;
  const client = getOAuth2Client(redirectUri);
  const state = redirectUri ? Buffer.from(JSON.stringify({ redirectUri })).toString('base64') : undefined;
  
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state
  });
  res.redirect(url);
});

app.get('/oauth2callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) {
    return res.status(400).send('No code provided');
  }

  let redirectUri: string | undefined;
  if (state) {
    try {
      const decodedState = JSON.parse(Buffer.from(state as string, 'base64').toString('utf-8'));
      if (decodedState.redirectUri) {
        redirectUri = decodedState.redirectUri;
      }
    } catch (e) {
      console.error('Failed to parse state', e);
    }
  }

  const client = getOAuth2Client(redirectUri);

  try {
    const { tokens } = await client.getToken(code as string);
    client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email;

    if (!email) {
      throw new Error('Could not retrieve email address');
    }

    // Check if max accounts reached (2000)
    const countStmt = db.prepare('SELECT COUNT(*) as count FROM accounts');
    const countResult = countStmt.get() as { count: number };
    if (countResult.count >= 2000) {
      return res.send(`
        <html><body>
          <script>
            try {
              const bc = new BroadcastChannel('oauth_channel');
              bc.postMessage({ type: 'OAUTH_AUTH_ERROR', error: 'Maximum of 2000 accounts reached.' });
            } catch(e) {}
            
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: 'Maximum of 2000 accounts reached.' }, '*');
            }
            
            setTimeout(() => {
              window.close();
              const msg = document.getElementById('msg');
              if (msg) msg.innerText = 'Maximum of 2000 accounts reached. You can now close this window.';
            }, 500);
          </script>
          <p id="msg">Maximum of 2000 accounts reached. This window should close automatically...</p>
        </body></html>
      `);
    }

    const stmt = db.prepare(`
      INSERT INTO accounts (email, access_token, refresh_token, expiry_date)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        expiry_date = excluded.expiry_date
    `);
    
    stmt.run(
      email,
      tokens.access_token,
      tokens.refresh_token || '', // Sometimes refresh token is not returned if already authorized, but we requested prompt=consent
      tokens.expiry_date || 0
    );

    res.send(`
      <html><body>
        <script>
          try {
            const bc = new BroadcastChannel('oauth_channel');
            bc.postMessage({ type: 'OAUTH_AUTH_SUCCESS' });
          } catch(e) {}
          
          if (window.opener) {
            window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
            window.opener.location.href = window.opener.location.origin;
          }
          
          setTimeout(() => {
            window.close();
            const msg = document.getElementById('msg');
            if (msg) msg.innerText = 'Authentication successful. You can now close this window and return to the app.';
          }, 500);
        </script>
        <p id="msg">Authentication successful. This window should close automatically...</p>
      </body></html>
    `);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send('Authentication failed');
  }
});

app.get('/api/accounts', (req, res) => {
  const stmt = db.prepare('SELECT id, email, stage, reputation_score, target_send, sent_count, spam_rate, delivery_count, inbox_rate, reversed_count, is_warming_up, send_interval_seconds FROM accounts');
  const accounts = stmt.all();
  res.json(accounts);
});

app.post('/api/accounts/:id/warmup', (req, res) => {
  const { id } = req.params;
  const { is_warming_up } = req.body;
  
  const stmt = db.prepare('UPDATE accounts SET is_warming_up = ? WHERE id = ?');
  stmt.run(is_warming_up ? 1 : 0, id);
  
  res.json({ success: true });
});

app.post('/api/accounts/:id/settings', (req, res) => {
  const { id } = req.params;
  const { target_send, send_interval_seconds } = req.body;
  
  const stmt = db.prepare('UPDATE accounts SET target_send = ?, send_interval_seconds = ? WHERE id = ?');
  stmt.run(target_send, send_interval_seconds, id);
  
  res.json({ success: true });
});

app.delete('/api/accounts/:id', (req, res) => {
  const { id } = req.params;
  const stmt = db.prepare('DELETE FROM accounts WHERE id = ?');
  stmt.run(id);
  res.json({ success: true });
});

// --- Warm-Up Engine ---
// Runs every minute to check if any account needs to send an email based on its interval and target
cron.schedule('* * * * *', async () => {
  console.log('Running Warm-Up Engine cycle...');
  const now = Date.now();
  const today = new Date().toISOString().split('T')[0];

  // Reset daily counts if it's a new day
  const resetStmt = db.prepare('UPDATE accounts SET daily_sent = 0, last_reset_date = ? WHERE last_reset_date != ?');
  resetStmt.run(today, today);

  // Get active accounts that haven't reached their daily limit and are ready to send based on interval
  const stmt = db.prepare(`
    SELECT * FROM accounts 
    WHERE is_warming_up = 1 
      AND daily_sent < daily_limit
      AND (? - last_sent_at) >= (send_interval_seconds * 1000)
  `);
  const activeAccounts = stmt.all(now) as any[];

  for (const account of activeAccounts) {
    try {
      // 1. Refresh token if needed
      const client = getOAuth2Client();
      client.setCredentials({
        access_token: account.access_token,
        refresh_token: account.refresh_token,
        expiry_date: account.expiry_date
      });

      const gmail = google.gmail({ version: 'v1', auth: client });
      
      // 2. Construct a warmup email with variations
      const subjects = [
        "Quick question about your services",
        "Following up on our last conversation",
        "Checking in",
        "Hello from a new connection",
        "Thoughts on recent industry trends?"
      ];
      const bodies = [
        "Hi there,\n\nI hope this email finds you well. I was just reaching out to see if you'd be open to a quick chat next week.\n\nBest regards,\n",
        "Hello,\n\nJust a quick note to say hi and connect. Let me know if you have some time to catch up.\n\nThanks,\n",
        "Hey,\n\nI came across your profile and thought it would be great to connect. Hope you're having a good week.\n\nCheers,\n"
      ];

      const randomSubject = subjects[Math.floor(Math.random() * subjects.length)];
      const randomBody = bodies[Math.floor(Math.random() * bodies.length)];
      
      const subject = `${randomSubject} - ${Date.now().toString().slice(-4)}`;
      const body = `${randomBody}${account.email}`;
      
      const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
      const messageParts = [
        `From: ${account.email}`,
        `To: ${account.email}`, // Send to self for basic warmup, or a pool of warmup addresses
        `Subject: ${utf8Subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=utf-8',
        '',
        body
      ];
      const message = messageParts.join('\r\n');
      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      // 3. Send email
      await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage
        }
      });

      // 4. Update stats and reputation
      // Simulate reputation changes based on successful sends
      let newReputation = account.reputation_score;
      let newStage = account.stage;
      let newDailyLimit = account.daily_limit;

      if (account.daily_sent + 1 >= account.daily_limit) {
        // End of day processing for this account
        if (account.spam_rate < 5 && account.reversed_count < 2) {
          newReputation = Math.min(100, newReputation + 2);
        } else {
          newReputation = Math.max(0, newReputation - 5);
        }

        // Stage progression logic
        if (newReputation > 80 && newStage < 4) {
          newStage++;
          newDailyLimit = Math.min(50, newDailyLimit + 5); // Increase limit
        } else if (newReputation < 40 && newStage > 1) {
          newStage--;
          newDailyLimit = Math.max(2, newDailyLimit - 5); // Decrease limit
        }
      }

      const newReplyRate = Math.min(100, Math.max(0, Math.floor(newReputation / 2) + Math.floor(Math.random() * 15)));

      const updateStmt = db.prepare(`
        UPDATE accounts 
        SET sent_count = sent_count + 1, 
            daily_sent = daily_sent + 1,
            delivery_count = delivery_count + 1,
            inbox_rate = CASE WHEN sent_count + 1 > 0 THEN ((delivery_count + 1) * 100) / (sent_count + 1) ELSE 0 END,
            reply_rate = ?,
            last_sent_at = ?,
            reputation_score = ?,
            stage = ?,
            daily_limit = ?
        WHERE id = ?
      `);
      updateStmt.run(newReplyRate, Date.now(), newReputation, newStage, newDailyLimit, account.id);
      
      console.log(`Warmup email sent for ${account.email}`);

    } catch (error) {
      console.error(`Failed to send warmup email for ${account.email}:`, error);
      // Update reversed count and penalize reputation on failure
      const failStmt = db.prepare(`
        UPDATE accounts 
        SET reversed_count = reversed_count + 1,
            reputation_score = MAX(0, reputation_score - 2),
            last_sent_at = ?
        WHERE id = ?
      `);
      failStmt.run(Date.now(), account.id);
    }
  }
});

// --- Vite Middleware ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile('index.html', { root: 'dist' });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
