# System Architecture

## 1. Overview

The Civil Engineering Placement Preparation Portal is a web-based assessment platform designed to support structured placement preparation for Civil Engineering students.

The current implementation uses:

- HTML/CSS/JavaScript frontend
- Google Apps Script backend
- Google Sheets as the application data layer
- Google Drive as an optional file-storage layer
- Server-side session and examination controls

The application is designed around test-wise question banks, controlled examination sessions, automatic evaluation, and administrative monitoring.

---

## 2. High-Level Architecture

```text
+-----------------------------+
|      Student / Admin        |
|        Web Browser          |
+--------------+--------------+
               |
               v
+-----------------------------+
|        Index.html           |
|  UI + Exam Timer + Client   |
|       Exam Controls         |
+--------------+--------------+
               |
               v
+-----------------------------+
|      Google Apps Script     |
|       Code.gs Backend       |
|                             |
| Authentication              |
| Registration                |
| Test Management             |
| Question Management         |
| Answer Saving               |
| Evaluation                  |
| Session Control             |
| PDF Response Generation     |
+--------------+--------------+
               |
               v
+-----------------------------+
|       Google Sheets         |
|                             |
| StudentMaster               |
| Students                    |
| Questions                   |
| Attempts                    |
| Answers                     |
| Settings                    |
+-----------------------------+

Optional:
Google Drive -> student photos / generated files
```

---

## 3. Frontend Layer

`Index.html` provides the browser-based application interface.

Major responsibilities include:

- Student registration
- Student login
- Student dashboard
- Test selection
- Examination interface
- Question navigation
- Answer selection
- Client-side timer
- Auto-save requests
- Exam warnings
- Result display
- Response-sheet access
- PDF response-sheet download
- Student logout
- Admin login
- Admin dashboard
- Question-bank management
- Test management
- Result management

The frontend does not contain private deployment credentials or institution-specific secrets.

---

## 4. Backend Layer

`Code.gs` implements the server-side application logic using Google Apps Script.

Major backend responsibilities:

### Authentication
- Student registration
- Student login
- Password hashing
- Admin authentication
- Session validation

### Student Management
- StudentMaster verification
- Student record creation
- Password reset
- Login tracking

### Test Management
- Test 1–11 configuration
- Question-count validation
- Scheduled access
- Test locking/unlocking
- Test-specific password control

### Examination
- Attempt creation
- Question retrieval
- Answer saving
- Attempt resumption
- Server-side expiry processing
- Automatic submission
- Result calculation

### Administration
- Dashboard statistics
- Results search/filter
- Question-bank import
- Test assignment
- Password management
- Attempt monitoring

---

## 5. Data Layer

Google Sheets is used as the current structured data layer.

The application uses these logical sheets:

```text
StudentMaster
Students
Questions
Attempts
Answers
Settings
```

The database structure is documented separately in `database-structure.md`.

---

## 6. Student Workflow

```text
Student
  |
  v
Enter Roll No
  |
  v
Verify against StudentMaster
  |
  v
Register / Login
  |
  v
Student Dashboard
  |
  v
Select Available Test
  |
  v
Check Test Access
  |
  v
Start / Resume Attempt
  |
  v
Answer Questions
  |
  +----> Auto Save
  |
  v
Submit / Timer Expiry
  |
  v
Automatic Evaluation
  |
  v
Result
  |
  v
Response Sheet / PDF
```

---

## 7. Examination Workflow

Each configured test is intended to contain exactly 100 active questions.

The standard examination configuration is:

- 100 questions
- 100 marks
- 1 mark per question
- 90-minute duration
- One attempt per student per test

Before an examination becomes ready, the system validates the question-bank count.

```text
Question Bank
     |
     v
Validate
     |
     +---- Not 100 --> Test Not Ready
     |
     v
100 Active Questions
     |
     v
Test Ready
```

---

## 8. Auto-Save and Resume

During an active examination, answers are saved through the backend.

If a browser is closed before the examination is completed, the attempt can remain in progress and may be resumed according to the application's session and attempt rules.

The server also performs expiry processing so that examination completion does not depend exclusively on the browser remaining open.

---

## 9. Timer and Auto-Submission

The examination uses a 90-minute duration.

Two layers are used:

1. Client-side timer for immediate user-interface feedback.
2. Server-side expiry processing for backend enforcement.

When an attempt reaches its permitted duration, the system can process the attempt as expired and submit it automatically.

---

## 10. Examination Security

The current implementation includes browser-side examination controls such as:

- Tab visibility monitoring
- Fullscreen exit monitoring
- Copy prevention
- Cut prevention
- Paste prevention
- Right-click prevention
- Common shortcut restrictions
- Violation warnings
- Automatic termination after the configured violation threshold

The current warning sequence is:

```text
1st violation -> Warning
2nd violation -> Warning
3rd violation -> Final Warning
4th violation -> Terminate + Auto Submit
```

These controls are intended to discourage common browser-level examination violations. They should not be interpreted as a replacement for institutional examination supervision or server-side security.

---

## 11. Administration Workflow

```text
Admin Login
    |
    v
Admin Dashboard
    |
    +--> Test Management
    |
    +--> Question Bank Management
    |
    +--> Results
    |
    +--> Student Password Recovery
    |
    +--> Examination Monitoring
```

The question-bank module supports validation before import, including checks for question count, required fields, duplicate IDs, valid answers, marks, test assignment, and active status.

---

## 12. Current Deployment Model

The current implementation is designed for Google Apps Script deployment.

Typical deployment flow:

```text
Google Spreadsheet
      |
      v
Google Apps Script Project
      |
      +--> Code.gs
      +--> Index.html
      |
      v
Deploy as Web App
      |
      v
Student / Admin Browser
```

Deployment-specific instructions are maintained in `DEPLOYMENT_GUIDE.md`.

---

## 13. Scalability Direction

The current Google Sheets + Apps Script architecture is suitable for controlled deployments and prototype/early production use.

For substantially larger deployments, the application can evolve toward:

```text
Web / Mobile Clients
        |
        v
API / Application Server
        |
        +---- PostgreSQL / MySQL
        |
        +---- Object Storage
        |
        +---- Session / Cache Layer
```

This future architecture would reduce dependence on spreadsheet-based transactional storage and provide a more conventional database-backed platform for large-scale examination workloads.
