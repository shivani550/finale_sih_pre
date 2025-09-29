


    // Navigation tab logic unchanged except tab switch code enhanced to toggle attendance section visibility
        // Navigation tab logic
    const tabs = {
      admin: 'admin-view',
      hod: 'hod-view',
      faculty: 'faculty-view',
      student: 'student-view',
      reports: 'reports-view',
      analytics: 'analytics-view',
      approval: 'approval-view'
    };
    Object.keys(tabs).forEach(tab => {
      document.getElementById('tab-' + tab).onclick = function () {
        Object.values(tabs).forEach(id => document.getElementById(id).style.display = 'none');
        document.getElementById(tabs[tab]).style.display = 'block';
        Object.keys(tabs).forEach(t => document.getElementById('tab-' + t).classList.remove('active'));
        this.classList.add('active');
        if (tab === 'approval') loadApprovalTimetable();
        if (tab === 'reports') initializeReportsFilters();
        if (tab === 'analytics') initializeAnalyticsFilters();
      };
    });

    let timetableDB = {};
    let facultyAttendanceDB = {};
    let rescheduleRequestsDB = [];

    // Util: parse CSV and multiline inputs
    function parseCSVInput(text) {
      return text.split(',').map(s => s.trim()).filter(Boolean);
    }
    function parseMultiLineInput(text) {
      return text.split('\n').map(s => s.trim()).filter(Boolean);
    }

    // Admin timetable form submission
    document.getElementById('timetable-form').onsubmit = function (e) {
      e.preventDefault();
      const year = document.getElementById('input-year').value.trim();
      const branch = document.getElementById('branch-select').value.trim();
      const sections = parseCSVInput(document.getElementById('input-sections').value);
      const crs = parseCSVInput(document.getElementById('input-crs').value);
      const subjectsLines = parseMultiLineInput(document.getElementById('input-subjects').value);
      const rooms = parseCSVInput(document.getElementById('input-rooms').value);
      const periods = parseCSVInput(document.getElementById('input-periods').value);
      const days = parseCSVInput(document.getElementById('input-days').value);

      if (!branch || !sections.length || !subjectsLines.length || !rooms.length || !days.length || !periods.length) {
        alert("Please fill all inputs.");
        return;
      }
      const subjects = subjectsLines.map(line => {
        const [subj, fac] = line.split(',').map(s => s.trim());
        return { subject: subj, faculty: fac };
      });

      timetableDB[branch] = timetableDB[branch] || {};
      let roomIndex = 0, subjIndex = 0;
      sections.forEach((section, idx) => {
        timetableDB[branch][section] = { year: year || '', cr: crs[idx] || '', days, periods, schedule: {} };
        let sched = timetableDB[branch][section].schedule;
        days.forEach(day => {
          sched[day] = [];
          periods.forEach(() => {
            const { subject, faculty } = subjects[subjIndex % subjects.length];
            const room = rooms[roomIndex % rooms.length];
            sched[day].push({ subject, faculty, room });
            subjIndex++;
            roomIndex++;
          });
        });
      });
      renderFullTimetable(branch);
      document.getElementById('btn-export-csv').style.display = 'inline-block';
      document.getElementById('btn-export-pdf').style.display = 'inline-block';
    };

    // Render full timetable for a branch
    function renderFullTimetable(branch) {
      const container = document.getElementById('timetable-container');
      container.innerHTML = '';
      if (!timetableDB[branch]) {
        container.textContent = 'No timetable found for ' + branch;
        return;
      }
      for (const section in timetableDB[branch]) {
        const { year, cr, days, periods, schedule } = timetableDB[branch][section];
        let extraInfo = '';
        if (year) extraInfo += `Year: ${year} `;
        if (cr) extraInfo += `| CR: ${cr}`;
        let html = `<h2 class="tt-section">Section ${section} (${branch}) ${extraInfo}</h2>
      <table class="tt-table"><thead><tr><th>Day / Period</th>`;
        periods.forEach(p => html += `<th>${p}</th>`);
        html += '</tr></thead><tbody>';
        days.forEach(day => {
          html += `<tr><th>${day}</th>` + schedule[day].map(sess =>
            `<td>
              <div class="tt-subject">${sess.subject}</div>
              <div class="tt-faculty">${sess.faculty}</div>
              <div class="tt-room">${sess.room}</div>
            </td>`).join('') + '</tr>';
        });
        html += '</tbody></table>';
        container.innerHTML += html;
      }
    }

    // Export timetable as CSV
    document.getElementById('btn-export-csv').onclick = function () {
      const container = document.getElementById('timetable-container');
      const tables = container.getElementsByTagName('table');
      if (!tables.length) {
        alert('Generate timetable first.');
        return;
      }
      let csv = [];
      Array.from(tables).forEach((table, index) => {
        const title = table.previousElementSibling?.textContent || `Section ${index + 1}`;
        csv.push(title);
        for (let row of table.rows) {
          let cells = [];
          for (let cell of row.cells) {
            cells.push(cell.textContent.trim().replace(/,/g, ''));
          }
          csv.push(cells.join(','));
        }
        csv.push('');
      });
      const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `timetable_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    };

    // Export timetable as PDF
    document.getElementById('btn-export-pdf').onclick = function () {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('landscape');
      let y = 10;
      const container = document.getElementById('timetable-container');
      const tables = container.getElementsByTagName('table');
      if (!tables.length) {
        alert('Generate timetable first.');
        return;
      }
      doc.setFontSize(20);
      doc.text('Generated Timetable', 10, y);
      y += 12;
      Array.from(tables).forEach((table, i) => {
        let text = table.previousElementSibling?.textContent || `Section ${i + 1}`;
        doc.setFontSize(16);
        doc.text(text, 10, y);
        y += 10;
        doc.setFontSize(12);
        for (let row of table.rows) {
          let line = [];
          for (let cell of row.cells) {
            line.push(cell.textContent.trim());
          }
          doc.text(line.join(' | '), 10, y);
          y += 7;
          if (y > 280) {
            doc.addPage();
            y = 10;
          }
        }
        y += 10;
      });
      doc.save('timetable.pdf');
    };

    // Faculty login & timetable display
    document.getElementById('faculty-login-form').onsubmit = function (e) {
      e.preventDefault();
      const facultyNameInput = document.getElementById('faculty-login-name');
      const facultyName = facultyNameInput.value.trim();
      const facultyNameLower = facultyName.toLowerCase();
      const container = document.getElementById('faculty-timetable-container');
      container.innerHTML = '';
      if (!facultyName) {
        container.textContent = 'Please enter your faculty name.';
        document.getElementById('attendance-section').style.display = 'none';
        return;
      }

      let matches = [];
      for (let branch in timetableDB) {
        for (let section in timetableDB[branch]) {
          const { days, periods, schedule } = timetableDB[branch][section];
          for (let day of days) {
            schedule[day].forEach((sess, idx) => {
              if (sess.faculty.toLowerCase() === facultyNameLower) {
                matches.push({
                  branch,
                  section,
                  day,
                  period: periods[idx],
                  subject: sess.subject,
                  room: sess.room
                });
              }
            });
          }
        }
      }
      if (!matches.length) {
        container.textContent = `No classes found for ${facultyName}.`;
        document.getElementById('attendance-section').style.display = 'none';
        return;
      }
      let html = `<h2>Timetable for ${facultyName}</h2><table class="tt-table"><thead><tr>
        <th>Branch</th><th>Section</th><th>Day</th><th>Period</th><th>Subject</th><th>Room</th>
      </tr></thead><tbody>`;
      matches.forEach(m => {
        html += `<tr>
          <td>${m.branch}</td><td>${m.section}</td><td>${m.day}</td><td>${m.period}</td><td>${m.subject}</td><td>${m.room}</td>
        </tr>`;
      });
      html += '</tbody></table>';
      container.innerHTML = html;
      loadFacultyRescheduleRequests(facultyName);

      // Show attendance marking UI for logged in faculty
      document.getElementById('attendance-section').style.display = 'block';
    };

    // Attendance marking with photo proof
    const btnCaptureAttendance = document.getElementById('btn-capture-attendance-photo');
    const video = document.getElementById('camera-preview');
    const canvas = document.getElementById('photo-canvas');
    const attendanceMsg = document.getElementById('attendance-status-msg');

    btnCaptureAttendance.onclick = async function () {
      attendanceMsg.textContent = '';
      video.style.display = 'block';

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        attendanceMsg.textContent = 'Camera API not supported on this device.';
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;

        // On next click, capture the photo and mark attendance
        btnCaptureAttendance.textContent = 'Click to Capture & Mark Present';
        btnCaptureAttendance.onclick = () => {
          // Draw current video frame on canvas
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataURL = canvas.toDataURL('image/png');
          // Stop video stream tracks to release camera
          stream.getTracks().forEach(track => track.stop());
          video.style.display = 'none';
          canvas.style.display = 'none';
          btnCaptureAttendance.textContent = 'Capture Attendance Photo & Mark Present';

          // Save attendance with photo proof
          const facultyName = document.getElementById('faculty-login-name').value.trim().toLowerCase();
          if (!facultyName) {
            attendanceMsg.textContent = 'Faculty not logged in.';
            return;
          }
          const today = new Date().toISOString().split('T')[0];
          facultyAttendanceDB[facultyName] = facultyAttendanceDB[facultyName] || {};
          facultyAttendanceDB[facultyName][today] = { status: 'present', proofDataURL: dataURL };
          attendanceMsg.textContent = 'Attendance marked successfully with photo proof.';
        };
      } catch (err) {
        attendanceMsg.textContent = 'Error accessing camera: ' + err.message;
        video.style.display = 'none';
      }
    };

    // Load faculty reschedule requests (unchanged)
    function loadFacultyRescheduleRequests(facultyName) {
      const container = document.getElementById('faculty-reschedule-requests-content');
      let requests = rescheduleRequestsDB.filter(r =>
        r.facultyName.toLowerCase() === facultyName.toLowerCase() && r.status === "pending"
      );
      if (requests.length === 0) {
        container.innerHTML = '<p>No pending reschedule requests.</p>';
        return;
      }
      let html = '';
      requests.forEach((req, idx) => {
        html += `<div style="border:1px solid #b71c1c; padding:8px; margin-bottom:8px; border-radius:8px;">
      <p><b>Day:</b> ${req.day}, <b>Period:</b> ${req.period}</p>
      <p><b>Student ID:</b> ${req.studentId}</p>
      <p><b>Reason:</b> ${req.detail}</p>
      <button data-idx="${idx}" class="accept-reschedule-btn" style="background:#4caf50;color:#fff;border:none;padding:5px 10px;margin-right:5px;border-radius:4px;cursor:pointer;">Accept</button>
      <button data-idx="${idx}" class="reject-reschedule-btn" style="background:#f44336;color:#fff;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;">Reject</button>
    </div>`;
      });
      container.innerHTML = html;
    }

    // Accept/reject reschedule in faculty panel unchanged
    document.getElementById('faculty-reschedule-requests-content').addEventListener('click', function (e) {
      if (e.target.classList.contains('accept-reschedule-btn') || e.target.classList.contains('reject-reschedule-btn')) {
        let idx = e.target.getAttribute('data-idx');
        if (idx === null) return;
        let newStatus = e.target.classList.contains('accept-reschedule-btn') ? 'approved' : 'rejected';
        let facultyName = document.getElementById('faculty-login-name').value.trim();
        let filtered = rescheduleRequestsDB.filter(r => r.facultyName.toLowerCase() === facultyName.toLowerCase() && r.status === "pending");
        let req = filtered[idx];
        if (req) {
          let mainIdx = rescheduleRequestsDB.findIndex(r =>
            r.day === req.day &&
            r.period === req.period &&
            r.facultyName === req.facultyName &&
            r.studentId === req.studentId &&
            r.status === "pending"
          );
          if (mainIdx >= 0) {
            rescheduleRequestsDB[mainIdx].status = newStatus;
            rescheduleRequestsDB[mainIdx].responseTimestamp = Date.now();
          }
          loadFacultyRescheduleRequests(facultyName);
          updateApprovalSectionStatus();
          updateStudentAlerts(req);
        }
      }
    });

    // HOD Panel login & attendance reporting with photo proof display
    document.getElementById('hod-login-form').onsubmit = function (e) {
      e.preventDefault();
      const hodName = document.getElementById('hod-login-name').value.trim();
      const container = document.getElementById('hod-data-container');
      if (!hodName) {
        container.textContent = 'Enter HOD name.';
        return;
      }
      // Aggregate attendance data with photo proofs
      let reportRows = [];
      for (let faculty in facultyAttendanceDB) {
        let classesTaken = 0, classesAbsent = 0, classesRescheduled = 0, proofs = [];
        const sessions = facultyAttendanceDB[faculty];
        for (let skey in sessions) {
          if (sessions[skey].status === 'present') classesTaken++;
          else if (sessions[skey].status === 'absent') classesAbsent++;
          if (sessions[skey].proofDataURL) proofs.push(sessions[skey].proofDataURL);
        }
        let rescheduled = rescheduleRequestsDB.filter(x => x.facultyName?.toLowerCase() === faculty.toLowerCase() && x.status === 'approved').length;
        reportRows.push({ faculty, classesTaken, classesAbsent, rescheduled, proofs });
      }
      let html = '<h2>Attendance Classes Overview</h2><table class="hod-table"><thead><tr><th>Faculty Name</th><th>Classes Taken</th><th>Classes Absent</th><th>Classes Rescheduled</th><th>Proofs Uploaded</th></tr></thead><tbody>';
      reportRows.forEach(row => {
        html += `<tr><td>${row.faculty}</td><td>${row.classesTaken}</td><td>${row.classesAbsent}</td><td>${row.rescheduled}</td><td>${row.proofs.map(p => `<img src="${p}" class="attendance-proof-img" />`).join('')}</td></tr>`;
      });
      html += '</tbody></table>';
      container.innerHTML = html;
      document.getElementById('hod-export-csv').style.display = 'inline-block';
      document.getElementById('hod-export-pdf').style.display = 'inline-block';
    };

    // CSV and PDF export handlers for HOD unchanged (export attendance list and images)
    document.getElementById('hod-export-csv').onclick = function () {
      let htmlTable = document.querySelector('.hod-table');
      if (!htmlTable) {
        alert('No data to export.');
        return;
      }
      let csv = [];
      for (let row of htmlTable.rows) {
        let cells = [];
        for (let cell of row.cells) cells.push(cell.textContent.replace(/,/g, ''));
        csv.push(cells.join(','));
      }
      let blob = new Blob([csv.join('\n')], { type: 'text/csv' });
      let a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'hodreport.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    };

    document.getElementById('hod-export-pdf').onclick = function () {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('landscape');
      let y = 10;
      const htmlTable = document.querySelector('.hod-table');
      if (!htmlTable) {
        alert('No data to export.');
        return;
      }
      doc.setFontSize(20);
      doc.text('HOD Attendance Class Overview', 10, y);
      y += 22;
      doc.setFontSize(12);
      for (let row of htmlTable.rows) {
        let line = [];
        for (let cell of row.cells) line.push(cell.textContent.substring(0, 25));
        doc.text(line.join(' | '), 10, y);
        y += 8;
        if (y > 180) {
          doc.addPage();
          y = 22;
        }
      }
      doc.save('hodreport.pdf');
    };

    // Remaining timetable, approval, report, analytics code unchanged ...

   // Show student alerts about reschedule responses
    function updateStudentAlerts(request) {
      let currentStudentId = document.getElementById('student-enroll')?.value.trim() || '';
      if (request.studentId !== currentStudentId) return;
      let alertDiv = document.getElementById('student-alerts');
      let message = '';
      if (request.status === 'approved') {
        message = `✅ Your class reschedule request for ${request.day} period ${request.period} has been approved.`;
        alertDiv.style.backgroundColor = '#d0f0d0'; alertDiv.style.color = '#2e7d32';
      }
      else if (request.status === 'rejected') {
        message = `❌ Your class reschedule request for ${request.day} period ${request.period} has been rejected.`;
        alertDiv.style.backgroundColor = '#f8d7da'; alertDiv.style.color = '#b71c1c';
      }
      else {
        alertDiv.style.backgroundColor = '';
        alertDiv.style.color = '#b71c1c';
      }
      alertDiv.textContent = message;
      setTimeout(() => {
        alertDiv.textContent = '';
        alertDiv.style.backgroundColor = '';
        alertDiv.style.color = '#b71c1c';
      }, 8000);
    }

    // Student search and timetable display
    document.getElementById('search-student').onclick = function () {
      let branch = document.getElementById('student-branch').value.trim();
      let section = document.getElementById('student-section').value.trim();
      let enroll = document.getElementById('student-enroll').value.trim();
      const container = document.getElementById('student-timetable');
      const crRescheduleBtn = document.getElementById('cr-reschedule-btn');
      container.innerHTML = '';
      if (!branch || !section) {
        container.textContent = 'Enter branch and section.';
        crRescheduleBtn.style.display = 'none';
        return;
      }
      if (!timetableDB[branch] || !timetableDB[branch][section]) {
        container.textContent = `No timetable found for branch ${branch} section ${section}`;
        crRescheduleBtn.style.display = 'none';
        return;
      }
      const { year, cr, days, periods, schedule } = timetableDB[branch][section];
      const isCR = enroll.toUpperCase() === (cr?.toUpperCase() || '');
      if (isCR) {
        crRescheduleBtn.style.display = 'inline-block';
      } else {
        crRescheduleBtn.style.display = 'none';
      }
      let html = isCR ? '<div class="cr-highlight">Class Representative</div>' : '';
      html += `<table class="tt-table"><thead><tr><th>Day / Period</th>`;
      periods.forEach(p => html += `<th>${p}</th>`);
      html += '</tr></thead><tbody>';
      days.forEach(day => {
        html += `<tr><th>${day}</th>` + schedule[day].map(sess =>
          `<td>
            <div class="tt-subject">${sess.subject}</div>
            <div class="tt-faculty">${sess.faculty}</div>
            <div class="tt-room">${sess.room}</div>
          </td>`).join('') + '</tr>';
      });
      html += '</tbody></table>';
      container.innerHTML = html;

      // Show alerts if any updates on reschedule requests
      let latestReq = [...rescheduleRequestsDB].reverse().find(r => r.studentId === enroll);
      if (latestReq) updateStudentAlerts(latestReq);
    };

    // CR reschedule request button placeholder (Integration to backend workflow)
    document.getElementById('cr-reschedule-btn').onclick = function () {
      alert('CR Rescheduling modal/dialogue feature to be integrated with backend workflow.');
    };

    // Timetable Approval loading
    function loadApprovalTimetable() {
      const container = document.getElementById('approval-timetable-container');
      container.innerHTML = '';
      let sel = `<label>Branch:
      <select id="approval-branch">
        <option value="">--</option>
        ${Object.keys(timetableDB).map(b => `<option value="${b}">${b}</option>`).join('')}
      </select>
      Section:
      <select id="approval-section"></select>
      <button id="approval-search-btn">Show</button>
    </label>`;
      container.innerHTML = sel;
      document.getElementById('approval-branch').onchange = function () {
        const branch = this.value;
        let secSel = document.getElementById('approval-section');
        secSel.innerHTML = '<option value="">--</option>';
        if (timetableDB[branch]) {
          Object.keys(timetableDB[branch]).forEach(sec => {
            secSel.innerHTML += `<option value="${sec}">${sec}</option>`;
          });
        }
      };
      document.getElementById('approval-search-btn').onclick = function () {
        const branch = document.getElementById('approval-branch').value;
        const section = document.getElementById('approval-section').value;
        if (!branch || !section) {
          container.innerHTML += "<br><span style='color:#b0183d;'>Select branch/section!</span>";
          return;
        }
        let { days, periods, schedule } = timetableDB[branch][section];
        let html = `<h3>${branch} Section ${section} Timetable</h3><table class="tt-table"><thead><tr><th>Day / Period</th>`;
        periods.forEach(p => html += `<th>${p}</th>`);
        html += '</tr></thead><tbody>';
        days.forEach(day => {
          html += `<tr><th>${day}</th>` +
            schedule[day].map(sess => {
              return `<td>
            <div class="tt-subject">${sess.subject}</div>
            <div class="tt-faculty">${sess.faculty}</div>
            <div class="tt-room">${sess.room}</div>
            <button class="approval-reschedule-class-btn" data-day="${day}" data-period="${periods[schedule[day].indexOf(sess)]}" data-faculty="${sess.faculty}">Reschedule</button>
          </td>`;
            }).join('') + '</tr>';
        });
        html += '</tbody></table>';
        container.innerHTML = html;
      };
    }

    // Show reschedule popup for approval tab
    document.body.addEventListener('click', function (e) {
      if (e.target.classList.contains('approval-reschedule-class-btn')) {
        let day = e.target.getAttribute('data-day');
        let period = e.target.getAttribute('data-period');
        let faculty = e.target.getAttribute('data-faculty');
        showReschedulePopup(day, period, faculty);
      }
    });

    function showReschedulePopup(day, period, faculty) {
      document.getElementById('approval-reschedule-popup').style.display = 'block';
      document.getElementById('reschedule-day').innerHTML = `<option>${day}</option>`;
      document.getElementById('reschedule-period').innerHTML = `<option>${period}</option>`;
      document.getElementById('reschedule-faculty').value = faculty;
      document.getElementById('reschedule-detail').value = '';
    }

    function closeReschedulePopup() {
      document.getElementById('approval-reschedule-popup').style.display = 'none';
    }

    // Reschedule form submit - add to requests DB
    document.getElementById('reschedule-form').onsubmit = function (e) {
      e.preventDefault();
      let day = document.getElementById('reschedule-day').value;
      let period = document.getElementById('reschedule-period').value;
      let faculty = document.getElementById('reschedule-faculty').value.trim();
      let detail = document.getElementById('reschedule-detail').value.trim();
      let studentId = document.getElementById('student-enroll')?.value.trim() || 'unknown';

      rescheduleRequestsDB.push({
        day,
        period,
        facultyName: faculty,
        detail,
        studentId,
        status: "pending",
        timestamp: Date.now()
      });

      closeReschedulePopup();
      document.getElementById('approval-msg').innerHTML = `<span style="color:green;">Mail sent to ${faculty} for rescheduling!</span>`;
      setTimeout(() => { document.getElementById('approval-msg').innerHTML = ''; }, 4000);

      loadFacultyRescheduleRequests(faculty);
      updateApprovalSectionStatus();
    };

    // HOD Panel logic (attendance and reporting) - placeholder functinality example
    document.getElementById('hod-login-form').onsubmit = function (e) {
      e.preventDefault();
      const hodName = document.getElementById('hod-login-name').value.trim();
      const container = document.getElementById('hod-data-container');
      if (!hodName) {
        container.textContent = 'Enter HOD name.';
        return;
      }
      // Example reporting logic (to be extended with actual attendance data)
      let reportRows = [];
      for (let faculty in facultyAttendanceDB) {
        let classesTaken = 0, classesAbsent = 0, classesRescheduled = 0, proofs = [];
        const sessions = facultyAttendanceDB[faculty];
        for (let skey in sessions) {
          if (sessions[skey].status === 'present') classesTaken++;
          else if (sessions[skey].status === 'absent') classesAbsent++;
          if (sessions[skey].proofDataURL) proofs.push(sessions[skey].proofDataURL);
        }
        let rescheduled = rescheduleRequestsDB.filter(x => x.facultyName?.toLowerCase() === faculty.toLowerCase() && x.status === 'approved').length;
        reportRows.push({ faculty, classesTaken, classesAbsent, rescheduled, proofs });
      }
      let html = '<h2>Attendance Classes Overview</h2><table class="hod-table"><thead><tr><th>Faculty Name</th><th>Classes Taken</th><th>Classes Absent</th><th>Classes Rescheduled</th><th>Proofs Uploaded</th></tr></thead><tbody>';
      reportRows.forEach(row => {
        html += `<tr><td>${row.faculty}</td><td>${row.classesTaken}</td><td>${row.classesAbsent}</td><td>${row.rescheduled}</td><td>${row.proofs.map(p => `<img src="${p}" class="attendance-proof-img" />`).join('')}</td></tr>`;
      });
      html += '</tbody></table>';
      container.innerHTML = html;
      document.getElementById('hod-export-csv').style.display = 'inline-block';
      document.getElementById('hod-export-pdf').style.display = 'inline-block';
    };

    // HOD CSV export
    document.getElementById('hod-export-csv').onclick = function () {
      let htmlTable = document.querySelector('.hod-table');
      if (!htmlTable) {
        alert('No data to export.');
        return;
      }
      let csv = [];
      for (let row of htmlTable.rows) {
        let cells = [];
        for (let cell of row.cells) cells.push(cell.textContent.replace(/,/g, ''));
        csv.push(cells.join(','));
      }
      let blob = new Blob([csv.join('\n')], { type: 'text/csv' });
      let a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'hodreport.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    };

    // HOD PDF export
    document.getElementById('hod-export-pdf').onclick = function () {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('landscape');
      let y = 10;
      const htmlTable = document.querySelector('.hod-table');
      if (!htmlTable) {
        alert('No data to export.');
        return;
      }
      doc.setFontSize(20);
      doc.text('HOD Attendance Class Overview', 10, y);
      y += 22;
      doc.setFontSize(12);
      for (let row of htmlTable.rows) {
        let line = [];
        for (let cell of row.cells) line.push(cell.textContent.substring(0, 25));
        doc.text(line.join(' | '), 10, y);
        y += 8;
        if (y > 180) {
          doc.addPage();
          y = 22;
        }
      }
      doc.save('hodreport.pdf');
    };

    // Reports Tab Filtering and Generation Logic (class, teacher, subject, room) - placeholder for admin reporting features
    let activeReportTab = 'class';
    const reportsTabs = document.querySelectorAll('#reports-tabs button');
    reportsTabs.forEach(btn => {
      btn.onclick = function () {
        reportsTabs.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        activeReportTab = this.dataset.report;
        document.getElementById('reports-export-csv').style.display = 'none';
        document.getElementById('reports-content').innerHTML = `<p>Select branch and section, then click Generate Report to view ${activeReportTab} report.</p>`;
      };
    });

    function initializeReportsFilters() {
      const branchSelect = document.getElementById('reports-branch-select');
      const sectionSelect = document.getElementById('reports-section-select');
      branchSelect.innerHTML = '<option value="">-- Select Branch --</option>';
      Object.keys(timetableDB).forEach(branch => {
        branchSelect.innerHTML += `<option value="${branch}">${branch}</option>`;
      });
      sectionSelect.innerHTML = '<option value="">-- Select Section --</option>';
      branchSelect.onchange = function () {
        const selectedBranch = this.value;
        sectionSelect.innerHTML = '<option value="">-- Select Section --</option>';
        if (selectedBranch && timetableDB[selectedBranch]) {
          Object.keys(timetableDB[selectedBranch]).forEach(sec => {
            sectionSelect.innerHTML += `<option value="${sec}">${sec}</option>`;
          });
        }
      };
      document.getElementById('reports-generate-btn').onclick = function () {
        generateReport(activeReportTab);
      };
      document.getElementById('reports-export-csv').onclick = function () {
        const container = document.getElementById('reports-content');
        if (!container.innerText.trim()) {
          alert('No report to export.');
          return;
        }
        const tables = container.querySelectorAll('table');
        if (!tables.length) {
          alert('No tabular data in report to export.');
          return;
        }
        let csv = [];
        tables.forEach(table => {
          for (let row of table.rows) {
            let cells = [];
            for (let cell of row.cells) cells.push(cell.textContent.trim().replace(/,/g, ''));
            csv.push(cells.join(','));
          }
          csv.push('');
        });
        let blob = new Blob([csv.join('\n')], { type: 'text/csv' });
        let a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${activeReportTab}_report_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      };
    }

    // Placeholder report generation functions - can be extended for full report details
    function generateReport(type) {
      const branch = document.getElementById('reports-branch-select').value;
      const section = document.getElementById('reports-section-select').value;
      const container = document.getElementById('reports-content');
      container.innerHTML = '';
      if (!branch) {
        container.innerHTML = '<p>Please select a branch.</p>';
        return;
      }
      if ((type !== 'teacher' && !section)) {
        container.innerHTML = '<p>Please select a section.</p>';
        return;
      }
      switch (type) {
        case 'class':
          generateClassReport(branch, section);
          break;
        case 'teacher':
          generateTeacherReport(branch);
          break;
        case 'subject':
          generateSubjectReport(branch);
          break;
        case 'room':
          generateRoomReport(branch);
          break;
        default:
          container.innerHTML = `<p>Unknown report type: ${type}</p>`;
      }
      document.getElementById('reports-export-csv').style.display = 'inline-block';
    }

    function generateClassReport(branch, section) {
      const container = document.getElementById('reports-content');
      if (!section) {
        container.innerHTML = '<p>Please select a section.</p>';
        return;
      }
      if (!timetableDB[branch] || !timetableDB[branch][section]) {
        container.innerHTML = `<p>No data for branch ${branch} section ${section}</p>`;
        return;
      }
      const { days, periods, schedule } = timetableDB[branch][section];
      let subjCount = {};
      let roomCount = {};
      days.forEach(day => {
        schedule[day].forEach(sess => {
          subjCount[sess.subject] = (subjCount[sess.subject] || 0) + 1;
          roomCount[sess.room] = (roomCount[sess.room] || 0) + 1;
        });
      });
      let html = `<h2>Timetable for ${branch} Section ${section}</h2>
        <table class="tt-table"><thead><tr><th>Day</th><th>Period</th><th>Subject</th><th>Room</th></tr></thead><tbody>`;
      days.forEach(day => {
        schedule[day].forEach((sess, idx) => {
          html += `<tr><td>${day}</td><td>${periods[idx]}</td><td>${sess.subject}</td><td>${sess.room}</td></tr>`;
        });
      });
      html += '</tbody></table>';
      html += '<h3>Number of periods per subject</h3><table class="tt-table"><thead><tr><th>Subject</th><th>Periods</th></tr></thead><tbody>';
      Object.entries(subjCount).forEach(([subj, count]) => {
        html += `<tr><td>${subj}</td><td>${count}</td></tr>`;
      });
      html += '</tbody></table>';
      html += '<h3>Room Allocation Summary</h3><table class="tt-table"><thead><tr><th>Room</th><th>Periods Occupied</th></tr></thead><tbody>';
      Object.entries(roomCount).forEach(([room, count]) => {
        html += `<tr><td>${room}</td><td>${count}</td></tr>`;
      });
      html += '</tbody></table>';
      container.innerHTML = html;
    }

    function generateTeacherReport(branch) {
      const container = document.getElementById('reports-content');
      if (!branch) {
        container.innerHTML = '<p>Please select a branch.</p>';
        return;
      }
      if (!timetableDB[branch]) {
        container.innerHTML = `<p>No data for branch ${branch}</p>`;
        return;
      }
      let teacherData = {};
      const branchData = timetableDB[branch];
      for (const section in branchData) {
        const { days, periods, schedule } = branchData[section];
        for (let day of days) {
          schedule[day].forEach((sess, idx) => {
            if (!teacherData[sess.faculty]) {
              teacherData[sess.faculty] = { workload: 0, classes: [] };
            }
            teacherData[sess.faculty].workload++;
            teacherData[sess.faculty].classes.push({ section, day, period: periods[idx], subject: sess.subject, room: sess.room });
          });
        }
      }
      let html = `<h2>Teacher Timetable Workload - Branch ${branch}</h2>
      <table class="tt-table"><thead><tr><th>Teacher</th><th>Number of Periods (Week)</th><th>Class Timetable</th></tr></thead><tbody>`;
      for (let teacher in teacherData) {
        let classesHtml = teacherData[teacher].classes.map(c =>
          `${c.day} ${c.period} - ${c.section} (${c.subject}) in ${c.room}`).join('<br>');
        html += `<tr><td>${teacher}</td><td>${teacherData[teacher].workload}</td><td>${classesHtml}</td></tr>`;
      }
      html += '</tbody></table>';
      container.innerHTML = html;
    }

    function generateSubjectReport(branch) {
      const container = document.getElementById('reports-content');
      if (!branch) {
        container.innerHTML = '<p>Please select a branch.</p>';
        return;
      }
      if (!timetableDB[branch]) {
        container.innerHTML = `<p>No data for branch ${branch}</p>`;
        return;
      }
      let subjectData = {};
      const branchData = timetableDB[branch];
      for (let section in branchData) {
        const { days, schedule } = branchData[section];
        for (let day of days) {
          schedule[day].forEach(sess => {
            if (!subjectData[sess.subject]) {
              subjectData[sess.subject] = { count: 0, teachers: new Set() };
            }
            subjectData[sess.subject].count++;
            subjectData[sess.subject].teachers.add(sess.faculty);
          });
        }
      }
      let html = `<h2>Subject Distribution Periods per Week - Branch ${branch}</h2>
        <table class="tt-table"><thead><tr><th>Subject</th><th>Periods per Week</th><th>Teachers</th></tr></thead><tbody>`;
      Object.entries(subjectData).forEach(([subject, data]) => {
        html += `<tr><td>${subject}</td><td>${data.count}</td><td>${Array.from(data.teachers).join(', ')}</td></tr>`;
      });
      html += '</tbody></table>';
      container.innerHTML = html;
    }

    function generateRoomReport(branch) {
      const container = document.getElementById('reports-content');
      if (!branch) {
        container.innerHTML = '<p>Please select a branch.</p>';
        return;
      }
      if (!timetableDB[branch]) {
        container.innerHTML = `<p>No data for branch ${branch}</p>`;
        return;
      }
      let roomUsage = {};
      let conflicts = [];
      const branchData = timetableDB[branch];
      for (let section in branchData) {
        const { days, periods, schedule } = branchData[section];
        days.forEach(day => {
          let periodRoomMap = {};
          schedule[day].forEach((sess, idx) => {
            const key = day + '-' + periods[idx];
            if (!roomUsage[sess.room]) roomUsage[sess.room] = 0;
            roomUsage[sess.room]++;
            if (!periodRoomMap[sess.room]) periodRoomMap[sess.room] = [];
            periodRoomMap[sess.room].push({ section, subject: sess.subject });
          });
          Object.entries(periodRoomMap).forEach(([room, bookings]) => {
            if (bookings.length > 1) {
              conflicts.push({ room, day, details: bookings });
            }
          });
        });
      }
      let html = `<h2>Room Usage Summary - Branch ${branch}</h2>
        <table class="tt-table"><thead><tr><th>Room</th><th>Periods Occupied</th></tr></thead><tbody>`;
      Object.entries(roomUsage).forEach(([room, count]) => {
        html += `<tr><td>${room}</td><td>${count}</td></tr>`;
      });
      html += '</tbody></table>';
      html += `<h2>Conflicts Double Booked Rooms</h2>`;
      if (conflicts.length === 0) html += '<p>No conflicts detected.</p>';
      else {
        html += `<table class="tt-table"><thead><tr><th>Room</th><th>Day</th><th>Details</th></tr></thead><tbody>`;
        conflicts.forEach(c => {
          const detailStr = c.details.map(d => `${d.section} ${d.subject}`).join(', ');
          html += `<tr><td>${c.room}</td><td>${c.day}</td><td>${detailStr}</td></tr>`;
        });
        html += '</tbody></table>';
      }
      container.innerHTML = html;
    }

    facultyAttendanceDB = {
  "Dr. Sharma": {
    "2025-09-29": {
      status: "present",
      proofDataURL: "data:image/png;base64,..."
    }
  }
}


    // Analytics Dashboard Initialization
    function initializeAnalyticsFilters() {
      const analyticsBranchSelect = document.getElementById('analytics-branch-select');
      analyticsBranchSelect.innerHTML = '<option value="">-- Select Branch --</option>';
      Object.keys(timetableDB).forEach(branch => {
        analyticsBranchSelect.innerHTML += `<option value="${branch}">${branch}</option>`;
      });
      document.getElementById('analytics-generate-btn').onclick = function () {
        generateAnalytics(document.getElementById('analytics-branch-select').value);
      };
      clearAnalyticsContent();
    }

    function clearAnalyticsContent() {
      document.getElementById('analytics-content').innerHTML = '<p>Select branch and click Generate Analytics.</p>';
    }

    function generateAnalytics(branch) {
      const analyticsDiv = document.getElementById('analytics-content');
      analyticsDiv.innerHTML = '';
      const branchData = timetableDB[branch];
      if (!branchData) {
        analyticsDiv.innerHTML = `<p>No data for branch ${branch}</p>`;
        return;
      }
      let teacherWorkload = {};
      let subjectDist = {};
      let roomUsage = {};
      let daysSet = new Set();
      let periodsSet = new Set();

      for (let section in branchData) {
        const { days, periods, schedule } = branchData[section];
        days.forEach(day => daysSet.add(day));
        periods.forEach(p => periodsSet.add(p));
        days.forEach(day => {
          schedule[day].forEach((sess, idx) => {
            teacherWorkload[sess.faculty] = (teacherWorkload[sess.faculty] || 0) + 1;
            subjectDist[sess.subject] = (subjectDist[sess.subject] || 0) + 1;
            const key = day + '-' + periods[idx];
            roomUsage[key] = (roomUsage[key] || {});
            roomUsage[key][sess.room] = (roomUsage[key][sess.room] || 0) + 1;
          });
        });
      }

      // Teacher Workload Pie Chart
      const teacherLabels = Object.keys(teacherWorkload);
      const teacherData = Object.values(teacherWorkload);
      if (teacherLabels.length > 0) {
        const teacherChartCanvas = document.createElement('canvas');
        teacherChartCanvas.style.maxWidth = '450px';
        analyticsDiv.appendChild(document.createElement('hr'));
        analyticsDiv.appendChild(document.createElement('h3')).textContent = 'Teacher Workload Distribution';
        analyticsDiv.appendChild(teacherChartCanvas);
        new Chart(teacherChartCanvas.getContext('2d'), {
          type: 'pie',
          data: {
            labels: teacherLabels,
            datasets: [{
              data: teacherData,
              backgroundColor: teacherLabels.map(() => randomColor())
            }]
          },
          options: { responsive: true, plugins: { legend: { position: 'right' } } }
        });
      }

      // Subject Distribution Bar Chart
      const subjectLabels = Object.keys(subjectDist);
      const subjectDataValues = Object.values(subjectDist);
      if (subjectLabels.length > 0) {
        const subjectChartCanvas = document.createElement('canvas');
        subjectChartCanvas.style.maxWidth = '600px';
        analyticsDiv.appendChild(document.createElement('hr'));
        analyticsDiv.appendChild(document.createElement('h3')).textContent = 'Subject Distribution Periods per Week';
        analyticsDiv.appendChild(subjectChartCanvas);
        new Chart(subjectChartCanvas.getContext('2d'), {
          type: 'bar',
          data: {
            labels: subjectLabels,
            datasets: [{
              label: 'Periods',
              data: subjectDataValues,
              backgroundColor: 'rgba(242, 109, 132, 0.8)',
              borderColor: 'rgba(178, 24, 61, 1)',
              borderWidth: 1
            }]
          },
          options: { responsive: true, scales: { y: { beginAtZero: true, stepSize: 1 } } }
        });
      }

      // Room Usage Heatmap (table)
      analyticsDiv.appendChild(document.createElement('hr'));
      const heatmapTitle = document.createElement('h3');
      heatmapTitle.textContent = 'Room Usage Heatmap (counts per day-period)';
      analyticsDiv.appendChild(heatmapTitle);
      const heatmapTable = document.createElement('table');
      heatmapTable.className = 'tt-table';
      const daysArr = Array.from(daysSet);
      const periodsArr = Array.from(periodsSet);
      let thead = heatmapTable.createTHead();
      let headRow = thead.insertRow();
      headRow.insertCell().textContent = 'Room / Period';
      periodsArr.forEach(p => headRow.insertCell().textContent = p);
      let tbody = heatmapTable.createTBody();
      // Aggregate room usage by day and period
      let roomTotals = {};
      daysArr.forEach(day => {
        periodsArr.forEach(period => {
          let key = day + '-' + period;
          if (roomUsage[key]) {
            Object.keys(roomUsage[key]).forEach(room => {
              roomTotals[room] = roomTotals[room] || 0;
              roomTotals[room] += roomUsage[key][room];
            });
          }
        });
      });
      Object.keys(roomTotals).forEach(room => {
        let row = tbody.insertRow();
        row.insertCell().textContent = room;
        periodsArr.forEach(period => {
          let count = 0;
          daysArr.forEach(day => {
            let key = day + '-' + period;
            if (roomUsage[key] && roomUsage[key][room] > 0) {
              count += roomUsage[key][room];
            }
          });
          let cell = row.insertCell();
          cell.textContent = count;
          if (count > 0) cell.style.backgroundColor = '#ffd464aa';
        });
      });
      analyticsDiv.appendChild(heatmapTable);
    }

    // Utility to generate random colors for charts
    function randomColor() {
      const r = Math.floor(200 * Math.random() + 55);
      const g = Math.floor(100 * Math.random() + 155);
      const b = Math.floor(100 * Math.random() + 155);
      return `rgb(${r},${g},${b})`;
    }
  