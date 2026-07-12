'use strict';

// ── Service URLs ─────────────────────────────────────────────────────────────
const STUDENT_SVC      = 'http://localhost:3001';
const EXAM_SVC         = 'http://localhost:3003';
const AUTH_SVC         = 'http://localhost:3007';
const RESULT_SVC       = 'http://localhost:3004';
const TRANSCRIPT_SVC   = 'http://localhost:3005';
const NOTIFICATION_SVC = 'http://localhost:3006';

// ── Token & Role Management ───────────────────────────────────────────────────
function getToken() {
  return localStorage.getItem('erp_jwt') || '';
}

function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return {};
  }
}

function getRole() {
  const t = getToken();
  return t ? (parseJwt(t).role || '') : '';
}

var ADMIN_ROLES = ['ADMIN', 'EXAM_DIVISION', 'HOD', 'LECTURER'];

function isAdmin() {
  return ADMIN_ROLES.includes(getRole());
}

function applyRoleUI() {
  var role = getRole();
  if (!role) return;

  // Show role badge on token pill
  var label = role.replace('_', ' ');
  $('#token-status').find('.role-badge').remove();
  $('#token-status').append('<span class="role-badge ms-1 badge bg-warning text-dark">' + label + '</span>');

  // Students cannot see Create forms or manage other students
  if (role === 'STUDENT') {
    $('#form-create-student').closest('.col-lg-4').hide();
    $('#form-create-exam').closest('.col-lg-4').hide();
    $('[data-bs-target="#tab-students"]').parent().hide();
    $('#bulk-import-card').hide();
    $('#spec-assign-card').hide();
  }

  // HOD and LECTURER can view exams and entries but not create students
  if (role === 'HOD' || role === 'LECTURER') {
    $('#form-create-student').closest('.col-lg-4').hide();
  }
}

function refreshTokenUI() {
  var t = getToken();
  if (t) {
    $('#token-status').removeClass('token-missing').addClass('token-saved')
      .html('<i class="bi bi-shield-check-fill me-1"></i>Token saved');
    $('#token-banner').addClass('d-none');
    applyRoleUI();
  } else {
    $('#token-status').removeClass('token-saved').addClass('token-missing')
      .html('<i class="bi bi-key-fill me-1"></i>No token');
    $('#token-banner').removeClass('d-none');
  }
}

$('#save-token-btn').on('click', function () {
  const val = $('#jwt-token').val().trim();
  if (!val) {
    toast('Please paste a JWT token first.', 'danger');
    return;
  }
  localStorage.setItem('erp_jwt', val);
  refreshTokenUI();
  toast('Token saved to browser storage.', 'success');
});

$('#toggle-token-visibility').on('click', function () {
  const inp = $('#jwt-token');
  const isPassword = inp.attr('type') === 'password';
  inp.attr('type', isPassword ? 'text' : 'password');
  $(this).find('i').toggleClass('bi-eye bi-eye-slash');
});

// ── AJAX Helper ──────────────────────────────────────────────────────────────
function api(method, url, data, onSuccess, onError) {
  const token = getToken();

  const headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;

  $.ajax({
    method,
    url,
    contentType: 'application/json',
    headers,
    data: data ? JSON.stringify(data) : undefined,
    success: onSuccess,
    error: function (xhr) {
      const msg = (xhr.responseJSON && (xhr.responseJSON.error || xhr.responseJSON.message))
        || ('HTTP ' + xhr.status);
      if (onError) onError(msg, xhr.status);
      else toast(msg, 'danger');
    }
  });
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(msg, type) {
  type = type || 'secondary';
  const el = document.getElementById('erp-toast');
  el.className = 'toast align-items-center border-0 text-bg-' + type;
  $('#erp-toast-body').html(msg);
  bootstrap.Toast.getOrCreateInstance(el, { delay: 3500 }).show();
}

function setMsg(id, msg, type) {
  $('#' + id).html(
    '<div class="alert alert-' + type + ' py-2 mb-0 small">' + msg + '</div>'
  );
}

function clearMsg(id) { $('#' + id).empty(); }

// ── Dashboard / Health ────────────────────────────────────────────────────────
function setHealth(service, online) {
  const badge = $('#health-' + service);
  const card  = $('#card-' + service);
  if (online) {
    badge.attr('class', 'health-badge badge bg-success')
      .html('<i class="bi bi-circle-fill me-1"></i>Online');
    card.addClass('is-online').removeClass('is-offline');
  } else {
    badge.attr('class', 'health-badge badge bg-danger')
      .html('<i class="bi bi-circle-fill me-1"></i>Offline');
    card.addClass('is-offline').removeClass('is-online');
  }
}

function checkHealth() {
  ['student', 'exam', 'auth', 'result', 'transcript', 'notification', 'kafka'].forEach(function (svc) {
    $('#health-' + svc).attr('class', 'health-badge badge bg-secondary')
      .html('<i class="bi bi-circle-fill me-1"></i>Checking…');
    $('#card-' + svc).removeClass('is-online is-offline');
  });

  $.get(STUDENT_SVC + '/health')
    .done(function () { setHealth('student', true);  })
    .fail(function () { setHealth('student', false); });

  $.get(EXAM_SVC + '/health')
    .done(function () { setHealth('exam', true);  })
    .fail(function () { setHealth('exam', false); });

  $.get(AUTH_SVC + '/health')
    .done(function () { setHealth('auth', true);  })
    .fail(function () { setHealth('auth', false); });

  $.get(RESULT_SVC + '/health')
    .done(function () { setHealth('result', true);  })
    .fail(function () { setHealth('result', false); });

  $.get(TRANSCRIPT_SVC + '/health')
    .done(function () { setHealth('transcript', true);  })
    .fail(function () { setHealth('transcript', false); });

  $.get(NOTIFICATION_SVC + '/health')
    .done(function () { setHealth('notification', true);  })
    .fail(function () { setHealth('notification', false); });

  // Kafka: check via notification service health (it's internal-only)
  // We mark kafka online if notification service is online (it connects to Kafka)
  $.get(NOTIFICATION_SVC + '/health')
    .done(function () { setHealth('kafka', true);  })
    .fail(function () { setHealth('kafka', false); });
}

// ── Students ──────────────────────────────────────────────────────────────────
var _students = [];

function loadStudents() {
  api('GET', STUDENT_SVC + '/api/students', null, function (list) {
    _students = list;
    var tbody = $('#tbody-students');
    if (!list.length) {
      tbody.html('<tr><td colspan="5" class="text-center text-muted py-4">No students yet — create one on the left</td></tr>');
    } else {
      tbody.html(list.map(function (s) {
        return '<tr>' +
          '<td class="fw-medium">' + esc(s.name) + '</td>' +
          '<td>' + esc(s.email) + '</td>' +
          '<td><span class="badge bg-secondary">' + esc(s.studentId) + '</span></td>' +
          '<td>' + (s.programme ? esc(s.programme) : '<span class="text-muted">—</span>') + '</td>' +
          '<td><code class="mongo-id">' + esc(s._id) + '</code></td>' +
          '</tr>';
      }).join(''));
    }
    rebuildStudentDropdown();
  }, function (msg) {
    toast('Students: ' + msg, 'danger');
  });
}

function rebuildStudentDropdown() {
  var selectors = [
    '#enrol-student',
    '#results-student-select',
    '#res-student-id',
    '#spec-student-id',
    '#spec-assign-student',
  ];

  var saved = {};
  selectors.forEach(function (sel) { saved[sel] = $(sel).val(); });

  selectors.forEach(function (sel) {
    $(sel).empty().append('<option value="">— Select student —</option>');
    _students.forEach(function (s) {
      $(sel).append('<option value="' + esc(s._id) + '">' +
        esc(s.name) + ' (' + esc(s.studentId) + ')</option>');
    });
    if (saved[sel]) $(sel).val(saved[sel]);
  });
}

$('#form-create-student').on('submit', function (e) {
  e.preventDefault();
  clearMsg('msg-create-student');

  var payload = {
    name:      $('#s-name').val().trim(),
    email:     $('#s-email').val().trim(),
    studentId: $('#s-studentid').val().trim(),
    programme: $('#s-programme').val().trim()
  };

  if (!payload.name || !payload.email || !payload.studentId) {
    setMsg('msg-create-student', 'Name, email and student ID are required.', 'warning');
    return;
  }

  api('POST', STUDENT_SVC + '/api/students', payload, function (student) {
    toast('<i class="bi bi-check-circle me-1"></i>Student <strong>' + esc(student.name) + '</strong> created.', 'success');
    $('#form-create-student')[0].reset();
    clearMsg('msg-create-student');
    loadStudents();
  }, function (msg, status) {
    setMsg('msg-create-student', '<strong>' + status + '</strong> — ' + msg, 'danger');
  });
});

// ── Exams ─────────────────────────────────────────────────────────────────────
var _exams = [];

function loadExams() {
  api('GET', EXAM_SVC + '/api/exams', null, function (list) {
    _exams = list;
    var tbody = $('#tbody-exams');
    if (!list.length) {
      tbody.html('<tr><td colspan="6" class="text-center text-muted py-4">No exams yet — create one on the left</td></tr>');
    } else {
      tbody.html(list.map(function (ex) {
        var d = new Date(ex.date);
        var dateStr = isNaN(d) ? '—' : d.toLocaleString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });
        return '<tr>' +
          '<td class="fw-medium">' + esc(ex.title) + '</td>' +
          '<td><span class="badge bg-primary">' + esc(ex.courseId) + '</span></td>' +
          '<td>' + dateStr + '</td>' +
          '<td>' + (ex.venue ? esc(ex.venue) : '<span class="text-muted">—</span>') + '</td>' +
          '<td><code class="mongo-id">' + esc(ex._id) + '</code></td>' +
          '<td>' +
            '<button class="btn btn-sm btn-outline-success" onclick="goToEnrolment(\'' + esc(ex._id) + '\')" title="Go to enrolment">' +
              '<i class="bi bi-person-plus"></i>' +
            '</button>' +
          '</td>' +
          '</tr>';
      }).join(''));
    }
    rebuildExamDropdown();
  }, function (msg) {
    toast('Exams: ' + msg, 'danger');
  });
}

function rebuildExamDropdown() {
  var sel = $('#enrol-exam');
  var cur = sel.val();
  sel.empty().append('<option value="">— Select exam —</option>');
  _exams.forEach(function (ex) {
    sel.append('<option value="' + esc(ex._id) + '">' + esc(ex.title) + '</option>');
  });
  if (cur) sel.val(cur);
}

$('#form-create-exam').on('submit', function (e) {
  e.preventDefault();
  clearMsg('msg-create-exam');

  var dateVal = $('#e-date').val();
  var payload = {
    title:    $('#e-title').val().trim(),
    courseId: $('#e-courseid').val().trim(),
    date:     dateVal ? new Date(dateVal).toISOString() : undefined,
    venue:    $('#e-venue').val().trim()
  };

  if (!payload.title || !payload.courseId || !payload.date) {
    setMsg('msg-create-exam', 'Title, course ID and date are required.', 'warning');
    return;
  }

  api('POST', EXAM_SVC + '/api/exams', payload, function (exam) {
    toast('<i class="bi bi-check-circle me-1"></i>Exam <strong>' + esc(exam.title) + '</strong> created.', 'success');
    $('#form-create-exam')[0].reset();
    clearMsg('msg-create-exam');
    loadExams();
  }, function (msg, status) {
    setMsg('msg-create-exam', '<strong>' + status + '</strong> — ' + msg, 'danger');
  });
});

// ── Enrolment ─────────────────────────────────────────────────────────────────
var STATUS_BADGE = {
  pending:  '<span class="badge bg-warning text-dark">Pending</span>',
  approved: '<span class="badge bg-success">Approved</span>',
  rejected: '<span class="badge bg-danger">Rejected</span>',
};

function approvalButtons(examId, entryId, currentStatus) {
  if (!isAdmin() && getRole() !== 'HOD' && getRole() !== 'LECTURER') return '';
  var btns = '';
  if (currentStatus !== 'approved') {
    btns += '<button class="btn btn-xs btn-success me-1" onclick="setEntryStatus(\'' + examId + '\',\'' + entryId + '\',\'approved\')">✓</button>';
  }
  if (currentStatus !== 'rejected') {
    btns += '<button class="btn btn-xs btn-danger" onclick="setEntryStatus(\'' + examId + '\',\'' + entryId + '\',\'rejected\')">✗</button>';
  }
  if (currentStatus !== 'pending') {
    btns += '<button class="btn btn-xs btn-secondary ms-1" onclick="setEntryStatus(\'' + examId + '\',\'' + entryId + '\',\'pending\')">↺</button>';
  }
  return btns;
}

function setEntryStatus(examId, entryId, status) {
  api('PATCH', EXAM_SVC + '/api/exams/' + examId + '/entries/' + entryId, { status: status },
    function () { toast('Entry marked as ' + status, 'success'); loadEntries(); },
    function (msg) { toast(msg, 'danger'); }
  );
}

function loadEntries() {
  var examId = $('#enrol-exam').val();
  if (!examId) {
    $('#tbody-entries').html('<tr><td colspan="5" class="text-center text-muted py-4">Select an exam to view entries</td></tr>');
    $('#entries-header').html('<i class="bi bi-list-check me-1"></i>Exam Entries');
    return;
  }

  var exam = _exams.find(function (ex) { return ex._id === examId; });
  if (exam) {
    $('#entries-header').html('<i class="bi bi-list-check me-1"></i>Entries — <span class="text-primary">' + esc(exam.title) + '</span>');
  }

  api('GET', EXAM_SVC + '/api/exams/' + examId + '/entries', null, function (data) {
    var entries = data.entries || data;
    var tbody = $('#tbody-entries');
    if (!entries.length) {
      tbody.html('<tr><td colspan="5" class="text-center text-muted py-4">No students enrolled yet</td></tr>');
      return;
    }
    tbody.html(entries.map(function (en, i) {
      var enrolled = new Date(en.enrolledAt);
      var enrolledStr = isNaN(enrolled) ? '—' : enrolled.toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      var status = en.status || 'pending';
      return '<tr>' +
        '<td class="text-muted">' + (i + 1) + '</td>' +
        '<td class="fw-medium">' + esc(en.studentName || '—') + '</td>' +
        '<td><code class="mongo-id">' + esc(en.studentId) + '</code></td>' +
        '<td>' + enrolledStr + '</td>' +
        '<td>' + (STATUS_BADGE[status] || status) + ' ' + approvalButtons(examId, en._id, status) + '</td>' +
        '</tr>';
    }).join(''));
  }, function (msg) {
    toast('Entries: ' + msg, 'danger');
  });
}

$('#enrol-exam').on('change', loadEntries);

$('#form-enrol').on('submit', function (e) {
  e.preventDefault();
  clearMsg('msg-enrol');

  var examId    = $('#enrol-exam').val();
  var studentId = $('#enrol-student').val();

  if (!examId || !studentId) {
    setMsg('msg-enrol', 'Please select both an exam and a student.', 'warning');
    return;
  }

  api('POST', EXAM_SVC + '/api/exams/' + examId + '/entries', { studentId: studentId },
    function (entry) {
      toast('<i class="bi bi-check-circle me-1"></i><strong>' + esc(entry.studentName || 'Student') + '</strong> enrolled successfully.', 'success');
      clearMsg('msg-enrol');
      loadEntries();
    },
    function (msg, status) {
      var friendly = msg;
      if (status === 404) friendly = 'Student not found in Student Service (cross-service 404).';
      if (status === 502) friendly = 'Student Service is unavailable — is it running?';
      if (status === 400) friendly = 'Student is already enrolled in this exam.';
      setMsg('msg-enrol', '<strong>' + status + '</strong> — ' + friendly, 'danger');
    }
  );
});

// ── Navigate to Enrolment tab with a pre-selected exam ───────────────────────
function goToEnrolment(examId) {
  var btn = document.getElementById('tab-enrolment-btn');
  bootstrap.Tab.getOrCreateInstance(btn).show();
  setTimeout(function () {
    $('#enrol-exam').val(examId).trigger('change');
  }, 150);
}

// ── Results (G7) ─────────────────────────────────────────────────────────────
var GRADE_COLOUR = { 'A+': 'success', A: 'success', 'A-': 'success',
  'B+': 'info', B: 'info', 'B-': 'info',
  'C+': 'warning', C: 'warning', 'C-': 'warning',
  'D+': 'secondary', D: 'secondary', F: 'danger' };

function loadResults(studentId) {
  if (!studentId) {
    $('#tbody-results').html('<tr><td colspan="8" class="text-center text-muted py-4">Select a student to view results</td></tr>');
    $('#gpa-summary').empty();
    $('#results-header').html('<i class="bi bi-table me-1"></i>Results');
    return;
  }

  var student = _students.find(function (s) { return s._id === studentId; });
  if (student) {
    $('#results-header').html('<i class="bi bi-table me-1"></i>Results — <span class="text-primary">' + esc(student.name) + '</span>');
  }

  api('GET', RESULT_SVC + '/api/results/student/' + studentId, null, function (data) {
    var groups  = data.grouped || {};
    var gpaList = data.gpa    || [];

    // GPA summary pills
    if (gpaList.length) {
      $('#gpa-summary').html(
        '<div class="d-flex flex-wrap gap-2 mb-2">' +
        gpaList.map(function (g) {
          var badge = g.gpa >= 3.5 ? 'success' : g.gpa >= 3.0 ? 'info' : g.gpa >= 2.0 ? 'warning' : 'danger';
          var fin   = g.status === 'final' ? ' <span class="badge bg-light text-dark border">Final</span>' : '';
          return '<span class="badge bg-' + badge + ' fs-6 py-2 px-3">Year ' + g.academicYear + ' GPA: ' + g.gpa.toFixed(2) + fin + '</span>';
        }).join('') +
        '</div>'
      );
    } else {
      $('#gpa-summary').html('<p class="text-muted small mb-2">No GPA records yet — upload results and run Process GPA.</p>');
    }

    // Results table
    var rows = [];
    Object.keys(groups).sort().forEach(function (label) {
      var subList = groups[label];
      rows.push('<tr class="table-light"><td colspan="8" class="fw-bold small py-1">' + esc(label) + '</td></tr>');
      subList.forEach(function (r) {
        var gc = GRADE_COLOUR[r.grade] || 'secondary';
        rows.push('<tr>' +
          '<td>' + (r.academicYear || '—') + '</td>' +
          '<td>' + (r.semester     || '—') + '</td>' +
          '<td><code>' + esc(r.subjectCode) + '</code></td>' +
          '<td>' + esc(r.subjectName || '—') + '</td>' +
          '<td>' + (r.marks != null ? r.marks : '—') + '</td>' +
          '<td><span class="badge bg-' + gc + '">' + esc(r.grade) + '</span></td>' +
          '<td>' + (r.gradePoints != null ? r.gradePoints.toFixed(1) : '—') + '</td>' +
          '<td>' + (r.credits || '—') + '</td>' +
          '</tr>');
      });
    });

    if (!rows.length) {
      $('#tbody-results').html('<tr><td colspan="8" class="text-center text-muted py-4">No results found for this student</td></tr>');
    } else {
      $('#tbody-results').html(rows.join(''));
    }
  }, function (msg) {
    toast('Results: ' + msg, 'danger');
  });
}

$('#results-student-select').on('change', function () {
  loadResults($(this).val());
});

$('#form-upload-result').on('submit', function (e) {
  e.preventDefault();
  clearMsg('msg-upload-result');

  var studentId = $('#res-student-id').val();
  if (!studentId) {
    setMsg('msg-upload-result', 'Please select a student.', 'warning');
    return;
  }

  var payload = {
    studentId:   studentId,
    studentRegNo: $('#res-reg-no').val().trim(),
    subjectCode:  $('#res-subject-code').val().trim(),
    subjectName:  $('#res-subject-name').val().trim(),
    marks:        parseFloat($('#res-marks').val()) || undefined,
    grade:        $('#res-grade').val(),
    credits:      parseInt($('#res-credits').val()) || 3,
    academicYear: parseInt($('#res-acad-year').val()) || undefined,
    semester:     parseInt($('#res-semester').val()) || undefined,
  };

  if (!payload.subjectCode || !payload.grade) {
    setMsg('msg-upload-result', 'Subject code and grade are required.', 'warning');
    return;
  }

  api('POST', RESULT_SVC + '/api/results', payload, function () {
    toast('<i class="bi bi-check-circle me-1"></i>Result uploaded.', 'success');
    $('#form-upload-result')[0].reset();
    clearMsg('msg-upload-result');
    loadResults($('#results-student-select').val());
  }, function (msg, status) {
    setMsg('msg-upload-result', '<strong>' + status + '</strong> — ' + msg, 'danger');
  });
});

// Show/hide upload card based on role
$(document).on('shown.bs.tab', '[data-bs-target="#tab-results"]', function () {
  if (!isAdmin()) {
    $('#upload-result-card').hide();
  }
});

// ── Bulk Import (G3) ─────────────────────────────────────────────────────────
function bulkImportStudents() {
  clearMsg('msg-bulk-import');
  var csv = $('#bulk-csv').val().trim();
  if (!csv) {
    setMsg('msg-bulk-import', 'Paste CSV data first.', 'warning');
    return;
  }

  api('POST', STUDENT_SVC + '/api/students/bulk', { csv: csv }, function (data) {
    var msg = '<strong>' + data.created + '</strong> student(s) imported.';
    if (data.errors) msg += ' <strong>' + data.errors + '</strong> error(s).';
    if (data.errorDetails && data.errorDetails.length) {
      msg += '<ul class="mb-0 mt-1 small">' +
        data.errorDetails.map(function (e) {
          return '<li>' + esc(e.row) + ': ' + esc(e.error) + '</li>';
        }).join('') + '</ul>';
    }
    setMsg('msg-bulk-import', msg, data.errors ? 'warning' : 'success');
    if (data.created) loadStudents();
  }, function (msg) {
    setMsg('msg-bulk-import', msg, 'danger');
  });
}

// ── Specialization (G9) ───────────────────────────────────────────────────────
var _specializations = [];

function loadSpecializations() {
  $.get(STUDENT_SVC + '/api/specializations', function (data) {
    _specializations = data.specializations || [];
    var prefList = $('#spec-preferences-list');
    prefList.empty();
    _specializations.forEach(function (s, i) {
      prefList.append(
        '<div class="form-check">' +
        '<input class="form-check-input spec-pref-check" type="checkbox" value="' + esc(s) + '" id="sp-' + i + '">' +
        '<label class="form-check-label small" for="sp-' + i + '">' + esc(s) + '</label>' +
        '</div>'
      );
    });

    // Populate assign dropdown
    var assignSel = $('#spec-assign-value');
    assignSel.empty().append('<option value="">— Select —</option>');
    _specializations.forEach(function (s) {
      assignSel.append('<option value="' + esc(s) + '">' + esc(s) + '</option>');
    });
  });
}

function loadSpecApplications() {
  api('GET', STUDENT_SVC + '/api/specializations/all/pending', null, function (data) {
    var apps = data.applications || [];
    var tbody = $('#tbody-spec-applications');
    if (!apps.length) {
      tbody.html('<tr><td colspan="7" class="text-center text-muted py-4">No pending applications</td></tr>');
      return;
    }
    tbody.html(apps.map(function (a) {
      var prefs = a.preferences || [];
      var statusColour = { pending: 'warning', assigned: 'success', rejected: 'danger' };
      var stu = a.studentId || {};
      return '<tr>' +
        '<td class="fw-medium">' + esc(stu.name || '—') + '</td>' +
        '<td><span class="badge bg-secondary">' + esc(stu.studentId || '—') + '</span></td>' +
        '<td>' + esc((prefs[0] && prefs[0].specialization) || '—') + '</td>' +
        '<td>' + esc((prefs[1] && prefs[1].specialization) || '—') + '</td>' +
        '<td>' + esc((prefs[2] && prefs[2].specialization) || '—') + '</td>' +
        '<td><span class="badge bg-' + (statusColour[a.status] || 'secondary') + '">' + esc(a.status) + '</span></td>' +
        '<td>' + esc(a.assignedSpecialization || '—') + '</td>' +
        '</tr>';
    }).join(''));
  }, function (msg) {
    toast('Specialization: ' + msg, 'danger');
  });
}

function rebuildSpecDropdowns() {
  ['#spec-student-id', '#spec-assign-student'].forEach(function (sel) {
    var cur = $(sel).val();
    $(sel).empty().append('<option value="">— Select student —</option>');
    _students.forEach(function (s) {
      $(sel).append('<option value="' + esc(s._id) + '">' + esc(s.name) + ' (' + esc(s.studentId) + ')</option>');
    });
    if (cur) $(sel).val(cur);
  });
}

$('#form-apply-spec').on('submit', function (e) {
  e.preventDefault();
  clearMsg('msg-apply-spec');

  var studentId = $('#spec-student-id').val();
  if (!studentId) {
    setMsg('msg-apply-spec', 'Select a student.', 'warning');
    return;
  }

  var checked = [];
  $('#spec-preferences-list .spec-pref-check:checked').each(function (i) {
    checked.push({ rank: i + 1, specialization: $(this).val() });
  });
  if (!checked.length) {
    setMsg('msg-apply-spec', 'Select at least one specialization preference.', 'warning');
    return;
  }
  if (checked.length > 3) {
    setMsg('msg-apply-spec', 'Select at most 3 preferences.', 'warning');
    return;
  }

  api('POST', STUDENT_SVC + '/api/specializations/' + studentId, { preferences: checked },
    function () {
      toast('Application submitted.', 'success');
      clearMsg('msg-apply-spec');
      $('#form-apply-spec')[0].reset();
      loadSpecApplications();
    },
    function (msg) { setMsg('msg-apply-spec', msg, 'danger'); }
  );
});

$('#form-assign-spec').on('submit', function (e) {
  e.preventDefault();
  clearMsg('msg-assign-spec');

  var studentId  = $('#spec-assign-student').val();
  var assignment = $('#spec-assign-value').val();
  if (!studentId || !assignment) {
    setMsg('msg-assign-spec', 'Select a student and specialization.', 'warning');
    return;
  }

  api('PATCH', STUDENT_SVC + '/api/specializations/' + studentId + '/assign',
    { assignedSpecialization: assignment },
    function () {
      toast('Specialization assigned: ' + assignment, 'success');
      clearMsg('msg-assign-spec');
      loadSpecApplications();
    },
    function (msg) { setMsg('msg-assign-spec', msg, 'danger'); }
  );
});

// ── Notifications (G11) ───────────────────────────────────────────────────────
var TOPIC_COLOUR = {
  'student.created':  'primary',
  'exam.registered':  'success',
  'result.published': 'warning',
};

function loadNotifications() {
  var topic = $('#notif-topic-filter').val();
  var url   = NOTIFICATION_SVC + '/api/notifications' + (topic ? '?topic=' + encodeURIComponent(topic) : '');

  api('GET', url, null, function (data) {
    var logs  = data.notifications || [];
    $('#notif-header').html('<i class="bi bi-bell me-1"></i>Notification Log <span class="badge bg-secondary ms-1">' + logs.length + '</span>');
    var tbody = $('#tbody-notifications');
    if (!logs.length) {
      tbody.html('<tr><td colspan="5" class="text-center text-muted py-4">No notifications yet — create students, enrol in exams, or finalize a GPA</td></tr>');
      return;
    }
    tbody.html(logs.map(function (n) {
      var t = new Date(n.sentAt);
      var timeStr = isNaN(t) ? '—' : t.toLocaleString('en-GB', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
      });
      var tc = TOPIC_COLOUR[n.topic] || 'secondary';
      return '<tr>' +
        '<td class="text-muted small">' + timeStr + '</td>' +
        '<td><span class="badge bg-' + tc + '">' + esc(n.topic) + '</span></td>' +
        '<td>' + esc(n.message) + '</td>' +
        '<td><code class="small">' + esc(n.recipientId || '—') + '</code></td>' +
        '<td><span class="badge bg-' + (n.status === 'sent' ? 'success' : 'danger') + '">' + esc(n.status) + '</span></td>' +
        '</tr>';
    }).join(''));
  }, function (msg) {
    toast('Notifications: ' + msg, 'danger');
  });
}

// ── Tab show handlers ─────────────────────────────────────────────────────────
$('[data-bs-target="#tab-students"]').on('shown.bs.tab', loadStudents);
$('[data-bs-target="#tab-exams"]').on('shown.bs.tab', loadExams);
$('[data-bs-target="#tab-enrolment"]').on('shown.bs.tab', function () {
  loadStudents();
  loadExams();
  loadEntries();
});
$('[data-bs-target="#tab-results"]').on('shown.bs.tab', function () {
  if (!_students.length) loadStudents();
  if (!isAdmin()) $('#upload-result-card').hide();
});
$('[data-bs-target="#tab-specialization"]').on('shown.bs.tab', function () {
  if (!_students.length) loadStudents();
  if (!_specializations.length) loadSpecializations();
  if (!isAdmin()) $('#spec-assign-card').hide();
  loadSpecApplications();
});
$('[data-bs-target="#tab-notifications"]').on('shown.bs.tab', function () {
  loadNotifications();
});

// ── XSS-safe HTML escape ─────────────────────────────────────────────────────
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Boot ─────────────────────────────────────────────────────────────────────
$(function () {
  var saved = getToken();
  if (saved) $('#jwt-token').val(saved);
  refreshTokenUI();
  checkHealth();
});
