/*
 * CIVIL ENGINEERING PLACEMENT PORTAL
 * Public/GitHub-safe backend
 *
 * IMPORTANT:
 * - Replace CONFIG.SPREADSHEET_ID with your own Google Sheet ID in a private deployment.
 * - Keep admin credentials in Script Properties; never commit passwords.
 * - PHOTO_FOLDER_ID is intentionally blank by default.
 * - Review CONFIG.SCHEDULE before each deployment.
 *
 * This file intentionally contains no institution-specific IDs, student records,
 * deployment URLs, or plaintext passwords.
 */

const CONFIG = {
  SPREADSHEET_ID: 'PASTE_YOUR_STANDALONE_SPREADSHEET_ID_HERE',
  SHEETS: { STUDENTS:'Students', MASTER:'StudentMaster', QUESTIONS:'Questions', ATTEMPTS:'Attempts', ANSWERS:'Answers', SETTINGS:'Settings' },
  TOTAL_TESTS: 11, TOTAL_QUESTIONS: 100, DURATION_MINUTES: 90, ADMIN_USER: 'admin',
  PHOTO_FOLDER_ID: '',
  SCHEDULE: {
    1:{date:'2026-10-05',start:'13:50',end:'15:20'}, 2:{date:'2026-10-06',start:'13:50',end:'15:20'},
    3:{date:'2026-10-07',start:'13:50',end:'15:20'}, 4:{date:'2026-10-08',start:'13:50',end:'15:20'},
    5:{date:'2026-10-09',start:'13:50',end:'15:20'}, 6:{date:'2026-10-10',start:'13:50',end:'15:20'},
    7:{date:'2026-10-12',start:'13:50',end:'15:20'}, 8:{date:'2026-10-13',start:'13:50',end:'15:20'},
    9:{date:'2026-10-14',start:'13:50',end:'15:20'}, 10:{date:'2026-10-15',start:'13:50',end:'15:20'},
    11:{date:'2026-10-16',start:'13:50',end:'15:20'}
  }
};
function assertConfig_(){ if(!CONFIG.SPREADSHEET_ID || CONFIG.SPREADSHEET_ID.indexOf('PASTE_')===0) throw new Error('Configure CONFIG.SPREADSHEET_ID with your standalone Google Sheet ID first.'); }

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Civil Engineering Placement Portal')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getSS_(){ assertConfig_(); return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID); }

function headers_(sheet){
  return sheet.getRange(1,1,1,Math.max(1,sheet.getLastColumn())).getValues()[0].map(String);
}

function col_(sheet,name){
  const h=headers_(sheet), i=h.indexOf(name);
  if(i<0) throw new Error('Column "'+name+'" not found in '+sheet.getName());
  return i+1;
}

function ensureColumn_(sheet,name){
  if(headers_(sheet).indexOf(name)<0)
    sheet.getRange(1,sheet.getLastColumn()+1).setValue(name);
}

function setupV4(){
  const ss=getSS_();

  const defs={
    StudentMaster:['Roll No','Name of the Student','Branch','Section'],
    Students:['StudentId','RollNo','Name','FatherName','Branch','Section','Mobile','Email','PasswordHash','CreatedAt','Status','LastLogin'],
    Questions:['QuestionId','TestNo','Topic','Question','OptionA','OptionB','OptionC','OptionD','CorrectAnswer','Marks','Active'],
    Attempts:['AttemptId','StudentId','StartTime','EndTime','Status','Score','Correct','Wrong','Unanswered','DurationSec','TestNo'],
    Answers:['AttemptId','QuestionId','Answer','SavedAt','IsCorrect'],
    Settings:['Key','Value']
  };

  Object.keys(defs).forEach(function(n){
    let sh=ss.getSheetByName(n);
    if(!sh) sh=ss.insertSheet(n);
    if(sh.getLastRow()===0){
      sh.getRange(1,1,1,defs[n].length).setValues([defs[n]]);
      sh.setFrozenRows(1);
    }
  });

  ensureColumn_(ss.getSheetByName('Attempts'),'TestNo');

  const settings=ss.getSheetByName('Settings');
  const rows=settings.getDataRange().getValues();
  const existing={};
  for(let i=1;i<rows.length;i++) existing[String(rows[i][0])]=rows[i][1];

  const add=function(k,v){
    if(existing[k]===undefined || existing[k]==='') settings.appendRow([k,v]);
  };

  add('DurationMinutes',CONFIG.DURATION_MINUTES);
  add('TotalQuestions',CONFIG.TOTAL_QUESTIONS);
  add('TotalTests',CONFIG.TOTAL_TESTS);

  for(let t=1;t<=CONFIG.TOTAL_TESTS;t++){
    add('TestTitle'+t,'Civil Engineering Placement Test '+t);
    add('Test'+t+'AdminUnlock','FALSE');
    add('Test'+t+'PasswordHash','');
  }

  // If the current Questions sheet contains exactly 100 active questions and they
  // are split across topic/group TestNo values, treat this uploaded 100-question bank
  // as Test 1. This matches the project's rule: one 100-question CSV = one test.
  normalizeSingle100QuestionBankToTest1_();

  // Expiry processor: runs independently of the student's browser.
  ScriptApp.getProjectTriggers().forEach(function(tr){
    if(tr.getHandlerFunction()==='processExpiredAttempts') ScriptApp.deleteTrigger(tr);
  });
  ScriptApp.newTrigger('processExpiredAttempts').timeBased().everyMinutes(5).create();

  return 'V4 setup completed. 11-test schedule, admin unlock settings and expiry trigger are ready.';
}

function sha256_(text){
  const raw=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(text),Utilities.Charset.UTF_8);
  return raw.map(function(b){
    const v=(b<0?b+256:b).toString(16);
    return v.length===1?'0'+v:v;
  }).join('');
}

function randomPassword_(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let p='';
  for(let i=0;i<10;i++) p+=chars.charAt(Math.floor(Math.random()*chars.length));
  return p;
}

function getSettings_(){
  const sh=getSS_().getSheetByName(CONFIG.SHEETS.SETTINGS);
  const rows=sh.getDataRange().getValues(), o={};
  for(let i=1;i<rows.length;i++) o[String(rows[i][0])]=rows[i][1];
  return o;
}

function setSetting_(key,value){
  const sh=getSS_().getSheetByName(CONFIG.SHEETS.SETTINGS);
  const rows=sh.getDataRange().getValues();
  for(let i=1;i<rows.length;i++){
    if(String(rows[i][0])===String(key)){
      sh.getRange(i+1,2).setValue(value);
      return;
    }
  }
  sh.appendRow([key,value]);
}

/* ---------- STUDENT MASTER LOOKUP ----------
   Roll-only registration. The official student details are read directly from
   the master tab in the same spreadsheet. The master tab is targeted by GID
   first, then all other tabs are scanned as a fallback.
*/


function normalizeHeader_(value){
  return String(value == null ? '' : value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,'');
}

function headerMatches_(value, aliases){
  const h=normalizeHeader_(value);
  return aliases.some(function(a){ return h===normalizeHeader_(a); });
}

function findMasterHeader_(sheet){
  const lastRow=sheet.getLastRow(), lastCol=sheet.getLastColumn();
  if(lastRow<1 || lastCol<1) return null;

  // Header is normally near the top. Inspect the first 50 rows to tolerate
  // title/institute rows above the actual column headings.
  const scanRows=Math.min(50,lastRow);
  const data=sheet.getRange(1,1,scanRows,lastCol).getDisplayValues();
  const rollAliases=[
    'rollno','roll no','roll number','rollnumber',
    'student roll no','student roll number','studentrollno',
    'reg no','regd no','regdno','registration no','registration number',
    'admission no','admission number','student id','studentid'
  ];
  const nameAliases=['name','student name','studentname','student full name','full name','name of the student','nameofthestudent'];

  for(let r=0;r<data.length;r++){
    let rollIndex=-1, nameIndex=-1;
    for(let c=0;c<data[r].length;c++){
      if(rollIndex<0 && headerMatches_(data[r][c],rollAliases)) rollIndex=c;
      if(nameIndex<0 && headerMatches_(data[r][c],nameAliases)) nameIndex=c;
    }
    if(rollIndex>=0 && nameIndex>=0){
      return {row:r+1,rollCol:rollIndex+1,nameCol:nameIndex+1};
    }
  }
  return null;
}

function findStudentMasterSheet_(){
  const ss=getSS_(), sh=ss.getSheetByName(CONFIG.SHEETS.MASTER);
  if(!sh) return null; const header=findMasterHeader_(sh);
  return header ? {sheet:sh,header:header} : null;
}

function getStudentByRollNo(rollNo){
  rollNo=String(rollNo||'').trim();
  if(!rollNo) throw new Error('Enter Roll Number.');

  const found=findStudentMasterSheet_();
  if(!found){
    const ss=getSS_();
    const info=ss.getSheets().map(function(sh){
      return sh.getName()+' [gid '+sh.getSheetId()+']';
    }).join(', ');
    throw new Error(
      'StudentMaster sheet was found by name/GID, but its required headers were not detected. ' +
      'Required headers: Roll No, Name of the Student, Branch, Section. ' +
      'Available sheets: ' + info
    );
  }

  const sh=found.sheet, headerRow=found.header.row-1;
  const lastRow=sh.getLastRow(), lastCol=sh.getLastColumn();
  const values=sh.getRange(1,1,lastRow,lastCol).getDisplayValues();
  const rawHeaders=values[headerRow];

  const idx=function(aliases){
    for(let c=0;c<rawHeaders.length;c++){
      if(headerMatches_(rawHeaders[c],aliases)) return c;
    }
    return -1;
  };

  const ri=idx(['rollno','roll no','roll number','rollnumber','student roll no','student roll number','studentrollno','reg no','regd no','registration no','registration number','admission no','admission number','student id','studentid']);
  const ni=idx(['name','student name','studentname','student full name','full name','name of the student','nameofthestudent']);
  const bi=idx(['branch','department','branch name','programme','program','course']);
  const si=idx(['section','sec']);

  if(ri<0 || ni<0){
    throw new Error('Master sheet was found, but Roll No and Name columns could not be identified.');
  }

  const target=normalizeHeader_(rollNo);
  for(let r=headerRow+1;r<values.length;r++){
    const masterRoll=String(values[r][ri]||'').trim();
    if(normalizeHeader_(masterRoll)===target){
      return {
        found:true,
        rollNo:masterRoll,
        name:ni>=0?String(values[r][ni]||'').trim():'',
        branch:bi>=0?String(values[r][bi]||'').trim():'Civil Engineering',
        section:si>=0?String(values[r][si]||'').trim():''
      };
    }
  }

  throw new Error('Roll Number '+rollNo+' was not found in the master student data.');
}

function getMasterSheetDiagnostics(){
  const ss=getSS_();
  return ss.getSheets().map(function(sh){
    const h=findMasterHeader_(sh);
    return {
      name:sh.getName(),
      gid:sh.getSheetId(),
      rows:sh.getLastRow(),
      columns:sh.getLastColumn(),
      detectedHeaderRow:h?h.row:null,
      detectedRollColumn:h?h.rollCol:null,
      detectedNameColumn:h?h.nameCol:null
    };
  });
}

function registerStudent(data){
  if(!data) throw new Error('Registration data missing.');
  const roll=String(data.rollNo||'').trim();
  if(!roll) throw new Error('Roll Number is required.');

  // Always fetch official details from the master data; do not trust editable UI fields.
  const master=getStudentByRollNo(roll);
  const sh=getSS_().getSheetByName('Students'), rows=sh.getDataRange().getValues(), h=headers_(sh);
  for(let i=1;i<rows.length;i++)
    if(String(rows[i][h.indexOf('RollNo')]).trim().toUpperCase()===roll.toUpperCase())
      throw new Error('This Roll Number is already registered.');

  const password=randomPassword_(), studentId='STU-'+Utilities.getUuid().slice(0,8).toUpperCase();
  // Keep the existing Students schema for compatibility, but leave optional
  // personal-contact fields blank.
  sh.appendRow([
    studentId,master.rollNo,master.name,'',
    master.branch||'Civil Engineering',master.section||'',
    '', '', sha256_(password),new Date(),'ACTIVE',''
  ]);
  return {ok:true,studentId:studentId,username:master.rollNo,password:password,student:master};
}

function login(username,password){
  username=String(username||'').trim();
  password=String(password||'');
  const sh=getSS_().getSheetByName('Students'), rows=sh.getDataRange().getValues(), h=headers_(sh);
  let student=null,row=-1;

  for(let i=1;i<rows.length;i++){
    if(String(rows[i][h.indexOf('RollNo')]).trim().toUpperCase()===username.toUpperCase()){
      student={
        studentId:rows[i][h.indexOf('StudentId')],
        rollNo:rows[i][h.indexOf('RollNo')],
        name:rows[i][h.indexOf('Name')],
        branch:rows[i][h.indexOf('Branch')],
        section:rows[i][h.indexOf('Section')],
        status:rows[i][h.indexOf('Status')],
        passwordHash:rows[i][h.indexOf('PasswordHash')]
      };
      row=i+1; break;
    }
  }

  if(!student || sha256_(password)!==String(student.passwordHash))
    throw new Error('Invalid Roll Number or Password.');
  if(String(student.status).toUpperCase()!=='ACTIVE') throw new Error('Your account is not active.');

  const token=Utilities.getUuid()+'-'+Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty('SESSION_'+student.studentId,token);
  sh.getRange(row,col_(sh,'LastLogin')).setValue(new Date());

  return {
    ok:true,
    studentId:student.studentId,
    token:token,
    rollNo:student.rollNo,
    name:student.name,
    branch:student.branch,
    section:student.section,
    photoDataUrl:findStudentPhotoDataUrl_(student.rollNo)
  };
}

function validSession_(studentId,token){
  return !!studentId && !!token &&
    PropertiesService.getScriptProperties().getProperty('SESSION_'+studentId)===String(token);
}

function logoutStudent(studentId,token){
  if(validSession_(studentId,token))
    PropertiesService.getScriptProperties().deleteProperty('SESSION_'+studentId);
  return {ok:true};
}


/* ---------- OPTIONAL STUDENT PHOTOS ---------- */
function blobToDataUrl_(blob){ return 'data:'+(blob.getContentType()||'application/octet-stream')+';base64,'+Utilities.base64Encode(blob.getBytes()); }
function findStudentPhotoDataUrl_(rollNo){
  if(!CONFIG.PHOTO_FOLDER_ID) return ''; const clean=String(rollNo||'').trim().toLowerCase(); if(!clean) return '';
  const files=DriveApp.getFolderById(CONFIG.PHOTO_FOLDER_ID).getFiles();
  while(files.hasNext()){ const f=files.next(), base=String(f.getName()).replace(/\.[^.]+$/,'').trim().toLowerCase(); if(base===clean && String(f.getMimeType()).indexOf('image/')===0) return blobToDataUrl_(f.getBlob()); }
  return '';
}
function getStudentProfileAssets(studentId,token){
  if(!validSession_(studentId,token)) throw new Error('Session expired.'); const sh=getSS_().getSheetByName(CONFIG.SHEETS.STUDENTS), rows=sh.getDataRange().getValues(), h=headers_(sh);
  for(let i=1;i<rows.length;i++) if(String(rows[i][h.indexOf('StudentId')])===String(studentId)) return {photoDataUrl:findStudentPhotoDataUrl_(rows[i][h.indexOf('RollNo')])};
  throw new Error('Student not found.');
}

/* ---------- SCHEDULE / ACCESS ---------- */

function scheduleFor_(testNo){ return CONFIG.SCHEDULE[Number(testNo)]; }

function nowParts_(){
  const now=new Date();
  return {
    date:Utilities.formatDate(now,'Asia/Kolkata','yyyy-MM-dd'),
    time:Utilities.formatDate(now,'Asia/Kolkata','HH:mm')
  };
}

function scheduleState_(testNo){
  const s=scheduleFor_(testNo), now=nowParts_();
  if(!s) return {state:'LOCKED',label:'SCHEDULE NOT SET'};
  if(now.date<s.date) return {state:'UPCOMING',label:'LOCKED',schedule:s};
  if(now.date>s.date) return {state:'POST_SCHEDULE',label:'PASSWORD REQUIRED',schedule:s};
  if(now.time<s.start) return {state:'BEFORE',label:'LOCKED',schedule:s};
  if(now.time<=s.end) return {state:'LIVE',label:'OPEN NOW',schedule:s};
  return {state:'POST_SCHEDULE',label:'PASSWORD REQUIRED',schedule:s};
}

function adminUnlocked_(testNo){
  const st=getSettings_();
  return String(st['Test'+testNo+'AdminUnlock']||'FALSE').toUpperCase()==='TRUE';
}

function normalizeSingle100QuestionBankToTest1_(){
  const sh=getSS_().getSheetByName('Questions');
  if(!sh || sh.getLastRow()<2) return;
  const rows=sh.getDataRange().getValues(), h=headers_(sh);
  const ti=h.indexOf('TestNo'), ai=h.indexOf('Active');
  if(ti<0||ai<0) return;
  let activeRows=[];
  for(let i=1;i<rows.length;i++){
    const a=String(rows[i][ai]).toUpperCase();
    if(a==='TRUE'||a==='YES'||a==='1') activeRows.push(i+1);
  }
  if(activeRows.length!==CONFIG.TOTAL_QUESTIONS) return;
  const counts={};
  activeRows.forEach(r=>{ const v=String(sh.getRange(r,ti+1).getValue()).trim(); counts[v]=(counts[v]||0)+1; });
  if(counts['1']===CONFIG.TOTAL_QUESTIONS) return;
  const vals=activeRows.map(()=>[1]);
  sh.getRange(activeRows[0],ti+1,activeRows.length,1).setValues(vals);
}

function assignAllCurrentQuestionsToTest(adminToken,testNo){
  if(!validAdmin_(adminToken)) throw new Error('Admin session expired.');
  testNo=Number(testNo);
  if(testNo<1||testNo>CONFIG.TOTAL_TESTS) throw new Error('Invalid test.');
  const sh=getSS_().getSheetByName('Questions'), rows=sh.getDataRange().getValues(), h=headers_(sh);
  const ti=h.indexOf('TestNo'), ai=h.indexOf('Active');
  if(ti<0||ai<0) throw new Error('Questions sheet must contain TestNo and Active columns.');
  let count=0;
  for(let i=1;i<rows.length;i++){
    const a=String(rows[i][ai]).toUpperCase();
    if(a==='TRUE'||a==='YES'||a==='1'){ sh.getRange(i+1,ti+1).setValue(testNo); count++; }
  }
  return {ok:true,testNo:testNo,count:count};
}


function parseCSV_(text){
  text=String(text||'').replace(/^\uFEFF/,'');
  const rows=[]; let row=[], field='', inQuotes=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(inQuotes){
      if(ch==='"'){
        if(text[i+1]==='"'){field+='"';i++;}
        else inQuotes=false;
      } else field+=ch;
    } else {
      if(ch==='"' && field===''){inQuotes=true;}
      else if(ch===','){row.push(field);field='';}
      else if(ch==='\n'){row.push(field);rows.push(row);row=[];field='';}
      else if(ch==='\r'){}
      else field+=ch;
    }
  }
  row.push(field);
  if(row.length>1 || String(row[0]||'').trim()!=='') rows.push(row);
  return rows;
}

function validateQuestionBankCSV_(csvText,testNo){
  testNo=Number(testNo);
  if(testNo<1||testNo>CONFIG.TOTAL_TESTS) throw new Error('Invalid Test Number.');
  const rows=parseCSV_(csvText);
  const required=['QuestionId','TestNo','Topic','Question','OptionA','OptionB','OptionC','OptionD','CorrectAnswer','Marks','Active'];
  if(rows.length<2) throw new Error('CSV is empty or contains only headers.');
  const headers=rows[0].map(x=>String(x).trim());
  const idx={};
  required.forEach(k=>idx[k]=headers.indexOf(k));
  const missing=required.filter(k=>idx[k]<0);
  if(missing.length) throw new Error('Missing CSV columns: '+missing.join(', '));
  const data=rows.slice(1).filter(r=>r.some(x=>String(x||'').trim()!==''));
  if(data.length!==CONFIG.TOTAL_QUESTIONS) throw new Error('Question bank must contain exactly '+CONFIG.TOTAL_QUESTIONS+' questions. Found '+data.length+'.');

  const ids={}, errors=[];
  data.forEach((r,n)=>{
    const line=n+2, id=String(r[idx.QuestionId]||'').trim(), q=String(r[idx.Question]||'').trim();
    const topic=String(r[idx.Topic]||'').trim();
    const opts=['OptionA','OptionB','OptionC','OptionD'].map(k=>String(r[idx[k]]||'').trim());
    const ca=String(r[idx.CorrectAnswer]||'').trim().toUpperCase();
    const marks=Number(r[idx.Marks]);
    const active=String(r[idx.Active]||'').trim().toUpperCase();
    const suppliedTest=Number(r[idx.TestNo]);
    if(!id) errors.push('Line '+line+': QuestionId is blank.');
    if(id && ids[id]) errors.push('Line '+line+': duplicate QuestionId '+id+'.');
    ids[id]=true;
    if(!topic) errors.push('Line '+line+': Topic is blank.');
    if(!q) errors.push('Line '+line+': Question is blank.');
    if(opts.some(x=>!x)) errors.push('Line '+line+': all four options are required.');
    if(!['A','B','C','D'].includes(ca)) errors.push('Line '+line+': CorrectAnswer must be A, B, C or D.');
    if(!Number.isFinite(marks) || marks<=0) errors.push('Line '+line+': Marks must be a positive number.');
    if(suppliedTest!==testNo) errors.push('Line '+line+': TestNo '+suppliedTest+' does not match selected Test '+testNo+'.');
    if(!['TRUE','YES','1'].includes(active)) errors.push('Line '+line+': Active must be TRUE.');
  });
  if(errors.length) throw new Error('Validation failed:\n'+errors.slice(0,12).join('\n')+(errors.length>12?'\n...and '+(errors.length-12)+' more.':''));

  // Prevent QuestionId collisions with other tests. Existing rows belonging to the destination test may be replaced.
  const sh=getSS_().getSheetByName('Questions'), existing=sh.getDataRange().getValues(), h=headers_(sh);
  const eti=h.indexOf('TestNo'), eqi=h.indexOf('QuestionId');
  if(eti<0||eqi<0) throw new Error('Questions sheet structure is invalid.');
  const conflicts=[];
  for(let i=1;i<existing.length;i++){
    if(Number(existing[i][eti])!==testNo && ids[String(existing[i][eqi]).trim()]) conflicts.push(String(existing[i][eqi]));
  }
  if(conflicts.length) throw new Error('QuestionId already exists in another test: '+conflicts.slice(0,10).join(', '));

  const clean=data.map(r=>({
    QuestionId:String(r[idx.QuestionId]).trim(), TestNo:testNo, Topic:String(r[idx.Topic]).trim(), Question:String(r[idx.Question]).trim(),
    OptionA:String(r[idx.OptionA]).trim(), OptionB:String(r[idx.OptionB]).trim(), OptionC:String(r[idx.OptionC]).trim(), OptionD:String(r[idx.OptionD]).trim(),
    CorrectAnswer:String(r[idx.CorrectAnswer]).trim().toUpperCase(), Marks:Number(r[idx.Marks]), Active:true
  }));
  const topics={}; clean.forEach(x=>topics[x.Topic]=(topics[x.Topic]||0)+1);
  return {testNo:testNo,count:clean.length,questions:clean,topics:topics,first:clean.slice(0,5)};
}

function previewQuestionBankCSV(adminToken,csvText,testNo){
  if(!validAdmin_(adminToken)) throw new Error('Admin session expired.');
  const v=validateQuestionBankCSV_(csvText,testNo);
  return {ok:true,testNo:v.testNo,count:v.count,topics:v.topics,first:v.first};
}

function importQuestionBankCSV(adminToken,csvText,testNo){
  if(!validAdmin_(adminToken)) throw new Error('Admin session expired.');
  const v=validateQuestionBankCSV_(csvText,testNo);
  const ss=getSS_(), qsh=ss.getSheetByName('Questions'), ah=ss.getSheetByName('Attempts'), qh=headers_(qsh), rows=qsh.getDataRange().getValues();
  const ati=headers_(ah), atTest=ati.indexOf('TestNo'), atStatus=ati.indexOf('Status');
  if(atTest>=0){
    for(let i=1;i<ah.getLastRow();i++){
      if(Number(ah.getRange(i+1,atTest+1).getValue())===v.testNo){
        throw new Error('Test '+v.testNo+' already has attempt records. Question bank replacement is blocked to protect exam history.');
      }
    }
  }
  const ti=qh.indexOf('TestNo');
  const keep=[];
  for(let i=1;i<rows.length;i++) if(Number(rows[i][ti])!==v.testNo) keep.push(rows[i]);
  // Preserve header and every other test; replace only the selected test bank.
  qsh.clearContents();
  qsh.getRange(1,1,1,qh.length).setValues([qh]);
  if(keep.length) qsh.getRange(2,1,keep.length,qh.length).setValues(keep);
  const start=2+keep.length;
  const out=v.questions.map(x=>qh.map(h=>x[h]!==undefined?x[h]:''));
  qsh.getRange(start,1,out.length,qh.length).setValues(out);
  qsh.setFrozenRows(1);
  return {ok:true,testNo:v.testNo,count:v.count,topics:v.topics,message:'Test '+v.testNo+' question bank imported successfully.'};
}

function getQuestionBankSummary(adminToken){
  if(!validAdmin_(adminToken)) throw new Error('Admin session expired.');
  const counts=questionCounts_(), out=[];
  for(let t=1;t<=CONFIG.TOTAL_TESTS;t++) out.push({testNo:t,count:counts[String(t)]||0,ready:(counts[String(t)]||0)===CONFIG.TOTAL_QUESTIONS});
  return out;
}

function questionCounts_(){
  const sh=getSS_().getSheetByName('Questions'), rows=sh.getDataRange().getValues(), h=headers_(sh);
  const counts={};
  const ti=h.indexOf('TestNo'), ai=h.indexOf('Active');
  for(let i=1;i<rows.length;i++){
    const t=String(rows[i][ti]).trim(), a=String(rows[i][ai]).toUpperCase();
    if(t&&(a==='TRUE'||a==='YES'||a==='1')) counts[t]=(counts[t]||0)+1;
  }
  return counts;
}

function getTests(studentId,token){
  if(!validSession_(studentId,token)) throw new Error('Session expired.');
  processExpiredAttempts();

  const settings=getSettings_(), counts=questionCounts_(), tests=[];
  for(let t=1;t<=CONFIG.TOTAL_TESTS;t++){
    const count=counts[String(t)]||0, sc=scheduleState_(t), unlocked=adminUnlocked_(t);
    const attempt=findAttempt_(studentId,t);

    let state='LOCKED', label='LOCKED';
    if(count!==CONFIG.TOTAL_QUESTIONS){
      state='NOT_READY'; label='QUESTIONS NOT READY';
    } else if(attempt && String(attempt.Status).toUpperCase()==='SUBMITTED'){
      state='COMPLETED'; label='COMPLETED';
    } else if(unlocked){
      state='AVAILABLE'; label='OPEN NOW';
    } else if(sc.state==='LIVE'){
      state='AVAILABLE'; label='OPEN NOW';
    } else if(sc.state==='POST_SCHEDULE'){
      state='PASSWORD'; label='PASSWORD REQUIRED';
    } else {
      state='LOCKED'; label='LOCKED';
    }

    tests.push({
      testNo:t,
      title:String(settings['TestTitle'+t]||('Civil Engineering Placement Test '+t)),
      questionCount:count,
      required:CONFIG.TOTAL_QUESTIONS,
      durationMinutes:CONFIG.DURATION_MINUTES,
      scheduleDate:CONFIG.SCHEDULE[t].date,
      startTime:CONFIG.SCHEDULE[t].start,
      endTime:CONFIG.SCHEDULE[t].end,
      state:state,
      label:label,
      adminUnlocked:unlocked,
      attemptStatus:attempt?String(attempt.Status):'NOT_ATTEMPTED',
      score:attempt?Number(attempt.Score)||0:null,
      attemptId:attempt?String(attempt.AttemptId):null
    });
  }
  return {tests:tests};
}

function findAttempt_(studentId,testNo){
  const sh=getSS_().getSheetByName('Attempts'), rows=sh.getDataRange().getValues(), h=headers_(sh);
  const si=h.indexOf('StudentId'), ti=h.indexOf('TestNo');
  for(let i=1;i<rows.length;i++){
    if(String(rows[i][si])===String(studentId)&&Number(rows[i][ti])===Number(testNo)){
      const o={row:i+1}; h.forEach((x,j)=>o[x]=rows[i][j]); return o;
    }
  }
  return null;
}

/* Student requests a test. A password is needed only after the normal schedule,
   unless admin has manually unlocked the test. */
function startTest(studentId,token,testNo,accessPassword){
  if(!validSession_(studentId,token)) throw new Error('Session expired.');
  testNo=Number(testNo);
  if(testNo<1||testNo>CONFIG.TOTAL_TESTS) throw new Error('Invalid test.');

  processExpiredAttempts();

  const counts=questionCounts_();
  if((counts[String(testNo)]||0)!==CONFIG.TOTAL_QUESTIONS)
    throw new Error('Test '+testNo+' must contain exactly 100 active questions. Current count: '+(counts[String(testNo)]||0)+'.');

  const existing=findAttempt_(studentId,testNo);
  if(existing){
    if(String(existing.Status).toUpperCase()==='SUBMITTED')
      throw new Error('You have already submitted Test '+testNo+'.');
    return loadExam_(studentId,testNo,existing);
  }

  const unlocked=adminUnlocked_(testNo);
  const sc=scheduleState_(testNo);

  if(!unlocked){
    if(sc.state==='UPCOMING'||sc.state==='BEFORE')
      throw new Error('Test '+testNo+' is locked. It opens on '+displayDate_(CONFIG.SCHEDULE[testNo].date)+' at '+displayTime_(CONFIG.SCHEDULE[testNo].start)+'.');

    if(sc.state==='POST_SCHEDULE'){
      const st=getSettings_(), hash=String(st['Test'+testNo+'PasswordHash']||'');
      if(!hash) throw new Error('The test is past its scheduled time, but the administrator has not generated a test password yet.');
      if(!accessPassword || sha256_(accessPassword)!==hash)
        throw new Error('Incorrect Test Password.');
    }
  }

  const sh=getSS_().getSheetByName('Attempts'), h=headers_(sh), id='ATT-'+Utilities.getUuid().slice(0,12).toUpperCase(), start=new Date(), vals={};
  h.forEach(function(x){vals[x]='';});
  vals.AttemptId=id; vals.StudentId=studentId; vals.StartTime=start; vals.Status='IN_PROGRESS';
  vals.Score=0; vals.Correct=0; vals.Wrong=0; vals.Unanswered=CONFIG.TOTAL_QUESTIONS; vals.DurationSec=0; vals.TestNo=testNo;
  sh.appendRow(h.map(x=>vals[x]));

  return loadExam_(studentId,testNo,findAttempt_(studentId,testNo));
}

function loadExam_(studentId,testNo,attempt){
  if(String(attempt.Status).toUpperCase()!=='IN_PROGRESS') throw new Error('This test is no longer active.');
  if(Date.now()>=new Date(attempt.StartTime).getTime()+CONFIG.DURATION_MINUTES*60000){
    submitAttemptCore_(studentId,testNo,attempt.AttemptId);
    throw new Error('Your 90-minute exam time has expired. The test was automatically submitted.');
  }

  const sh=getSS_().getSheetByName('Questions'), rows=sh.getDataRange().getValues(), h=headers_(sh), qs=[];
  for(let i=1;i<rows.length;i++){
    const active=String(rows[i][h.indexOf('Active')]).toUpperCase();
    if((active==='TRUE'||active==='YES'||active==='1')&&Number(rows[i][h.indexOf('TestNo')])===Number(testNo)){
      qs.push({
        questionId:String(rows[i][h.indexOf('QuestionId')]),
        topic:rows[i][h.indexOf('Topic')], question:rows[i][h.indexOf('Question')],
        optionA:rows[i][h.indexOf('OptionA')], optionB:rows[i][h.indexOf('OptionB')],
        optionC:rows[i][h.indexOf('OptionC')], optionD:rows[i][h.indexOf('OptionD')],
        marks:Number(rows[i][h.indexOf('Marks')])||1
      });
    }
  }
  if(qs.length!==CONFIG.TOTAL_QUESTIONS) throw new Error('Test must contain exactly 100 active questions.');
  return {attemptId:String(attempt.AttemptId),testNo:Number(testNo),startTime:new Date(attempt.StartTime).getTime(),durationMinutes:CONFIG.DURATION_MINUTES,questions:qs};
}

function saveAnswer(studentId,token,attemptId,testNo,questionId,answer){
  if(!validSession_(studentId,token)) throw new Error('Session expired.');
  const attempt=findAttempt_(studentId,testNo);
  if(!attempt||String(attempt.AttemptId)!==String(attemptId)) throw new Error('Invalid attempt.');
  if(String(attempt.Status).toUpperCase()!=='IN_PROGRESS') throw new Error('Exam is no longer active.');
  if(Date.now()>=new Date(attempt.StartTime).getTime()+CONFIG.DURATION_MINUTES*60000){
    submitAttemptCore_(studentId,testNo,attemptId); throw new Error('Exam time has expired.');
  }

  const sh=getSS_().getSheetByName('Answers'), rows=sh.getDataRange().getValues(), h=headers_(sh);
  const ai=h.indexOf('AttemptId'), qi=h.indexOf('QuestionId'); let found=-1;
  for(let i=1;i<rows.length;i++) if(String(rows[i][ai])===String(attemptId)&&String(rows[i][qi])===String(questionId)){found=i+1;break;}
  const v={}; h.forEach(x=>v[x]=''); v.AttemptId=attemptId;v.QuestionId=questionId;v.Answer=String(answer||'');v.SavedAt=new Date();
  const arr=h.map(x=>v[x]);
  if(found>0) sh.getRange(found,1,1,h.length).setValues([arr]); else sh.appendRow(arr);
  return {ok:true};
}

function submitExam(studentId,token,testNo,attemptId){
  if(!validSession_(studentId,token)) throw new Error('Session expired.');
  return submitAttemptCore_(studentId,Number(testNo),attemptId);
}

function submitAttemptCore_(studentId,testNo,attemptId){
  const ss=getSS_(), as=ss.getSheetByName('Attempts'), qs=ss.getSheetByName('Questions'), ans=ss.getSheetByName('Answers');
  const attempt=findAttempt_(studentId,testNo);
  if(!attempt||String(attempt.AttemptId)!==String(attemptId)) throw new Error('Attempt not found.');
  if(String(attempt.Status).toUpperCase()==='SUBMITTED') return resultFromAttempt_(attempt);

  const qr=qs.getDataRange().getValues(), qh=headers_(qs), ar=ans.getDataRange().getValues(), ah=headers_(ans);
  const amap={}, arow={};
  for(let i=1;i<ar.length;i++) if(String(ar[i][ah.indexOf('AttemptId')])===String(attemptId)){
    amap[String(ar[i][ah.indexOf('QuestionId')])]=String(ar[i][ah.indexOf('Answer')]||'').trim().toUpperCase();
    arow[String(ar[i][ah.indexOf('QuestionId')])]=i+1;
  }

  let score=0,correct=0,wrong=0,unanswered=0;
  for(let i=1;i<qr.length;i++){
    if(Number(qr[i][qh.indexOf('TestNo')])!==Number(testNo)) continue;
    const qid=String(qr[i][qh.indexOf('QuestionId')]), selected=amap[qid]||'', ca=String(qr[i][qh.indexOf('CorrectAnswer')]||'').trim().toUpperCase(), marks=Number(qr[i][qh.indexOf('Marks')])||1;
    let ok=false;
    if(!selected) unanswered++;
    else if(selected===ca){correct++;score+=marks;ok=true;}
    else wrong++;
    if(arow[qid]) ans.getRange(arow[qid],ah.indexOf('IsCorrect')+1).setValue(ok?'TRUE':'FALSE');
  }

  const end=new Date(), dur=Math.max(0,Math.floor((end-new Date(attempt.StartTime))/1000)), h=headers_(as), v={};
  h.forEach(x=>v[x]=attempt[x]||'');
  v.EndTime=end;v.Status='SUBMITTED';v.Score=score;v.Correct=correct;v.Wrong=wrong;v.Unanswered=unanswered;v.DurationSec=dur;v.TestNo=testNo;
  as.getRange(attempt.row,1,1,h.length).setValues([h.map(x=>v[x])]);
  return {ok:true,attemptId:attemptId,testNo:testNo,score:score,total:CONFIG.TOTAL_QUESTIONS,correct:correct,wrong:wrong,unanswered:unanswered,durationSec:dur};
}

function resultFromAttempt_(a){
  return {ok:true,attemptId:String(a.AttemptId),testNo:Number(a.TestNo),score:Number(a.Score)||0,total:CONFIG.TOTAL_QUESTIONS,correct:Number(a.Correct)||0,wrong:Number(a.Wrong)||0,unanswered:Number(a.Unanswered)||0,durationSec:Number(a.DurationSec)||0};
}

function processExpiredAttempts(){
  const sh=getSS_().getSheetByName('Attempts'), rows=sh.getDataRange().getValues(), h=headers_(sh);
  const si=h.indexOf('StudentId'),ti=h.indexOf('TestNo'),st=h.indexOf('Status'),start=h.indexOf('StartTime'),id=h.indexOf('AttemptId');
  for(let i=1;i<rows.length;i++){
    if(String(rows[i][st]).toUpperCase()==='IN_PROGRESS'&&rows[i][start]&&Date.now()>=new Date(rows[i][start]).getTime()+CONFIG.DURATION_MINUTES*60000){
      try{submitAttemptCore_(String(rows[i][si]),Number(rows[i][ti]),String(rows[i][id]));}catch(e){}
    }
  }
  return {ok:true};
}

/* ---------- RESPONSE SHEET / PDF ---------- */

function getMyResponses(studentId,token,attemptId,testNo){
  if(!validSession_(studentId,token)) throw new Error('Session expired.');
  const attempt=findAttempt_(studentId,Number(testNo));
  if(!attempt||String(attempt.AttemptId)!==String(attemptId)) throw new Error('Invalid response request.');
  if(String(attempt.Status).toUpperCase()!=='SUBMITTED') throw new Error('Response sheet is available after submission.');

  const ss=getSS_(), sh=ss.getSheetByName('Students'), qs=ss.getSheetByName('Questions'), as=ss.getSheetByName('Answers');
  const sr=sh.getDataRange().getValues(), hh=headers_(sh);
  let student={};
  for(let i=1;i<sr.length;i++) if(String(sr[i][hh.indexOf('StudentId')])===String(studentId)){
    student={name:sr[i][hh.indexOf('Name')],rollNo:sr[i][hh.indexOf('RollNo')],branch:sr[i][hh.indexOf('Branch')],section:sr[i][hh.indexOf('Section')]};break;
  }

  const qr=qs.getDataRange().getValues(), qh=headers_(qs), ar=as.getDataRange().getValues(), ah=headers_(as), amap={};
  for(let i=1;i<ar.length;i++) if(String(ar[i][ah.indexOf('AttemptId')])===String(attemptId)) amap[String(ar[i][ah.indexOf('QuestionId')])]=String(ar[i][ah.indexOf('Answer')]||'').trim().toUpperCase();

  const responses=[];let no=0;
  for(let i=1;i<qr.length;i++){
    if(Number(qr[i][qh.indexOf('TestNo')])!==Number(testNo)) continue;
    no++;
    const qid=String(qr[i][qh.indexOf('QuestionId')]),sel=amap[qid]||'',ca=String(qr[i][qh.indexOf('CorrectAnswer')]||'').trim().toUpperCase(),marks=Number(qr[i][qh.indexOf('Marks')])||1;
    responses.push({
      questionNo:no,questionId:qid,topic:qr[i][qh.indexOf('Topic')],question:qr[i][qh.indexOf('Question')],
      optionA:qr[i][qh.indexOf('OptionA')],optionB:qr[i][qh.indexOf('OptionB')],optionC:qr[i][qh.indexOf('OptionC')],optionD:qr[i][qh.indexOf('OptionD')],
      selectedAnswer:sel,selectedText:optionText_(qr[i],qh,sel),correctAnswer:ca,correctText:optionText_(qr[i],qh,ca),
      status:!sel?'UNANSWERED':sel===ca?'CORRECT':'WRONG',marksAwarded:sel===ca?marks:0,maxMarks:marks
    });
  }
  return {student:student,attempt:{attemptId:attempt.AttemptId,testNo:Number(testNo),score:Number(attempt.Score)||0,total:CONFIG.TOTAL_QUESTIONS,correct:Number(attempt.Correct)||0,wrong:Number(attempt.Wrong)||0,unanswered:Number(attempt.Unanswered)||0,durationSec:Number(attempt.DurationSec)||0,endTime:new Date(attempt.EndTime).getTime()},responses:responses};
}

function optionText_(row,h,l){
  const m={A:'OptionA',B:'OptionB',C:'OptionC',D:'OptionD'};
  return l&&m[l]?row[h.indexOf(m[l])]:'';
}

function generateResponsePDF(studentId,token,attemptId,testNo){
  const d=getMyResponses(studentId,token,attemptId,testNo),s=d.student,a=d.attempt;
  const doc=DocumentApp.create('Response Sheet - '+s.rollNo+' - Test '+testNo),body=doc.getBody();
  body.appendParagraph('CIVIL ENGINEERING PLACEMENT PREPARATION').setHeading(DocumentApp.ParagraphHeading.TITLE).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph('STUDENT RESPONSE SHEET - TEST '+testNo).setHeading(DocumentApp.ParagraphHeading.HEADING1).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendTable([['Student Name',String(s.name)],['Roll Number',String(s.rollNo)],['Branch',String(s.branch)],['Section',String(s.section)],['Score',a.score+' / '+a.total],['Correct',String(a.correct)],['Wrong',String(a.wrong)],['Unanswered',String(a.unanswered)],['Time Taken',formatDuration_(a.durationSec)],['Submitted On',formatDate_(a.endTime)]]);
  d.responses.forEach(function(x){
    body.appendParagraph('Q'+x.questionNo+'. '+x.question).setBold(true);
    body.appendParagraph('A. '+x.optionA);body.appendParagraph('B. '+x.optionB);body.appendParagraph('C. '+x.optionC);body.appendParagraph('D. '+x.optionD);
    body.appendParagraph('Your Answer: '+(x.selectedAnswer?x.selectedAnswer+'. '+x.selectedText:'Not Answered'));
    body.appendParagraph('Correct Answer: '+x.correctAnswer+'. '+x.correctText);
    body.appendParagraph('Status: '+x.status+' | Marks: '+x.marksAwarded+' / '+x.maxMarks);body.appendHorizontalRule();
  });
  doc.saveAndClose();Utilities.sleep(700);
  const f=DriveApp.getFileById(doc.getId()),b=f.getAs(MimeType.PDF),base64=Utilities.base64Encode(b.getBytes());f.setTrashed(true);
  return {ok:true,fileName:'Response_Sheet_'+s.rollNo+'_Test_'+testNo+'.pdf',base64:base64};
}

function formatDuration_(s){s=Number(s)||0;return String(Math.floor(s/3600)).padStart(2,'0')+':'+String(Math.floor(s%3600/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}
function formatDate_(ms){return Utilities.formatDate(new Date(ms),'Asia/Kolkata','dd-MM-yyyy HH:mm:ss');}
function displayDate_(d){const p=d.split('-');return p[2]+'-'+p[1]+'-'+p[0];}
function displayTime_(t){const p=t.split(':');let h=Number(p[0]),ampm=h>=12?'PM':'AM';h=h%12||12;return String(h).padStart(2,'0')+':'+p[1]+' '+ampm;}

/* ---------- ADMIN ---------- */

function setAdminPassword(newPassword){
  if(!newPassword || String(newPassword).length<10) throw new Error('Admin password must be at least 10 characters.');
  PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD_HASH',sha256_(String(newPassword)));
  return 'Admin password set successfully.';
}

function adminLogin(username,password){
  if(String(username).trim()!==CONFIG.ADMIN_USER) throw new Error('Invalid admin credentials.');
  const hash=PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD_HASH');
  if(!hash) throw new Error('Run setAdminPassword() once.');
  if(sha256_(password)!==hash) throw new Error('Invalid admin credentials.');
  const token=Utilities.getUuid()+'-'+Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty('ADMIN_SESSION',token);
  return {ok:true,token:token};
}

function validAdmin_(token){return PropertiesService.getScriptProperties().getProperty('ADMIN_SESSION')===String(token);}
function adminLogout(token){if(validAdmin_(token))PropertiesService.getScriptProperties().deleteProperty('ADMIN_SESSION');return {ok:true};}

function setTestUnlock(adminToken,testNo,unlock){
  if(!validAdmin_(adminToken)) throw new Error('Admin session expired.');
  testNo=Number(testNo);
  if(testNo<1||testNo>CONFIG.TOTAL_TESTS) throw new Error('Invalid test.');
  setSetting_('Test'+testNo+'AdminUnlock',unlock?'TRUE':'FALSE');
  return {ok:true,testNo:testNo,unlocked:!!unlock};
}

function generateTestPassword(adminToken,testNo){
  if(!validAdmin_(adminToken)) throw new Error('Admin session expired.');
  testNo=Number(testNo);
  if(testNo<1||testNo>CONFIG.TOTAL_TESTS) throw new Error('Invalid test.');
  const p=randomPassword_();
  setSetting_('Test'+testNo+'PasswordHash',sha256_(p));
  return {ok:true,testNo:testNo,password:p};
}

function resetStudentPassword(adminToken,rollNo){
  if(!validAdmin_(adminToken)) throw new Error('Admin session expired.');
  rollNo=String(rollNo||'').trim();
  const sh=getSS_().getSheetByName('Students'),rows=sh.getDataRange().getValues(),h=headers_(sh);
  for(let i=1;i<rows.length;i++){
    if(String(rows[i][h.indexOf('RollNo')]).trim().toUpperCase()===rollNo.toUpperCase()){
      const p=randomPassword_();sh.getRange(i+1,h.indexOf('PasswordHash')+1).setValue(sha256_(p));
      return {ok:true,rollNo:rows[i][h.indexOf('RollNo')],name:rows[i][h.indexOf('Name')],password:p};
    }
  }
  throw new Error('Student Roll Number not found.');
}

function getAdminData(adminToken){
  if(!validAdmin_(adminToken)) throw new Error('Admin session expired.');
  const tests=getAdminTests_();
  const ss=getSS_(),sh=ss.getSheetByName('Students'),as=ss.getSheetByName('Attempts');
  const sr=sh.getDataRange().getValues(),ar=as.getDataRange().getValues(),h=headers_(sh),ah=headers_(as),students={};
  const studentStatusIndex=h.indexOf('Status');
  let activeStudents=0;
  for(let i=1;i<sr.length;i++){
    const sid=String(sr[i][h.indexOf('StudentId')]);
    students[sid]={
      rollNo:sr[i][h.indexOf('RollNo')],
      name:sr[i][h.indexOf('Name')],
      section:sr[i][h.indexOf('Section')],
      branch:sr[i][h.indexOf('Branch')],
      status:studentStatusIndex>=0?String(sr[i][studentStatusIndex]||'ACTIVE'):'ACTIVE'
    };
    if(String(sr[i][studentStatusIndex]||'ACTIVE').toUpperCase()!=='INACTIVE') activeStudents++;
  }

  const results=ar.slice(1).filter(r=>String(r[ah.indexOf('AttemptId')]||'').trim()).map(r=>{
    const st=students[String(r[ah.indexOf('StudentId')])]||{};
    const score=Number(r[ah.indexOf('Score')])||0;
    const status=String(r[ah.indexOf('Status')]||'');
    return {
      rollNo:st.rollNo||'', name:st.name||'', section:st.section||'', branch:st.branch||'',
      testNo:Number(r[ah.indexOf('TestNo')])||0, status:status, score:score,
      percentage:Math.round(score/CONFIG.TOTAL_QUESTIONS*10000)/100,
      correct:Number(r[ah.indexOf('Correct')])||0,
      wrong:Number(r[ah.indexOf('Wrong')])||0,
      unanswered:Number(r[ah.indexOf('Unanswered')])||0,
      durationSec:Number(r[ah.indexOf('DurationSec')])||0,
      startTime:r[ah.indexOf('StartTime')] ? new Date(r[ah.indexOf('StartTime')]).getTime() : null,
      endTime:r[ah.indexOf('EndTime')] ? new Date(r[ah.indexOf('EndTime')]).getTime() : null
    };
  });

  const submitted=results.filter(r=>String(r.status).toUpperCase()==='SUBMITTED');
  const inProgress=results.filter(r=>String(r.status).toUpperCase()==='IN_PROGRESS');
  const avg=submitted.length ? Math.round(submitted.reduce((a,r)=>a+r.percentage,0)/submitted.length*100)/100 : 0;
  const readyTests=tests.filter(t=>t.count===t.required).length;

  return {
    tests:tests,
    results:results,
    stats:{
      totalStudents:sr.length-1,
      activeStudents:activeStudents,
      readyTests:readyTests,
      totalTests:CONFIG.TOTAL_TESTS,
      submitted:submitted.length,
      inProgress:inProgress.length,
      averagePercentage:avg
    }
  };
}

function csvEscape_(value){
  const s=String(value==null?'':value);
  return /[",\\n\\r]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s;
}

function exportAdminResultsCSV(adminToken){
  if(!validAdmin_(adminToken)) throw new Error('Admin session expired.');
  const d=getAdminData(adminToken), lines=[];
  lines.push(['Roll No','Student Name','Branch','Section','Test No','Status','Score','Percentage','Correct','Wrong','Unanswered','Duration (sec)','Started On','Submitted On'].map(csvEscape_).join(','));
  d.results.forEach(r=>{
    lines.push([
      r.rollNo,r.name,r.branch,r.section,r.testNo,r.status,r.score,r.percentage,
      r.correct,r.wrong,r.unanswered,r.durationSec,
      r.startTime?formatDate_(r.startTime):'',
      r.endTime?formatDate_(r.endTime):''
    ].map(csvEscape_).join(','));
  });
  return {ok:true,fileName:'Placement_Portal_Results_'+Utilities.formatDate(new Date(),'Asia/Kolkata','yyyyMMdd_HHmmss')+'.csv',csv:lines.join('\\r\\n')};
}

function getAdminTests_(){
  const settings=getSettings_(),counts=questionCounts_(),out=[];
  for(let t=1;t<=CONFIG.TOTAL_TESTS;t++){
    const sc=scheduleState_(t);
    out.push({
      testNo:t,title:String(settings['TestTitle'+t]||('Civil Engineering Placement Test '+t)),
      count:counts[String(t)]||0,required:100,
      scheduleDate:CONFIG.SCHEDULE[t].date,start:CONFIG.SCHEDULE[t].start,end:CONFIG.SCHEDULE[t].end,
      scheduleState:sc.state,adminUnlocked:adminUnlocked_(t),
      passwordConfigured:!!String(settings['Test'+t+'PasswordHash']||'')
    });
  }
  return out;
}
