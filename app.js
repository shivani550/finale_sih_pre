document.getElementById("tt-form").onsubmit = (e) => {
  e.preventDefault();

  const branch = document.getElementById("branch").value.trim();
  const sections = document.getElementById("sections").value.trim().split(',').map(s=>s.trim()).filter(Boolean);
  const rooms = document.getElementById("rooms").value.trim().split(',').map(s=>s.trim()).filter(Boolean);
  const days = document.getElementById("days").value.trim().split(',').map(d=>d.trim()).filter(Boolean);
  const periods = document.getElementById("periods").value.trim().split(',').map(p=>p.trim()).filter(Boolean);

  // [{subject,faculty}]
  const subjectLines = document.getElementById("subjects").value.trim().split('\n').map(s=>s.trim()).filter(Boolean);
  const subjects = subjectLines.map(line=>{
    let parts = line.split(',');
    return { subject: parts[0]?.trim(), faculty: parts[1]?.trim() }
  });

  // Build grid: [section][day][period]= {room,subject,faculty}
  let timetable = {};
  let facultyIdx = 0, subjectIdx = 0, roomIdx = 0;

  for(let section of sections){
    timetable[section] = {};
    for(let day of days){
      timetable[section][day] = [];
      let usedRooms = {};
      for(let pi=0;pi<periods.length;pi++){
        // Assign faculty & subject round robin
        let sub = subjects[subjectIdx % subjects.length];
        let fac = sub.faculty;
        let subj = sub.subject;
        subjectIdx++; facultyIdx++;
        // Assign room round robin, skip used this period
        let foundRoom = null;
        for (let off=0; off<rooms.length; off++) {
          let tryRoom = rooms[(roomIdx+off)%rooms.length];
          if (!usedRooms[tryRoom]) {
            foundRoom = tryRoom; usedRooms[tryRoom]=true; break;
          }
        }
        if (!foundRoom) foundRoom = rooms[pi % rooms.length];
        roomIdx++;

        timetable[section][day].push({
          period: periods[pi],
          room: foundRoom,
          faculty: fac,
          subject: subj
        });
      }
    }
  }

  // Render as color block timetable
  let html = "";
  for(let sec of sections){
    html += `<h2 class="tt-section">Section ${sec} (${branch})</h2>`;
    html += `<table class="tt-table"><tr><th>Day / Period</th>`;
    periods.forEach(p=>html+=`<th>${p}</th>`);
    html+='</tr>';
    days.forEach(day=>{
      html+=`<tr><th>${day}</th>`;
      timetable[sec][day].forEach(entry=>{
        html += `<td>
          <div class="tt-subject">${entry.subject}</div>
          <div class="tt-faculty">${entry.faculty}</div>
          <div class="tt-room">${entry.room}</div>
        </td>`;
      });
      html+='</tr>';
    });
    html += "</table>";
  }
  document.getElementById("timetable-container").innerHTML = html;
};
// Show Faculty timetable for given name
document.getElementById('faculty-login-form').addEventListener('submit', e => {
  e.preventDefault();
  const facultyName = document.getElementById('faculty-login-name').value.trim();
  if(!facultyName) return alert('Enter faculty name');
  
  let allSections = Object.keys(timetableData); // timetableData comes from generated timetable
  let filtered = [];
  
  allSections.forEach(sec => {
    const days = timetableData[sec];
    Object.keys(days).forEach(day=>{
      days[day].forEach(p=>{
        if(p.faculty.toLowerCase() === facultyName.toLowerCase()){
          filtered.push({
            section: sec,
            day: day,
            period: p.period,
            subject: p.subject,
            room: p.room
          });
        }
      });
    });
  });
  
  if(filtered.length === 0){
    document.getElementById('faculty-timetable-container').innerHTML = `<p>No timetable found for ${facultyName}</p>`;
    return;
  }
  
  // group by section & day & period for display
  let html = `<h3>Timetable for ${facultyName}</h3><table><tr>
    <th>Section</th><th>Day</th><th>Period</th><th>Subject</th><th>Room</th>
  </tr>`;
  filtered.forEach(c=>{
    html += `<tr><td>${c.section}</td><td>${c.day}</td><td>${c.period}</td><td>${c.subject}</td><td>${c.room}</td></tr>`;
  });
  html += '</table>';
  document.getElementById('faculty-timetable-container').innerHTML = html;
});

// Show Student timetable for batch and section
document.getElementById('student-login-form').addEventListener('submit', e => {
  e.preventDefault();
  const batch = document.getElementById('student-batch').value.trim();
  const section = document.getElementById('student-section').value.trim();
  
  if(!batch || !section) return alert('Enter batch and section');
  
  if(!timetableData[section]){
    document.getElementById('student-timetable-container').innerHTML = `<p>No timetable found for section ${section}</p>`;
    return;
  }
  
  let days = timetableData[section];
  let html = `<h3>Timetable for ${batch} Section ${section}</h3><table><tr><th>Day</th>`;
  Object.keys(days[Object.keys(days)[0]]).forEach(period=>{
    html += `<th>${period}</th>`;
  });
  html += '</tr>';
  
  for(let day in days){
    html += `<tr><th>${day}</th>`;
    days[day].forEach(p=>{
      html += `<td>${p.subject}<br/><strong>${p.faculty}</strong><br/>${p.room}</td>`;
    });
    html += '</tr>';
  }
  html += '</table>';
  document.getElementById('student-timetable-container').innerHTML = html;
});
// CSV Download
document.getElementById('download-csv').addEventListener('click', () => {
  const table = document.querySelector('#timetable-container table');
  if(!table) return alert("Generate timetable first!");

  const rows = [];
  for(let r=0;r<table.rows.length;r++){
    const cells = [];
    for(let c=0;c<table.rows[r].cells.length;c++){
      let cellText = table.rows[r].cells[c].innerText.replace(/\n/g, ' ');
      cells.push(`"${cellText}"`);
    }
    rows.push(cells.join(','));
  }
  const csvString = rows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'timetable.csv';
  a.click();
  URL.revokeObjectURL(url);
});

// PDF Download (using jsPDF, include this CDN in HTML head):
// <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
document.getElementById('download-pdf').addEventListener('click', () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('landscape');

  const table = document.querySelector('#timetable-container table');
  if(!table) return alert("Generate timetable first!");

  // jsPDF autoTable requires extra library, for simplicity, we convert table to text here:
  let y = 10;
  doc.setFontSize(18);
  doc.text('Generated Timetable', 14, y);
  y += 10;

  for(let r=0; r<table.rows.length; r++){
    let rowText = '';
    for(let c=0; c<table.rows[r].cells.length; c++){
      rowText += table.rows[r].cells[c].innerText.replace(/\n/g, ' ') + '   ';
    }
    doc.text(rowText.trim(), 14, y);
    y += 7;
    if(y > 280){ doc.addPage(); y = 10;}
  }

  doc.save('timetable.pdf');
});
