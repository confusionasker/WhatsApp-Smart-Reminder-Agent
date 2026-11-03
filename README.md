# WhatsApp Smart Reminder Agent

A production-ready full-stack application for scheduling automated WhatsApp reminders using **WhatsApp Web (QR Code & Phone Pairing Code)**, **Meta WhatsApp Cloud API**, **APScheduler**, and a modern **React 18** dashboard.

---

## 📑 Table of Contents

- [Overview & Architecture](#-overview--architecture)
- [Key Features](#-key-features)
- [Technology Stack](#-technology-stack)
- [Quick Start Guide](#-quick-start-guide)
- [Connecting WhatsApp](#-connecting-whatsapp)
  - [Option A: QR Code Scan (Fastest)](#option-a-qr-code-scan-recommended)
  - [Option B: Phone Number Pairing Code](#option-b-8-digit-phone-pairing-code)
  - [Option C: Meta WhatsApp Cloud API](#option-c-meta-whatsapp-cloud-api-official)
  - [Option D: Demo Mode](#option-d-demo-mode-offline-testing)
- [Environment Variables](#-environment-variables)
- [API Reference](#-api-reference)
- [Database Configuration & Schema](#-database-configuration--schema)
- [Timezone & Scheduling Architecture](#-timezone--scheduling-architecture)
- [AI Natural Language Parsing](#-ai-natural-language-parsing)
- [Automated Testing](#-automated-testing)
- [Project Directory Structure](#-project-directory-structure)
- [Troubleshooting & FAQs](#-troubleshooting--faqs)
- [License](#-license)

---

## 🏛️ Overview & Architecture

WhatsApp Smart Reminder Agent runs a 3-tier architecture ensuring robust message scheduling, cross-device synchronization, and reliable delivery with zero missed jobs:

```text
┌────────────────────────────────────────────────────────┐
│               React 18 SPA (Vite + Tailwind)           │
│         Port: 5173  (Dashboard, Scheduler, Setup)      │
└───────────────────────────┬────────────────────────────┘
                            │ REST API (JWT Authenticated)
┌───────────────────────────▼────────────────────────────┐
│                  Flask 3 Backend API                   │
│         Port: 5000  (Auth, CRUD, Validation)           │
│                                                        │
│  ┌────────────────────────┐  ┌──────────────────────┐  │
│  │  APScheduler 3 Engine  │  │  SQLAlchemy 2 & DB   │  │
│  │  (Idempotent Locking,  │  │  (MySQL 8 / SQLite   │  │
│  │   Restart Recovery)    │  │   Timezone-Aware)    │  │
│  └───────────┬────────────┘  └──────────────────────┘  │
└──────────────┼─────────────────────────────────────────┘
               │ HTTP Message Dispatch / Status
┌──────────────▼─────────────────────────────────────────┐
│         WhatsApp Gateway (Node.js + Baileys)           │
│         Port: 3001  (QR Code, 8-digit Pairing Code)   │
└───────────────────────────┬────────────────────────────┘
                            │ WebSocket / Multi-device Protocol
┌───────────────────────────▼────────────────────────────┐
│                    WhatsApp Network                    │
└────────────────────────────────────────────────────────┘
```

---

## ✨ Key Features

- 📅 **Automated WhatsApp Reminders:** Schedule personalized WhatsApp messages with precise date, time, and custom recipient.
- 📱 **QR Code Login (WhatsApp Web):** Pair your WhatsApp account in seconds via QR scan. **No Meta Developer Account, business tokens, or credit cards required.**
- 🔑 **8-Digit Phone Pairing Code:** Alternative linking method for devices with camera issues or remote browser setups.
- 🛡️ **Meta WhatsApp Cloud API Support:** Fully supports enterprise WhatsApp Business Cloud API accounts.
- 🔄 **Autonomous APScheduler Engine:**
  - Idempotent database locking (`with_for_update`) to prevent duplicate deliveries.
  - Automatic job recovery on server restart from persistent database state.
  - Exponential backoff retry mechanism (up to 3 retries) on transient delivery failures.
- 🕒 **Intelligent Timezone Handling:** Complete UTC normalization with client-side localization across all standard IANA timezones (e.g. `Asia/Kolkata`, `America/New_York`, `UTC`).
- 👥 **Contact Book:** Save, search, and manage frequently used contacts for one-click reminder scheduling.
- 🤖 **AI Smart Reminder Parsing:** Integrates with local Ollama (`mistral` / `llama3`) to parse natural language prompts like *"Remind John tomorrow at 9 AM to submit the report"*.
- 📊 **Real-time Analytics Dashboard:** Comprehensive statistics on total, scheduled, sent, and failed reminders with recent activity tracking.
- 📜 **Full Message Audit History:** Detailed delivery logs with message IDs, timestamps, and error diagnostics.
- 🔒 **Security & Multi-Tenant Isolation:** Password hashing with bcrypt, stateless JWT tokens, and strict per-user database filtering.
- 🧪 **25+ Automated Tests:** Comprehensive Pytest suite covering auth, scheduler recovery, retry logic, and API endpoints.

---

## 🛠️ Technology Stack

| Layer | Technology | Details |
|---|---|---|
| **Frontend** | React 18, Vite 5, Tailwind CSS | Lucide React icons, React Hot Toast, Date-fns, Axios |
| **Backend** | Python 3.12+, Flask 3, Flask-JWT-Extended | SQLAlchemy 2, Marshmallow schemas, Pytz |
| **Scheduler** | APScheduler 3 (BackgroundScheduler) | DB-synced job triggers, exponential retry |
| **WhatsApp Gateway** | Node.js 18+, Express, `@whiskeysockets/baileys` | Multi-device Baileys socket, QR generation, Pairing Code |
| **Database** | MySQL 8.0 (PyMySQL) | SQLite fallback for test suites & isolated environments |
| **Testing** | Pytest, Pytest-Flask, Pytest-Mock | 25 automated integration and unit test suites |
| **AI (Optional)** | Ollama | Local LLM inference for reminder text parsing |

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js** v18+ & npm
- **Python** 3.10+ & pip
- **MySQL** 8.0 (or MySQL via XAMPP / Docker; auto-creates database if permitted)

---

### Step 1: Start WhatsApp Web Gateway (Port 3001)

```bash
cd whatsapp-gateway
npm install
npm start
```
*The gateway starts on `http://localhost:3001` and generates Baileys authentication states.*

---

### Step 2: Start Python Backend (Port 5000)

```bash
cd backend

# Create and activate virtual environment
python -m venv venv

# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# Windows (CMD):
.\venv\Scripts\activate.bat
# Linux / macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run backend server
python app.py
```
*The Flask API starts on `http://localhost:5000`. Database tables and initial configurations are auto-initialized.*

---

### Step 3: Start React Frontend (Port 5173)

```bash
cd frontend
npm install
npm run dev
```

Open your browser and navigate to: **`http://localhost:5173`**

---

## 📱 Connecting WhatsApp

You have four flexible connection options:

### Option A: QR Code Scan (Recommended)
1. In the sidebar, navigate to **Connect WhatsApp** (`/setup`).
2. Keep the **QR Code Scan** tab selected.
3. Open **WhatsApp** on your phone.
4. Tap **Menu (⋮)** on Android or **Settings** on iPhone → **Linked Devices** → **Link a Device**.
5. Point your camera at the screen to scan the QR code.
6. The status will update to **"WhatsApp is Connected"** with your registered phone number and name.

---

### Option B: 8-Digit Phone Pairing Code
If you cannot scan a QR code (e.g., camera problems or remote terminal):
1. Navigate to **Connect WhatsApp** → **Link with Phone Number Code**.
2. Enter your full WhatsApp phone number with country code (e.g. `+919876543210`).
3. Click **Get Pairing Code**.
4. An 8-digit code (e.g. `ABCD-1234`) will appear on screen.
5. On your phone: open **WhatsApp** → **Linked Devices** → **Link with phone number instead**.
6. Enter the 8-digit code displayed on your screen to complete pairing.

---

### Option C: Meta WhatsApp Cloud API (Official)
For official business numbers registered with Meta:
1. In `backend/.env`, set:
   ```env
   WHATSAPP_PROVIDER=meta
   WHATSAPP_ACCESS_TOKEN=your_meta_system_user_token
   WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
   WHATSAPP_BUSINESS_ACCOUNT_ID=your_waba_id
   DEMO_MODE=False
   ```
2. Restart the backend server.

---

### Option D: Demo Mode (Offline Testing)
To test scheduling, dashboard graphs, and retry mechanisms without sending real messages:
```env
DEMO_MODE=True
```

---

## ⚙️ Environment Variables

### Backend Configuration (`backend/.env`)

| Variable | Default Value | Description |
|---|---|---|
| `FLASK_ENV` | `development` | Environment mode (`development` or `production`) |
| `SECRET_KEY` | *(random string)* | Flask session secret key |
| `JWT_SECRET_KEY` | *(random string)* | JWT HMAC signing key |
| `MYSQL_HOST` | `localhost` | MySQL database host |
| `MYSQL_PORT` | `3306` | MySQL database port |
| `MYSQL_USER` | `root` | MySQL username |
| `MYSQL_PASSWORD` | *(empty or custom)* | MySQL password |
| `MYSQL_DATABASE` | `whatsapp_reminder` | MySQL database name |
| `WHATSAPP_PROVIDER` | `qr` | Provider selection: `qr`, `meta`, or `demo` |
| `WHATSAPP_GATEWAY_URL`| `http://localhost:3001` | URL of the local Baileys Node.js gateway |
| `DEMO_MODE` | `False` | When `True`, mocks WhatsApp API calls |
| `OLLAMA_URL` | `http://localhost:11434`| Local Ollama API endpoint |
| `OLLAMA_MODEL` | `mistral:latest` | LLM model for natural language parsing |

### WhatsApp Gateway Configuration (`whatsapp-gateway/.env`)

| Variable | Default Value | Description |
|---|---|---|
| `PORT` | `3001` | Gateway HTTP port |
| `QR_TIMEOUT_MS` | `120000` | QR refresh interval in milliseconds (2 minutes) |

---

## 📡 API Reference

### Authentication Endpoints (`/api/auth`)
- `POST /api/auth/register` — Register a new account (`name`, `email`, `password`).
- `POST /api/auth/login` — Login and receive a JWT Bearer token.
- `GET /api/auth/profile` — Get the authenticated user's profile (`Bearer Token` required).

### Reminders Endpoints (`/api/reminders`)
- `GET /api/reminders` — Paginated list of reminders with search and status filters (`page`, `per_page`, `search`, `status`).
- `POST /api/reminders` — Schedule a new reminder:
  ```json
  {
    "recipient_name": "John Doe",
    "phone_number": "+919876543210",
    "message": "Project sprint starts in 15 minutes",
    "scheduled_date": "2026-11-04",
    "scheduled_time": "10:30",
    "timezone": "Asia/Kolkata"
  }
  ```
- `GET /api/reminders/<id>` — Retrieve reminder details and associated delivery message logs.
- `PUT /api/reminders/<id>` — Update an un-sent reminder.
- `POST /api/reminders/<id>/cancel` — Cancel a scheduled reminder and de-register its background trigger.
- `POST /api/reminders/<id>/retry` — Re-queue a failed reminder for immediate retry.
- `DELETE /api/reminders/<id>` — Delete a reminder.

### Contacts Endpoints (`/api/contacts`)
- `GET /api/contacts` — List all saved contacts with search and pagination.
- `POST /api/contacts` — Add a new contact (`contact_name`, `phone_number`).
- `PUT /api/contacts/<id>` — Update contact details.
- `DELETE /api/contacts/<id>` — Remove a contact.

### Dashboard Endpoints (`/api/dashboard`)
- `GET /api/dashboard/stats` — Overall statistics (`total`, `pending`, `scheduled`, `sent`, `failed`, `cancelled`, `upcoming_24h`).
- `GET /api/dashboard/recent-activity` — 10 most recent reminder activities.
- `GET /api/dashboard/upcoming` — Next 5 upcoming reminders in chronological order.

### WhatsApp Bridge Endpoints (`/api/whatsapp`)
- `GET /api/whatsapp/status` — Current WhatsApp connection status and linked account details.
- `GET /api/whatsapp/qr` — Get active QR code data (base64 image data URL).
- `POST /api/whatsapp/refresh-qr` — Force generation of a fresh QR code.
- `POST /api/whatsapp/pairing-code` — Request an 8-digit phone pairing code.
- `POST /api/whatsapp/send-test` — Send an immediate test message to verify delivery.
- `POST /api/whatsapp/logout` — Disconnect WhatsApp session and clear credentials.

### AI Endpoints (`/api/ai`)
- `POST /api/ai/parse-reminder` — Parse natural language prompt into structured fields:
  ```json
  {
    "prompt": "Remind Dr. Smith next Monday at 2:30 PM for dental checkup"
  }
  ```

---

## 🗄️ Database Configuration & Schema

The application uses SQLAlchemy with auto-creation support. If connecting to a local MySQL instance, the backend automatically issues `CREATE DATABASE IF NOT EXISTS whatsapp_reminder`.

You can also initialize the database manually:
```bash
mysql -u root -p < database/schema.sql
```

### Relational Schema Design:
- **`users`**: User credentials, password hashes, and profile metadata.
- **`contacts`**: Saved contacts tied to specific users with unique constraints on `(user_id, phone_number)`.
- **`reminders`**: Core reminder records with UTC `scheduled_at`, user timezone, message text, and execution status (`PENDING`, `SCHEDULED`, `PROCESSING`, `SENT`, `FAILED`, `CANCELLED`).
- **`message_logs`**: Delivery audit trail containing WhatsApp message IDs, delivery statuses (`ACCEPTED`, `SENT`, `DELIVERED`, `READ`, `FAILED`), and API error messages.

---

## 🕒 Timezone & Scheduling Architecture

1. **Client Submission:** Users select a date, time, and target timezone in the UI (e.g. `11:30 PM`, `Asia/Kolkata`).
2. **Backend Normalization:** The backend (`parse_scheduled_datetime`) combines the date and time, localizes it to the specified timezone using `pytz`, and converts it to a UTC-aware datetime (`2026-11-03 18:00:00 UTC`).
3. **Storage:** Stored in MySQL as UTC.
4. **API Responses:** All datetime values are formatted with `format_iso_utc` to produce strict UTC ISO-8601 strings ending in `Z` (e.g., `2026-11-03T18:00:00Z`).
5. **Client Presentation:** The frontend [`formatDate`](frontend/src/utils/date.js) utility uses `Intl.DateTimeFormat` with the reminder's target timezone (`r.timezone`), guaranteeing accurate time display on any device worldwide.

---

## 🤖 AI Natural Language Parsing

The application supports zero-configuration local AI parsing via Ollama:

1. Install [Ollama](https://ollama.ai).
2. Download your preferred model:
   ```bash
   ollama pull mistral:latest
   ```
3. Ensure Ollama is running (`http://localhost:11434`).
4. In the **New Reminder** form, enter natural language text in the AI box and click **Parse with AI**. The form automatically populates the recipient name, phone number (if mentioned), message body, date, and time.

---

## 🧪 Automated Testing

Run the full automated test suite using pytest:

```bash
cd backend
.\venv\Scripts\activate
pytest tests/ -v
```

### Verified Test Suites (25 passing):
- `TestAuth`: User registration, unique emails, invalid emails, password length validation, login, profile authorization, and JWT authentication tokens.
- `TestContacts`: Contact creation, Indian/International phone number normalization, contacts pagination, updates, and cascading deletion.
- `TestReminders`: Valid reminder scheduling, past time rejection, cancellation, deletion, and duplicate submission prevention.
- `TestScheduler`: Scheduled job verification, past reminder handling, and database restart recovery.
- `TestWhatsAppService`: Demo mode verification, gateway failure handling, phone format validation, and exponential backoff retry.

---

## 📂 Project Directory Structure

```text
WhatsApp-Smart-Reminder-Agent/
├── whatsapp-gateway/                  # WhatsApp Web Baileys Bridge
│   ├── auth_info_baileys/            # Multi-device session credentials
│   ├── server.js                     # Express API (QR code & message gateway)
│   └── package.json                  # Baileys & Express dependencies
│
├── backend/                          # Python Flask API & Scheduler
│   ├── app/
│   │   ├── config/settings.py        # Development, Testing, Production configs
│   │   ├── models/models.py          # SQLAlchemy User, Contact, Reminder, MessageLog
│   │   ├── routes/                   # REST API Blueprints
│   │   │   ├── auth.py               # Registration, login, profile
│   │   │   ├── reminders.py          # Reminder CRUD & state management
│   │   │   ├── contacts.py           # Contact book operations
│   │   │   ├── dashboard.py          # Analytics and upcoming reminder queries
│   │   │   ├── whatsapp.py           # WhatsApp connection & test dispatch
│   │   │   └── ai.py                 # Ollama natural language parsing
│   │   ├── scheduler/scheduler.py    # APScheduler with idempotent row locking
│   │   ├── services/                 # Dual provider (Baileys QR & Meta Cloud API)
│   │   └── utils/helpers.py          # Phone normalization & timezone conversion
│   ├── tests/test_app.py             # 25 automated unit & integration tests
│   ├── app.py                        # Flask server entrypoint
│   └── requirements.txt              # Python dependencies
│
├── frontend/                         # React 18 SPA
│   ├── src/
│   │   ├── components/               # Layout, Navigation Sidebar, StatusBadges
│   │   ├── pages/                    # Core Application Views
│   │   │   ├── Dashboard.jsx         # Analytics, metrics, activity feed
│   │   │   ├── CreateReminder.jsx    # Scheduler form with AI smart parse
│   │   │   ├── Reminders.jsx         # Table view with filters, retry, cancel
│   │   │   ├── Contacts.jsx          # Contact directory
│   │   │   ├── WhatsAppSetup.jsx     # QR Code & Phone Pairing Code wizard
│   │   │   ├── MessageHistory.jsx    # Delivery logs with error details
│   │   │   ├── Settings.jsx          # WhatsApp provider configuration
│   │   │   ├── Login.jsx             # User sign-in
│   │   │   └── Register.jsx          # New user registration
│   │   ├── services/api.js           # Axios HTTP client with JWT interceptor
│   │   └── utils/date.js             # Timezone-aware date formatting
│   ├── vite.config.js                # Vite build setup
│   └── package.json                  # React & Tailwind dependencies
│
├── database/
│   └── schema.sql                    # MySQL production schema with indexes
└── README.md                         # Project documentation
```

---

## ❓ Troubleshooting & FAQs

### 1. The QR code expired before I could scan it
- Click the **Refresh QR** button in the dashboard. The QR code timeout is configured for 2 minutes to provide plenty of scanning time.

### 2. Can I link with phone number instead of scanning QR?
- Yes. Select the **Link with Phone Number Code** tab on the **Connect WhatsApp** page, enter your phone number, and enter the 8-digit code on your WhatsApp mobile app under **Linked Devices**.

### 3. I sent a test message to my own number, but I didn't hear a notification ringtone
- When WhatsApp sends a message to its own active number, it is placed in your **"Message yourself" / "You"** chat. WhatsApp does not trigger push notification sounds for self-messages. To test external notifications, send a message to a friend or another phone.

### 4. Why does the scheduled time look different from UTC?
- Reminders are stored in UTC internally and converted to the reminder's target timezone (`Asia/Kolkata` by default) in the UI. Ensure your device clock is accurate.

### 5. Messages are showing "Success" in UI, but not delivering to WhatsApp
- Check `backend/.env` and verify that `DEMO_MODE=False`. If `DEMO_MODE=True`, messages are simulated locally for offline testing.

---

## 📜 License

This project is licensed under the **MIT License**. Free for personal, commercial, and educational use.
