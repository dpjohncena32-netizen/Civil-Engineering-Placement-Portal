# Security

## 1. Security Overview

The Civil Engineering Placement Preparation Portal includes multiple layers of application and examination controls.

Security is implemented at both the backend and browser levels.

The current implementation should be considered an application-level examination system, not a replacement for a dedicated secure examination browser or institution-controlled test environment.

---

## 2. Password Security

Student and administrative passwords are not intended to be stored as plaintext.

The application uses SHA-256 hashing for password-related storage.

Conceptually:

```text
Plaintext Password
       |
       v
    SHA-256
       |
       v
Password Hash
       |
       v
Stored / Compared
```

Administrative password configuration is stored through Google Apps Script properties rather than hard-coded into the public repository.

---

## 3. Public Repository Safety

The public GitHub repository should never contain:

- Real admin passwords
- Student passwords
- Student personal records
- Private spreadsheet IDs
- Private Drive folder IDs
- Deployment credentials
- Private API keys
- Exported confidential result files
- Institution-specific confidential data

Configuration placeholders should be used in public source code.

---

## 4. Student Authentication

The student login process uses the student's registered credentials.

Registration is linked to the StudentMaster reference data.

The Roll No is used to identify the student during registration and application use.

---

## 5. Session Control

The application maintains application-level session information.

The examination design also supports control of an active browser session so that multiple simultaneous sessions for the same student can be restricted.

Session validation is performed by the backend rather than relying only on browser state.

---

## 6. One-Attempt Control

The examination system is designed around one attempt per student per test.

The attempt record provides the backend with the state required to distinguish:

```text
Not Started
IN_PROGRESS
Submitted
Expired / Auto-Submitted
```

This reduces the possibility of repeatedly taking the same scheduled test.

---

## 7. Test Access Control

Tests can be controlled through:

- Scheduled access
- Lock/unlock controls
- Test-specific passwords after the scheduled period
- Question-count readiness validation

This separates normal scheduled access from administrative override and post-schedule access.

---

## 8. Server-Side Examination Expiry

The client-side timer provides immediate feedback to the student.

However, the backend also processes expired attempts.

This is important because a browser timer alone should not be considered authoritative.

```text
Browser Timer
     |
     v
User Interface

Server Expiry Processing
     |
     v
Backend Enforcement
```

---

## 9. Auto-Save

Answers are saved during the examination.

Auto-save reduces the risk of losing responses because of:

- Browser refresh
- Temporary network interruption
- Accidental navigation
- Browser closure

The server-side attempt state remains the authoritative examination record.

---

## 10. Browser-Level Examination Controls

The current frontend includes controls intended to discourage common examination violations.

These include:

- Tab visibility detection
- Fullscreen exit detection
- Copy blocking
- Cut blocking
- Paste blocking
- Right-click blocking
- Common keyboard shortcut restrictions

Normal browser window blur is not treated in the same way as the configured examination violations.

---

## 11. Violation Escalation

The current examination interface uses an escalating warning mechanism.

```text
Violation 1
   |
   v
Warning

Violation 2
   |
   v
Warning

Violation 3
   |
   v
Final Warning

Violation 4
   |
   v
Terminate Examination
   |
   v
Auto Submit
```

The purpose is to provide progressively stronger responses while maintaining an automatic enforcement path.

---

## 12. Administrative Security

Administrative functions are separated from normal student functions.

Administrative capabilities include:

- Test management
- Question-bank management
- Results access
- Password recovery
- Examination monitoring
- Test access control

Administrative authentication must use a strong password and should be changed from any initial deployment value before production use.

---

## 13. Question-Bank Integrity

Question-bank imports are validated before they are applied.

Validation includes checks for:

- Question count
- Required columns
- Duplicate IDs
- Missing values
- Valid answer keys
- Valid marks
- Test number consistency
- Active status

This helps prevent malformed question banks from being unintentionally published.

---

## 14. Security Limitations

Browser-based controls have inherent limitations.

For example:

- JavaScript restrictions can potentially be bypassed by a technically capable user.
- Client-side controls cannot guarantee prevention of external devices or physical collaboration.
- Network failures can affect browser communication.
- Google Apps Script and Google Sheets have platform-level quotas and execution constraints.

Therefore, high-stakes examinations should combine the application with appropriate supervision and institutional examination procedures.

---

## 15. Production Security Recommendations

Before a production deployment:

1. Set a strong unique admin password.
2. Keep spreadsheet and Drive identifiers private where appropriate.
3. Restrict spreadsheet editing permissions.
4. Use the minimum required Google account permissions.
5. Avoid storing confidential student information in the public repository.
6. Keep production deployment details outside public source files.
7. Regularly review Apps Script execution logs.
8. Maintain backups of important examination data.
9. Review question-bank permissions before each test.
10. Test access controls before opening a live examination.

---

## 16. Security Architecture

```text
                 +------------------+
                 |   Student/Admin  |
                 +--------+---------+
                          |
                          v
                 +------------------+
                 |  Browser Layer   |
                 | Timer / Controls |
                 +--------+---------+
                          |
                          v
                 +------------------+
                 | Apps Script API  |
                 | Authentication   |
                 | Session Control   |
                 | Exam Enforcement |
                 +--------+---------+
                          |
                          v
                 +------------------+
                 | Google Sheets    |
                 | Application Data |
                 +------------------+
```

Security is therefore implemented as a combination of authentication, backend validation, examination-state control, browser-level controls, and operational safeguards.
