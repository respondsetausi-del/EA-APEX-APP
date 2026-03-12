# EA Converter: DB, API, Auth, Email & Mentor ID Flow

> **Source:** Extracted from the Android APK  
> **Purpose:** Reference for resolving license and login issues in the web application

---

## 1. Database Connection (Room)

### Configuration

**LicenceDB.kt** (Lines 62-69)

```kotlin
private fun createDatabase(context: Context) =
    Room.databaseBuilder(
        context.applicationContext,
        LicenceDB::class.java,
        "licences_db"
    ).addMigrations(MIGRATION_2_3).addMigrations(MIGRATION_3_4).build()
```

- Singleton `LicenceDB` created via `LicenceDB(context)`
- Database name: `licences_db`
- Migrations: 2→3 (signals table), 3→4 (log table)

### Tables & Entities

| Table    | Entity  | Purpose                    |
| -------- | ------- | -------------------------- |
| licences | Licence | All authenticated licences |
| sicences | Sicence | Selected/active licence     |
| symbols  | Symbol  | Symbols per phone_secret   |
| signals  | Signal  | Trading signals            |
| log      | log     | App log entries            |

### Access Pattern

- Repository: `RTRepository(LicenceDB)`
- DAO: `LicenceDao` (via `db.getLicenceDao()`)
- Creation: `HomeActivity` creates `LicenceDB(this)` and passes it into `RTRepository`.

---

## 2. API Connection (Retrofit + OkHttp)

### Base URL & Constants

**Constants.kt** (Lines 3-9)

```kotlin
class Constants {
    companion object {
        const val BASE_URL = "https://ea-converter.com/admin/api/"
        const val DIRECT_IP = "37.148.203.172"
        // ...
```

- **Base URL:** `https://ea-converter.com/admin/api/`
- **Fallback IP:** `37.148.203.172` (used when DNS fails or 403)

### Retrofit Instance

**RetrofitInstance.kt** (Lines 84-109)

```kotlin
private val retrofit by lazy {
    val logging = HttpLoggingInterceptor()
    logging.setLevel(HttpLoggingInterceptor.Level.BODY)
    val client = OkHttpClient.Builder()
        .connectionPool(connectionPool)
        .dns(smartDns)
        .addInterceptor(headerInterceptor)
        .addInterceptor(fallbackInterceptor)
        .addInterceptor(logging)
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .cookieJar(cookieJar)
        .retryOnConnectionFailure(true)
        .build()
    Retrofit.Builder()
        .baseUrl(BASE_URL)
        .addConverterFactory(GsonConverterFactory.create())
        .client(client)
        .build()
}
val api by lazy { retrofit.create(RoboTraderAPI::class.java) }
```

**Components:**

- **DNS fallback:** 403 or connection error → retry using `DIRECT_IP`
- **Cookie jar:** per-host cookie storage
- **Headers:** User-Agent, Accept, Accept-Language, Connection
- **Timeout:** 30s connect/read/write

### API Endpoints

**RoboTraderAPI.kt** (Lines 9-25)

| Endpoint    | Method | Params           | Purpose                      |
| ----------- | ------ | ---------------- | ---------------------------- |
| auth/       | POST   | body: AuthBody   | Licence authentication       |
| auth/app/   | GET    | email, use       | App subscription / access    |
| signals/     | GET    | phone_secret     | Fetch signals                |
| symbols/     | GET    | phone_secret     | Fetch symbols                |

---

## 3. Auth Flows

### 3a. Licence Authentication (auth/)

**Request body (AuthBody.kt)**

```kotlin
data class AuthBody(
    var licence: String?,
    var phone_secret: String?
)
```

- `licence`: licence key
- `phone_secret`: device identifier; nullable on first add

**Response (Account.kt)**

```kotlin
data class Account(
    @SerializedName("data")
    var Licence: Licence,
    var message: String
)
```

**Flow**

1. User enters key in `AddRobotFragment` → `viewModel.authenticate(AuthBody(key.text.toString(), null))`
2. `RTRepository.authenticate(authBody)` → `RetrofitInstance.api.authenticate(authBody)`
3. **Success:** `message == "accept"` → licence saved to Room via `saveLicence()` / `saveSicence()`
4. **Error:** `message == "used"` → "License key is already used in another device"
5. **Licence → phone_secret_key** returned by server in Licence; used for signals, symbols, DB queries

### 3b. App Subscription Check (auth/app/)

**Request**

- `email`: user email (required)
- `use`: optional boolean; when true, marks the device as "used" after successful access

**Response (App.kt)**

```kotlin
data class App(
    val message: String,
    val version: Int
)
```

**Flow**

1. `HomeActivity` loads → `homeViewModel.getApp(sharedPreference.getString("email", null)?.trim(), null)`
2. `RTRepository.getApp(email, use)` → `RetrofitInstance.api.getApp(email, use)`
3. UI reacts to Resource.Success, Resource.Loading, Resource.Error

**Message handling**

| message   | Action                                                                 |
| --------- | ---------------------------------------------------------------------- |
| "accept"  | Show main UI, save use_email, optionally check version                 |
| "used"    | If stored use_email == current email → main; else "contact mentor"    |
| "admin"   | Open shop WebView with email and mentor query params                   |
| other     | Show pay layout, optionally open shop WebView                           |

---

## 4. Email & Mentor ID Usage

### Storage

**SharedPreferences:** `MEMBERS`  
**Keys:** `"email"`, `"use_email"`

- `"email"`: current subscription email
- `"use_email"`: email used when access was granted (use=true)

### Flow (HomeActivity)

**Subscribe button:**

- Email: `findViewById<TextInputEditText>(R.id.outlined_edit_text_3).text`
- Mentor ID: `findViewById<TextInputEditText>(R.id.outlined_edit_text_2).text`
- Saves email to MEMBERS and calls `getApp(email, null)`
- **API:** only `email` (and `use`) sent to `auth/app/`; mentor is **not** sent

**Shop URL** (for admin or pay layout):

```
https://ea-converter.com/shop/?email=${email}&mentor=${mentorT}
```

- `mentorT`: Mentor ID from `R.id.outlined_edit_text_2`, or `"0"` if empty  
- Used in WebView for purchase / admin flows

---

## 5. Connection Diagrams

### Subscribe Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     HOME ACTIVITY / SUBSCRIBE FLOW                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   [Email field]  ──►  SharedPref "email"  ──►  getApp(email, null)            │
│   [Mentor ID]    ──►  Used only in shop URL (not sent to API)                 │
│                                                                               │
│   auth/app/?email=...&use=...  ──►  App(message, version)                     │
│                                                                               │
│   message="accept"  ──►  main view + save "use_email"                          │
│   message="used"   ──►  if use_email==email → main; else toast                │
│   message="admin"  ──►  WebView shop/?email=&mentor=                          │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Licence / Robot Auth Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      LICENCE / ROBOT AUTH FLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   [Licence key]  ──►  authenticate(AuthBody(licence, null))                   │
│                                                                               │
│   POST auth/  body: { licence, phone_secret }                                 │
│   Response: Account(Licence, message)                                         │
│                                                                               │
│   Success  ──►  Licence (with phone_secret_key)  ──►  Room (licences, sicences)│
│   phone_secret_key  ──►  getSignals(phone_secret)                             │
│                      ──►  getSymbols(phone_secret)                             │
│                      ──►  getSavedSymbols(phone_secret)                       │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Summary

| Component | Flow / Connection |
| --------- | ----------------- |
| DB        | Room singleton LicenceDB, accessed via RTRepository |
| API       | Retrofit → RetrofitInstance.api → RoboTraderAPI |
| Auth (licence) | authenticate(AuthBody) → POST auth/ → save Licence |
| Auth (app) | getApp(email, use) → GET auth/app/ → handle message |
| Email     | UI → SharedPref MEMBERS → getApp() as email param |
| Mentor ID | UI only → used in https://ea-converter.com/shop/ query |
| phone_secret | From server Licence.phone_secret_key; used for signals, symbols, DB |

---

## Key Differences: Android vs Web App (for reference)

| Aspect | Android APK | Web App |
| ------ | ----------- | ------- |
| **API base** | `https://ea-converter.com/admin/api/` | `EXPO_PUBLIC_API_BASE_URL` (e.g. Render) |
| ** auth** | POST `auth/` | POST `/api/auth-license` |
| **App/subscription** | GET `auth/app/?email=&use=` | POST `/api/check-email` (members table) |
| **Fallback** | DIRECT_IP `37.148.203.172` | None |
| **Mentor** | Not sent to API; shop URL only | Sent to check-email (not enforced) |
