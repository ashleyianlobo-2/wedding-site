# RSVP → Google Sheet setup (do this once, ~5 min)

This connects the website's RSVP form to a Google Sheet that tracks who replied,
who's attending, who declined, and who still hasn't answered.

## 1. Make the Sheet with three tabs

Create a new Google Sheet. Rename/add three tabs (bottom-left):

### Tab `Guest List`  — you fill this in
Row 1 headers:

| A: Name | B: Party | C: Email | D: Invited |
|---------|----------|----------|------------|
| Jane & Tom Smith | Smith | jane@... | 2 |

One row per **invited party/household**. "Name" here must match what people type
in the form closely enough for you to eyeball it (it's only used to see who's missing).

### Tab `Responses` — filled automatically, just add the headers
Row 1 headers, exactly in this order (the script writes to these columns):

| A: Timestamp | B: Name | C: Roce reply | D: Roce guests | E: Wedding reply | F: Wedding guests | G: Wishes |
|--------------|---------|---------------|----------------|------------------|-------------------|-----------|

Leave rows 2+ empty. The form fills them.

### Tab `Dashboard` — the counts
Paste these formulas anywhere (e.g. column A labels, column B values):

```
Total replies            =COUNTA(Responses!A2:A)
Roce — accepted          =COUNTIF(Responses!C2:C,"Accepts with pleasure")
Roce — guests coming     =SUM(Responses!D2:D)
Roce — declined          =COUNTIF(Responses!C2:C,"Declines with regret")
Wedding — accepted       =COUNTIF(Responses!E2:E,"Accepts with pleasure")
Wedding — guests coming  =SUM(Responses!F2:F)
Wedding — declined       =COUNTIF(Responses!E2:E,"Declines with regret")
```

**Who hasn't replied (live list)** — compare against your `Guest List` tab:
```
=FILTER('Guest List'!A2:A, ISNA(MATCH('Guest List'!A2:A, Responses!B:B, 0)), 'Guest List'!A2:A<>"")
```

## 2. Add the Apps Script backend

In the Sheet: **Extensions → Apps Script**. Delete whatever's there, paste this,
then click **Save**:

```javascript
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Responses');
  const d = e.parameter;
  sheet.appendRow([
    new Date(),
    d.name || '',
    d.roce || '',
    d.roce_headcount || '',
    d.wedding || '',
    d.wedding_headcount || '',
    d.wishes || ''
  ]);
  return ContentService
    .createTextOutput(JSON.stringify({ result: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## 3. Deploy it

- Click **Deploy → New deployment**.
- Gear icon → **Web app**.
- **Execute as:** Me.
- **Who has access:** **Anyone**.  ← important, so guests can submit.
- Click **Deploy**, approve the permissions prompt (it's your own script).
- **Copy the Web app URL** — it ends in `/exec`.

## 4. Give me (or paste into the site) that URL

Open `script.js`, find the line near the top (line 8):

```js
const RSVP_ENDPOINT = "PASTE_YOUR_APPS_SCRIPT_EXEC_URL_HERE";
```

and paste the `/exec` URL between the quotes. Done — RSVPs now land in your Sheet.

> Note: the form submits "fire-and-forget" (Apps Script doesn't send CORS headers,
> so the browser can't read the reply). The row is still written reliably; the site
> just shows a success message optimistically. This is the standard, free approach.
