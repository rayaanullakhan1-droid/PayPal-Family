# PayPal Family 💳👨‍👩‍👧‍👦

> **Full-Stack Fintech Web Application for Family Financial Oversight, Automated Allowances, and Smart AI Spending Guidance**
>
> *Disclaimer: PayPal Family is an independent prototype web application developed for hackathon demonstration. It incorporates official PayPal Sandbox APIs and Google Gemini AI alongside simulated family banking workflows. All internal wallet balances represent simulated play funds for safe demonstration.*

---

## 1. Executive Summary & Hackathon Integration

PayPal Family empowers family heads (administrators) to grant guided financial independence to dependents (children, students, or family members). The central administrator allocates a shared family fund, configures single-transaction caps, daily allowances, monthly spending ceilings, and payment channel permissions (transfers vs. merchant QR payments). Dependents can request money with automated limit evaluation or scan supported merchant QR codes to complete purchases.

### Hackathon Core Requirement 1: Official PayPal Technology Integration
- **Official PayPal SDK & UI Components**: Integrated [`@paypal/react-paypal-js`](https://www.npmjs.com/package/@paypal/react-paypal-js) (`PayPalScriptProvider` & `PayPalButtons`) on the frontend for genuine PayPal Checkout experiences.
- **Secure Backend API Gateway**: Node.js & Express backend ([`server/index.js`](file:///C:/Users/User%20PC/.gemini/antigravity/scratch/paypal-family/server/index.js)) implementing server-to-server communication with PayPal Sandbox REST APIs.
- **PayPal Orders v2 API**:
  - `POST /api/paypal/create-order` -> Dispatches authenticated order creation to PayPal Sandbox (`/v2/checkout/orders`) with customizable amounts and currency parameters.
  - `POST /api/paypal/capture-order` -> Verifies and captures approved authorizations (`/v2/checkout/orders/:id/capture`), validating `COMPLETED` order status before updating the application's ledger.
- **Client Secret Isolation**: PayPal Client ID and Secret (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`) reside exclusively on the server. The secret key is never bundled, leaked, or exposed to the client-side bundle.

### Hackathon Core Requirement 2: Official Google Gemini AI Integration
- **Official Google GenAI SDK**: Implemented using [`@google/genai`](https://www.npmjs.com/package/@google/genai) on the Node.js backend.
- **Model**: Powered by `gemini-2.5-flash` for high-speed, contextual financial reasoning.
- **Contextual Financial Grounding**: The AI assistant does not operate blindly. On every prompt, a sanitized financial snapshot is injected—including administrator fund balance, registered family members, spending limits, daily/monthly consumption, recent transaction ledger, and pending approval requests.
- **Fintech Safety Boundary**: The AI assistant operates strictly as an advisory service. System instructions strictly forbid altering account balances, bypassing spending caps, or executing transactions directly.
- **Zero-Failure Fallback Engine**: If a Gemini API key is not supplied or network connectivity is interrupted, the frontend automatically falls back to an internal deterministic fintech intelligence engine.

---

## 2. Architecture & Service Boundaries

```
┌────────────────────────────────────────────────────────────────────────┐
│                        REACT FRONTEND (Vite SPA)                       │
│  - Role-Based Views (Admin & Member Dashboards)                        │
│  - PhonePe / Google Pay Style Bank Discovery Experience                │
│  - Dynamic Limit Evaluation & Instant Auto-Transfer Engine             │
│  - HTML5 Camera & SVG QR Merchant Scanner                              │
│  - @paypal/react-paypal-js Checkout Buttons (Add Money Modal)         │
│  - AI Spending Assistant Chat UI (Dual Gemini / Local Fallback Badges)  │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                 Vite Reverse Proxy (/api -> :5000)
                                     │
┌────────────────────────────────────▼───────────────────────────────────┐
│                    NODE.JS / EXPRESS BACKEND SERVER                     │
│  - Port 5000 (CORS & JSON Middleware)                                  │
│  - PayPal Sandbox OAuth2 Token & Orders v2 Management                  │
│  - Google GenAI SDK (@google/genai) Pipeline                           │
└──────────────────────┬──────────────────────────┬──────────────────────┘
                       │                          │
        OAuth 2.0 / HTTPS REST             Google GenAI SDK
                       │                          │
┌──────────────────────▼───────┐   ┌──────────────▼──────────────────────┐
│     PAYPAL SANDBOX APIS      │   │       GOOGLE GEMINI AI API          │
│  - POST /v1/oauth2/token     │   │  - Model: gemini-2.5-flash          │
│  - POST /v2/checkout/orders  │   │  - Context: Full Financial Snapshot │
│  - POST .../capture          │   │  - Structured Fintech Advising      │
└──────────────────────────────┘   └─────────────────────────────────────┘
```

### Real External Services vs. Simulated Prototype Elements

| Feature / Domain | Integration Type | Mechanism / Provider | Details |
| :--- | :---: | :--- | :--- |
| **Add Money via PayPal** | **REAL EXTERNAL** | PayPal Sandbox Checkout | Uses `@paypal/react-paypal-js` & PayPal Orders v2 API via backend server. |
| **AI Spending Assistant** | **REAL EXTERNAL** | Google Gemini (`gemini-2.5-flash`) | Uses official `@google/genai` SDK with real-time financial snapshot context. |
| **AI Fallback Engine** | **LOCAL EMBEDDED** | Rule-Based Symbolic NLP | Deterministic local regex and arithmetic engine active if API keys are omitted. |
| **Family Ledger & Wallets** | **SIMULATED** | LocalStorage & React Context | Integer paise double-entry ledger managing simulated family pool and balances. |
| **Bank Account Discovery** | **SIMULATED** | Mock FinTech Discovery Service | PhonePe/GPay-style UI simulating multi-bank discovery and verified badge transitions. |
| **Merchant QR Payments** | **SIMULATED** | HTML5 Camera & Mock Merchants | Scans `paypal_family_qr_v1` merchant payloads and debits member personal balance. |

---

## 3. Technology Stack

- **Frontend Core**: [React 18.3](https://react.dev/), [TypeScript 5.5](https://www.typescriptlang.org/), [Vite 5.4](https://vitejs.dev/)
- **Styling**: [Tailwind CSS 3.4](https://tailwindcss.com/) with PayPal fintech palette (`#0070E0`, `#12304A`, `#16803C`, `#DC2626`)
- **PayPal Integration**: Official [`@paypal/react-paypal-js`](https://www.npmjs.com/package/@paypal/react-paypal-js) (v10.6.1)
- **AI SDK**: Official [`@google/genai`](https://www.npmjs.com/package/@google/genai) (v2.32.0)
- **Backend Server**: [Express 5.3](https://expressjs.com/), [CORS 2.8](https://www.npmjs.com/package/cors), [Dotenv 18.0](https://www.npmjs.com/package/dotenv)
- **Routing & Navigation**: [React Router DOM 6.26](https://reactrouter.com/)
- **Iconography**: [Lucide React 0.441](https://lucide.dev/)
- **QR Code Engine**: [html5-qrcode 2.3](https://github.com/mebjas/html5-qrcode) & [qrcode.react 3.1](https://github.com/zpao/qrcode.react)
- **Visual Micro-interactions**: [canvas-confetti 1.9](https://www.npmjs.com/package/canvas-confetti)
- **Test Harness**: [Vitest 2.1](https://vitest.dev/), [React Testing Library 16.0](https://testing-library.com/), [JSDOM 25.0](https://github.com/jsdom/jsdom)

---

## 4. Financial Precision Standard

- **Strict Integer Arithmetic**: All monetary balances, spending limits, and payment amounts are stored internally as **integer paise** (`1 INR = 100 Paise`).
- **Zero Floating-Point Drift**: Calculations completely eliminate IEEE-754 floating-point inaccuracies (e.g. ₹500 is stored as `50000`, ₹10,000 is stored as `1000000`).
- **Pure Math Utilities**: Conversion and formatting functions (`toPaise`, `fromPaise`, `formatCurrency`) preserve exact values across the UI and ledger.

---

## 5. Demo Accounts & Personas

The application includes pre-configured demo personas so evaluators can test all features immediately without registration:

| Name | Role | Relationship | Starting Pool / Balance | Spending Limits | Permissions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Rajesh Sharma** | Administrator / Owner | Family Head | **₹10,000.00** (Central Pool) | Full Oversight | Manage Members, Adjust Limits, Add Funds |
| **Priya Sharma** | Member | Daughter (College) | ₹500.00 Personal Account | Daily: ₹2,000 • Monthly: ₹10,000 | Transfers: ✅ • QR: ✅ |
| **Aarav Sharma** | Member | Son (High School) | ₹250.00 Personal Account | Daily: ₹500 • Monthly: ₹2,000 | Transfers: ✅ • QR: ✅ |

### Switching Between Users
A **Demo Persona Switcher** is pinned to the header on every screen. Simply click any avatar or name to toggle between administrator and member perspectives.

---

## 6. Setup & Installation Guide

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### Step 1: Install Dependencies
```bash
git clone https://github.com/YOUR_USERNAME/paypal-family.git
cd paypal-family
npm install
```

### Step 2: Configure Environment Variables
Copy the example environment file to `.env`:
```bash
cp .env.example .env
```

Open `.env` and provide your credentials (optional for testing in fallback mode):
```env
# Node.js Server Port
PORT=5000

# PayPal Sandbox Credentials (from developer.paypal.com)
PAYPAL_CLIENT_ID=your_paypal_sandbox_client_id_here
PAYPAL_CLIENT_SECRET=your_paypal_sandbox_client_secret_here
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com

# Google Gemini API Key (from aistudio.google.com)
GEMINI_API_KEY=your_gemini_api_key_here
```

> **Note for Evaluators:**
> - If PayPal credentials are not supplied, the PayPal Sandbox button displays a clear configuration banner and provides a test mode simulation.
> - If the `GEMINI_API_KEY` is not supplied, the AI Spending Assistant automatically operates in **Local Intelligence Engine (Fallback Mode)** with full contextual advice.

### Step 3: Start Backend API Server
In terminal window 1:
```bash
npm run server
```
*The backend server will start on `http://localhost:5000`.*

### Step 4: Start Frontend Development Server
In terminal window 2:
```bash
npm run dev
```
*The frontend development server will start on `http://localhost:5173`.*

Open your browser and navigate to `http://localhost:5173`.

---

## 7. How to Test Integrations

### Testing PayPal Sandbox Checkout
1. Switch to **Rajesh Sharma (Admin)**.
2. Go to **Dashboard** or click **Add Money**.
3. In the modal, select **PayPal Sandbox Checkout**.
4. Enter an amount (e.g., `₹500` or `$10.00`).
5. Click the yellow **PayPal** button to launch the official PayPal checkout popup.
6. Log in with your PayPal Sandbox Personal account to approve the payment.
7. Upon approval, the backend captures the order, validates completion, and adds the funds to the Administrator family balance.

### Testing Google Gemini AI Spending Assistant
1. Navigate to **AI Assistant** (`/ai-assistant`) from the sidebar.
2. If `GEMINI_API_KEY` is configured in `.env`, the top header displays:  
   `✨ Powered by Google Gemini AI (gemini-2.5-flash)`
3. Ask contextual financial questions such as:
   - *"Can Priya afford a ₹1,200 textbook right now?"*
   - *"Break down our family spending for this month."*
   - *"Why was a payment rejected recently?"*
   - *"Give me budgeting tips for Aarav's allowance."*
4. Notice how the response incorporates actual demo ledger data, members, and active limits.
5. If the server is stopped or no API key is provided, the badge displays `🛡️ Local Intelligence Engine (Fallback Mode)`, demonstrating graceful failure resilience.

---

## 8. Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts Vite local frontend server (`http://localhost:5173`) |
| `npm run server` | Starts Express backend server with PayPal & Gemini API endpoints (`http://localhost:5000`) |
| `npm test` | Runs the full Vitest automated test suite (23 test files, 264 tests) |
| `npm run build` | Compiles TypeScript (`tsc`) and builds production bundle (`vite build`) |
| `npm run preview` | Previews the production build locally |

---

## 9. Automated Test Suite Results

The codebase includes comprehensive automated test suites covering currency math, rule evaluation, role privacy, bank discovery, PayPal Sandbox integration, and Google Gemini AI:

```text
Test Files  23 passed (23)
Tests       264 passed (264)
Status      100% Passing
```

---

## 10. Security & Privacy Disclosure

1. **Client Secret Isolation**: PayPal Client Secret and Gemini API keys are maintained server-side and never bundled in client distribution assets.
2. **Prototype Storage Scope**: Internal family balances and ledger entries are stored in browser LocalStorage (`pf_*` keys). While suitable for hackathon demonstrations, production deployment requires a distributed PostgreSQL/MySQL database behind authenticated session tokens.
3. **Simulated Bank Account Discovery**: Bank cards (HDFC, SBI, ICICI, Axis, Kotak, PNB) and account lookup are mock fintech simulations designed to model modern PhonePe/Google Pay user experiences. No real netbanking credentials, UPI PINs, or ATM PINs are ever requested or stored.

---

## License
MIT License. Created for fintech hackathon evaluation and educational prototyping.
