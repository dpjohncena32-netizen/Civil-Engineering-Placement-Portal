# Deployment Guide

## 1. Create the Google Sheet

Create a new Google Spreadsheet and copy its Spreadsheet ID.

The application uses:

- `StudentMaster`
- `Students`
- `Questions`
- `Attempts`
- `Answers`
- `Settings`

`StudentMaster` headers:

`Roll No | Name of the Student | Branch | Section`

## 2. Configure `Code.gs`

Replace:

```javascript
SPREADSHEET_ID: 'PASTE_YOUR_STANDALONE_SPREADSHEET_ID_HERE'
```

with the Spreadsheet ID for your own deployment.

Keep `PHOTO_FOLDER_ID` blank unless photo support is intentionally configured.

Review the `SCHEDULE` dates/times before each deployment.

## 3. Add the frontend

Create an Apps Script HTML file named exactly `Index` and paste `Index.html`.

## 4. Initial setup

Run:

```javascript
setupV4()
```

and authorize the requested Google services.

## 5. Set the admin password

Use `setAdminPassword()` with a strong password from the Apps Script editor or a temporary local helper.

Never put the password directly into the committed source code.

Delete any temporary password-setting helper after use.

## 6. Deploy

Deploy as a Web app.

Recommended settings:

- Execute as: Me
- Access: the access policy appropriate to your deployment

## 7. Import question banks

Use **Faculty Dashboard → Question Bank Management**.

Each CSV represents one complete test and must contain exactly 100 valid questions.

Required columns:

`QuestionId, TestNo, Topic, Question, OptionA, OptionB, OptionC, OptionD, CorrectAnswer, Marks, Active`

## 8. Public repository safety

Never commit:

- private Spreadsheet IDs
- Drive folder IDs
- student personal data
- admin passwords
- test passwords
- private deployment URLs
- exported result files
- institutional documents

The GitHub version should remain a reusable software template.
