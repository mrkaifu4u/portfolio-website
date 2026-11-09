# 📊 Google Sheets Database & Contact Form Integration Guide

Follow these steps to connect your portfolio website to a Google Sheets database (acting as a dynamic website settings repository and submission manager).

---

## Step 1: Create your Google Sheet Database
1. Go to [Google Sheets](https://sheets.google.com) and create a **Blank Spreadsheet**.
2. Rename the spreadsheet to `Portfolio_Website_DB`.
3. Create **two sheets** exactly as named below.

### Sheet 1: `admin_users`
This sheet stores your website configuration (social links, resume, phone, location) and your admin login credentials.
1. Double-click the tab at the bottom and rename the sheet to **`admin_users`**.
2. In Row 1 (Headers), set Columns A through M exactly as follows:
   *   Column A: `ID`
   *   Column B: `Navbar_Logo`
   *   Column C: `Portfolio_Name`
   *   Column D: `Email`
   *   Column E: `Password`
   *   Column F: `Resume_Link`
   *   Column G: `Instagram_Link`
   *   Column H: `LinkedIn_Link`
   *   Column I: `GitHub_Link`
   *   Column J: `X_Link`
   *   Column K: `Phone`
   *   Column L: `Location`
   *   Column M: `Updated_At`
3. In **Row 2**, fill out your initial website configuration. This is **REQUIRED** for the website to load:
   *   **A2 (ID)**: `1`
   *   **B2 (Navbar_Logo)**: `MOHAMAD.` (Used for navbar logo)
   *   **C2 (Portfolio_Name)**: `Mohamad Kaifoddin` (Used for hero main title)
   *   **D2 (Email)**: `your-email@gmail.com` (Used to log into the `/admin.html` dashboard)
   *   **E2 (Password)**: `yoursecurepassword` (Used to log into the `/admin.html` dashboard)
   *   **F2 (Resume_Link)**: `https://drive.google.com/file/d/YOUR_RESUME_FILE_ID/view` (Ensure link sharing is set to "Anyone with the link can view")
   *   **G2 to J2 (Social links)**: Enter your full profile URLs (e.g. `https://instagram.com/yourusername`, etc.)
   *   **K2 (Phone)**: `+91 98765 43210`
   *   **L2 (Location)**: `Hyderabad, India`
   *   **M2 (Updated_At)**: Leave blank (it will be set automatically when you edit configuration in the admin panel)

### Sheet 2: `contact_messages`
This sheet receives message submissions from the contact form.
1. Click the **`+`** icon (bottom-left) to add a sheet and rename it to **`contact_messages`**.
2. In Row 1 (Headers), set Columns A through N exactly as follows:
   *   Column A: `ID`
   *   Column B: `Name`
   *   Column C: `Email`
   *   Column D: `Purpose`
   *   Column E: `Message`
   *   Column F: `Current_Location`
   *   Column G: `IP_Address`
   *   Column H: `Browser`
   *   Column I: `Device`
   *   Column J: `Operating_System`
   *   Column K: `Referrer`
   *   Column L: `Submitted_Time`
   *   Column M: `Submitted_Date`
   *   Column N: `Status`

---

## Step 2: Set up Google Apps Script Backend
1. In your Google Sheet, click **Extensions** > **Apps Script** in the top menu.
2. In the Apps Script project editor, map your project code exactly to the files in the `google-apps-script/` directory of this workspace:
   *   **Code.gs**: Click on `Code.gs` in the editor, delete any template code, and copy-paste the contents of [Code.gs](google-apps-script/Code.gs).
   *   **API.gs**: Click **`+`** (Add a file) next to Files > Select **Script** > Name it `API` > Copy-paste contents of [API.gs](google-apps-script/API.gs).
   *   **Auth.gs**: Click **`+`** > Script > Name it `Auth` > Copy-paste contents of [Auth.gs](google-apps-script/Auth.gs).
   *   **Contact.gs**: Click **`+`** > Script > Name it `Contact` > Copy-paste contents of [Contact.gs](google-apps-script/Contact.gs).
   *   **Admin.gs**: Click **`+`** > Script > Name it `Admin` > Copy-paste contents of [Admin.gs](google-apps-script/Admin.gs).
   *   **Utils.gs**: Click **`+`** > Script > Name it `Utils` > Copy-paste contents of [Utils.gs](google-apps-script/Utils.gs).
3. Click the **Save Project** (disk icon) at the top of the editor.

---

## Step 3: Deploy the Script as a Web App
1. In the top-right corner of the Apps Script project, click the **Deploy** button > Select **New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Configure the deployment exactly as follows:
   *   **Description**: `Portfolio Database API`
   *   **Execute as**: **`Me (your-email@gmail.com)`**
   *   **Who has access**: **`Anyone`** (This is critical so your website can send and fetch data).
4. Click **Deploy**.
5. Grant permissions if prompted (log in with your Google account, click *Advanced*, then *Go to Portfolio Database (unsafe)*, and click *Allow*).
6. Copy the **Web app URL** (it ends with `/exec`).

---

## Step 4: Link the Web App URL to your Frontend
1. Open the project's [api.js](api.js) file.
2. Locate the line with `Api.url`:
   ```javascript
   url: 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE',
   ```
3. Replace `'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE'` with your copied Web App deployment URL.
4. Save the file and you're good to go!

---

## Admin Panel Access
Your portfolio's admin configuration console is available at:
*   Local: Open [admin.html](admin.html) directly in your browser.
*   Production: Navigate to `https://yourdomain.com/admin.html` or `/admin`.

Log in using the **Email** and **Password** you entered in **Row 2** of the `admin_users` sheet. After logging in, you will be able to update all social links, location, phone number, and resume links dynamically. Changes will reflect on your main website instantly without reloading or modifying any HTML code!
