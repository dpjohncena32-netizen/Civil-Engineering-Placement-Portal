# Database Structure

## 1. Overview

The current application uses Google Sheets as its structured data layer.

The logical database consists of six primary sheets:

1. `StudentMaster`
2. `Students`
3. `Questions`
4. `Attempts`
5. `Answers`
6. `Settings`

The exact column structure may be extended as the application evolves.

---

## 2. StudentMaster

### Purpose

`StudentMaster` is the authoritative student reference list used during registration.

### Current headers

```text
Roll No
Name of the Student
Branch
Section
```

### Example structure

| Roll No | Name of the Student | Branch | Section |
|---|---|---|---|
| STUDENT001 | Student Name | Civil | A |

The application uses the Roll No to retrieve the official student details during registration.

---

## 3. Students

### Purpose

`Students` stores registered application users and authentication-related information.

### Logical fields

```text
StudentId
RollNo
Name
FatherName
Branch
Section
Mobile
Email
PasswordHash
CreatedAt
Status
LastLogin
```

The current standalone implementation uses the StudentMaster lookup to obtain the official basic student information.

Passwords are not intended to be stored as plaintext values. Password hashes are stored instead.

---

## 4. Questions

### Purpose

`Questions` stores the question bank used by the examinations.

### Logical fields

```text
QuestionId
TestNo
Topic
Question
OptionA
OptionB
OptionC
OptionD
CorrectAnswer
Marks
Active
```

### Test assignment

Each question belongs to a test through `TestNo`.

The current assessment model expects:

```text
Test 1 -> 100 questions
Test 2 -> 100 questions
...
Test 11 -> 100 questions
```

The application validates the active question count before making a test ready.

---

## 5. Attempts

### Purpose

`Attempts` stores examination attempts and their final status.

### Logical fields

```text
AttemptId
StudentId
StartTime
EndTime
Status
Score
Correct
Wrong
Unanswered
DurationSec
TestNo
```

### Attempt lifecycle

```text
IN_PROGRESS
     |
     +------> SUBMITTED
     |
     +------> EXPIRED / AUTO-SUBMITTED
```

The exact status values may evolve with future versions.

---

## 6. Answers

### Purpose

`Answers` stores student responses associated with an examination attempt.

### Logical fields

```text
AttemptId
QuestionId
Answer
SavedAt
IsCorrect
```

### Relationship

```text
Attempts
   |
   | AttemptId
   v
Answers
   |
   | QuestionId
   v
Questions
```

This structure allows the application to reconstruct a student's response sheet and calculate examination results.

---

## 7. Settings

### Purpose

`Settings` stores configurable application-level values.

Typical configuration categories include:

- Application settings
- Test configuration
- Schedule information
- Test access configuration
- Other backend-controlled values

Sensitive credentials should not be placed into public repository files. Administrative authentication data is handled through Google Apps Script properties rather than public source code.

---

## 8. Logical Relationships

```text
StudentMaster
     |
     | Roll No
     v
Students
     |
     | StudentId
     v
Attempts
     |
     | AttemptId
     v
Answers
     |
     | QuestionId
     v
Questions
```

`Settings` operates as a configuration layer rather than a transactional relationship table.

---

## 9. Examination Data Flow

```text
Student
   |
   v
StudentMaster verification
   |
   v
Students
   |
   v
Create Attempt
   |
   v
Load Questions
   |
   v
Save Answers
   |
   v
Submit Attempt
   |
   v
Evaluate Answers
   |
   v
Update Attempt Result
```

---

## 10. Question-Bank Import Rules

The administrative question-bank module validates imported question data before replacement/import.

Important validation areas include:

- Exactly 100 questions for a complete test
- Required columns present
- Duplicate Question IDs
- Blank required fields
- Valid `CorrectAnswer` values
- Valid marks
- Correct `TestNo`
- Active question status

A test should not be treated as ready unless its active question count satisfies the configured requirement.

---

## 11. Data Integrity Considerations

The following relationships should remain consistent:

- A registered student should correspond to a valid StudentMaster record.
- Every attempt should identify a student.
- Every answer should identify an attempt.
- Every answer should identify a valid question.
- Every active question should belong to the intended test.
- A completed attempt should have a corresponding result.
- A question bank should contain the required number of active questions before a test is opened.

---

## 12. Future Database Migration

For larger deployments, the logical structure can be migrated from Google Sheets to a relational database.

A future relational model could use:

```text
students
tests
questions
attempts
answers
settings
```

with primary keys and foreign keys replacing spreadsheet-based relationships.

The application architecture should preserve the same logical entities even if the physical storage layer changes.
