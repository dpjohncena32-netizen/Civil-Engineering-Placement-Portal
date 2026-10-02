# Civil Engineering Placement Preparation Portal

> A secure, automated assessment and placement-readiness platform for
> Civil Engineering students.

## Overview

The Civil Engineering Placement Preparation Portal is a standalone
web-based assessment platform for structured placement preparation. It
combines student registration, secure authentication, scheduled online
tests, automatic evaluation, results, response sheets, and faculty/admin
controls.

## Key Features

### Student

-   Roll Number based registration
-   Master-data verification
-   Secure password login
-   Student dashboard
-   100-question assessments
-   90-minute timer
-   Auto-save
-   Resume support for interrupted sessions
-   Automatic submission after expiry
-   Automatic evaluation
-   Instant results
-   Response-sheet view
-   PDF response sheet

### Examination Security

-   Tab-switch detection
-   Fullscreen monitoring
-   Copy/cut/paste restrictions
-   Context-menu restriction
-   Common shortcut restrictions
-   Progressive warnings
-   Configured violation-based termination
-   Server-side expiry

### Admin

-   Admin login
-   Student password reset
-   Question-bank management
-   Test assignment
-   Test unlock/lock
-   Test-specific password management
-   Test scheduling
-   Result and attempt monitoring

## Assessment Model

The current programme is designed around 11 tests, with 100 questions
and 90 minutes per test.

Question-bank CSV columns:

`QuestionId, TestNo, Topic, Question, OptionA, OptionB, OptionC, OptionD, CorrectAnswer, Marks, Active`

## Student Workflow

``` text
Roll Number
    ↓
Master Data Verification
    ↓
Registration / Login
    ↓
Student Dashboard
    ↓
Available Test
    ↓
Timed Examination
    ↓
Auto-save + Security Monitoring
    ↓
Submit / Time Expiry
    ↓
Automatic Evaluation
    ↓
Result + Response Sheet + PDF
```

## Technology Stack

-   HTML5
-   CSS3
-   JavaScript
-   Google Apps Script
-   Google Sheets
-   Google Drive
-   PDF generation
-   SHA-256 password hashing

## Architecture

``` text
Student Browser
      ↓
Google Apps Script
      ↓
Google Sheets
      ↓
Students / Questions / Attempts / Answers / Settings
      ↓
Google Drive
```

## Data Sets

-   **StudentMaster** --- official student details used for registration
    verification
-   **Students** --- registered accounts and authentication information
-   **Questions** --- test-wise question bank
-   **Attempts** --- examination attempt and score information
-   **Answers** --- student responses
-   **Settings** --- application configuration

## Scalability Roadmap

The current Google Apps Script + Google Sheets version is intended for
lightweight deployment and rapid implementation.

For larger deployments, the planned architecture is:

``` text
Web / Mobile Client
        ↓
      API
        ↓
 SQL Database + Object Storage
        ↓
 Analytics / Admin
```

Potential future components include PostgreSQL/MySQL, REST APIs,
centralized authentication, object storage, caching/session
infrastructure, background jobs, and production-grade monitoring.

## Repository Structure

``` text
Civil-Engineering-Placement-Portal/
├── README.md
├── backend/
│   └── Code.gs
├── frontend/
│   └── Index.html
├── question-banks/
│   ├── test-01/
│   ├── test-02/
│   └── test-03/
├── documentation/
│   ├── system-architecture.md
│   ├── database-structure.md
│   ├── deployment-guide.md
│   └── security.md
├── screenshots/
│   ├── login.png
│   ├── registration.png
│   ├── dashboard.png
│   ├── examination.png
│   ├── result.png
│   └── admin-dashboard.png
└── CHANGELOG.md
```

## Deployment

1.  Create a dedicated Google Sheet.
2.  Create the Apps Script project.
3.  Configure the spreadsheet ID.
4.  Add `Code.gs` and `Index.html`.
5.  Run the setup function.
6.  Configure the administrator password.
7.  Populate `StudentMaster`.
8.  Import question banks.
9.  Deploy the Web App.
10. Test registration, login, examination, result and admin workflows.

## Public Repository Safety

Do not publish administrator passwords, student personal data, private
spreadsheet IDs, private Drive IDs, private deployment credentials, or
institutional records.

## Project Status

**Active Development**

The core assessment workflow is operational. Current development focuses
on question-bank expansion, analytics, documentation, and preparation
for larger-scale deployments.

## Keywords

Civil Engineering, Placement Preparation, Online Examination, Assessment
Portal, Google Apps Script, Google Sheets, Student Management, Question
Bank, Automated Evaluation, Engineering Education, Placement Readiness
