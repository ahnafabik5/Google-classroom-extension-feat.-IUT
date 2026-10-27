import {
  getActiveCourses,
  getCourseWork,
  getStudentSubmissions,
  getCourseMaterials
} from "/src/api/classroom.js";

const syncBtn = document.getElementById("sync-btn");
if (syncBtn) syncBtn.addEventListener("click", renderDashboard);

function isJoinedOnOrAfterCutoff(course) {
  const name = course.name || "";
  const section = course.section || "";
  const combined = (name + " " + section).toLowerCase();

  if (/41\d\d|42\d\d|2425|2024-2025|2024-25|summer 25/.test(combined)) {
    return false;
  }
  if (/43\d\d/.test(combined)) return true;

  const created = new Date(course.creationTime);
  return created >= new Date("2026-10-01T00:00:00");
}

function getStorageData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["selectedCourseIds", "knownCourseIds"], (res) => {
      resolve({
        selectedCourseIds: res.selectedCourseIds || null,
        knownCourseIds: res.knownCourseIds || null
      });
    });
  });
}

function saveStorageData(selectedCourseIds, knownCourseIds) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ selectedCourseIds, knownCourseIds }, resolve);
  });
}

// Clean credit display without any section prefix number
function parseCredit(course) {
  const name = course.name || "";
  if (/lab/i.test(name)) {
    return "Credit: 1.5";
  }
  return "Credit: 3.0";
}

function isPastDue(dueDate, dueTime) {
  if (!dueDate || !dueDate.year) return false;
  const hours = dueTime && typeof dueTime.hours === "number" ? dueTime.hours : 23;
  const minutes = dueTime && typeof dueTime.minutes === "number" ? dueTime.minutes : 59;
  const dueDateTime = new Date(dueDate.year, dueDate.month - 1, dueDate.day, hours, minutes, 59);
  return dueDateTime < new Date();
}

function extractDriveMaterials(materials) {
  if (!materials || !Array.isArray(materials)) return [];
  const links = [];
  for (const m of materials) {
    if (m.driveFile && m.driveFile.driveFile) {
      links.push({
        title: m.driveFile.driveFile.title || "Drive File",
        url: m.driveFile.driveFile.alternateLink
      });
    } else if (m.link) {
      links.push({
        title: m.link.title || m.link.url,
        url: m.link.url
      });
    } else if (m.youtubeVideo) {
      links.push({
        title: m.youtubeVideo.title || "Video Lecture",
        url: m.youtubeVideo.alternateLink
      });
    } else if (m.form) {
      links.push({
        title: m.form.title || "Google Form",
        url: m.form.formUrl
      });
    }
  }
  return links;
}

async function renderDashboard() {
  const status = document.getElementById("status");
  const tableContainer = document.getElementById("table-container");
  const tbody = document.getElementById("dashboard-body");

  status.style.display = "block";
  status.textContent = "Syncing courses and dashboard...";
  tableContainer.style.display = "none";
  tbody.innerHTML = "";

  try {
    const allCourses = await getActiveCourses();
    if (!allCourses || allCourses.length === 0) {
      status.textContent = "No active enrolled courses found.";
      return;
    }

    const currentAllIds = allCourses.map((c) => c.id);
    let { selectedCourseIds, knownCourseIds } = await getStorageData();

    if (!selectedCourseIds || !knownCourseIds) {
      selectedCourseIds = allCourses
        .filter((c) => isJoinedOnOrAfterCutoff(c))
        .map((c) => c.id);
      knownCourseIds = currentAllIds;
      await saveStorageData(selectedCourseIds, knownCourseIds);
    } else {
      let updated = false;
      for (const course of allCourses) {
        if (!knownCourseIds.includes(course.id)) {
          knownCourseIds.push(course.id);
          if (isJoinedOnOrAfterCutoff(course)) {
            selectedCourseIds.push(course.id);
          }
          updated = true;
        }
      }
      if (updated) {
        await saveStorageData(selectedCourseIds, knownCourseIds);
      }
    }

    const filteredCourses = allCourses.filter((c) => selectedCourseIds.includes(c.id));

    if (filteredCourses.length === 0) {
      status.textContent = "No active courses found for this semester.";
      return;
    }

    for (const course of filteredCourses) {
      const [coursework, rawMaterials] = await Promise.all([
        getCourseWork(course.id),
        getCourseMaterials(course.id)
      ]);

      const dueList = [];
      const pastList = [];
      const submittedList = [];
      const filteredMaterials = [];

      for (const cw of coursework) {
        const cwLinks = extractDriveMaterials(cw.materials);
        if (cwLinks.length > 0) {
          filteredMaterials.push({
            title: cw.title || "Task Attachment",
            postUrl: cw.alternateLink || course.alternateLink,
            links: cwLinks
          });
        }

        const subs = await getStudentSubmissions(course.id, cw.id);
        const sub = subs[0];
        const isSubmitted = sub && (sub.state === "TURNED_IN" || sub.state === "RETURNED");

        const dueFormatted = (cw.dueDate && cw.dueDate.year)
          ? cw.dueDate.year + "-" + String(cw.dueDate.month).padStart(2, "0") + "-" + String(cw.dueDate.day).padStart(2, "0")
          : "No deadline";

        const itemUrl = cw.alternateLink || course.alternateLink;

        if (isSubmitted) {
          const score = (sub && typeof sub.assignedGrade === "number")
            ? sub.assignedGrade + "/" + (cw.maxPoints || 100)
            : "Turned In";
          submittedList.push({ title: cw.title, url: itemUrl, grade: score });
        } else if (isPastDue(cw.dueDate, cw.dueTime)) {
          pastList.push({ title: cw.title, url: itemUrl, due: dueFormatted });
        } else {
          dueList.push({ title: cw.title, url: itemUrl, due: dueFormatted });
        }
      }

      for (const mat of rawMaterials) {
        const links = extractDriveMaterials(mat.materials);
        filteredMaterials.push({
          title: mat.title || "Course Material",
          postUrl: mat.alternateLink || course.alternateLink,
          links: links
        });
      }

      const tr = document.createElement("tr");

      // Col 1: Course & Credit (Arrow removed completely)
      const tdCourse = document.createElement("td");
      tdCourse.innerHTML =
        '<a class="course-link" href="' + (course.alternateLink || "#") + '" target="_blank">' +
          course.name +
        '</a>' +
        '<span class="course-credit">' + parseCredit(course) + '</span>';

      // Col 2: Due Assignments
      const tdDue = document.createElement("td");
      tdDue.innerHTML = dueList.length
        ? dueList.map((d) =>
            '<a class="item-chip" href="' + d.url + '" target="_blank">' +
              '<div class="chip-title"><span>' + d.title + '</span></div>' +
              '<span class="chip-meta due-badge">Due: ' + d.due + '</span>' +
            '</a>'
          ).join("")
        : '<span class="empty-note">None</span>';

      // Col 3: Past Assignments
      const tdPast = document.createElement("td");
      tdPast.innerHTML = pastList.length
        ? pastList.map((p) =>
            '<a class="item-chip" href="' + p.url + '" target="_blank">' +
              '<div class="chip-title"><span>' + p.title + '</span></div>' +
              '<span class="chip-meta past-badge">Past: ' + p.due + '</span>' +
            '</a>'
          ).join("")
        : '<span class="empty-note">None</span>';

      // Col 4: Submitted
      const tdSubmitted = document.createElement("td");
      tdSubmitted.innerHTML = submittedList.length
        ? submittedList.map((s) =>
            '<a class="item-chip" href="' + s.url + '" target="_blank">' +
              '<div class="chip-title"><span>' + s.title + '</span></div>' +
              '<span class="chip-meta done-badge">' + s.grade + '</span>' +
            '</a>'
          ).join("")
        : '<span class="empty-note">None</span>';

      // Col 5: Materials
      const tdMaterials = document.createElement("td");
      tdMaterials.innerHTML = filteredMaterials.length
        ? filteredMaterials.map((m) => {
            const filesHtml = m.links.map((l) =>
              '<a class="file-link" href="' + l.url + '" target="_blank" title="' + l.title + '">&#x1F4C4; ' + l.title + '</a>'
            ).join("");
            return (
              '<div class="item-chip">' +
                '<a href="' + m.postUrl + '" target="_blank" style="text-decoration:none; color:inherit;">' +
                  '<div class="chip-title"><span>' + m.title + '</span></div>' +
                '</a>' +
                filesHtml +
              '</div>'
            );
          }).join("")
        : '<span class="empty-note">None</span>';

      tr.append(tdCourse, tdDue, tdPast, tdSubmitted, tdMaterials);
      tbody.appendChild(tr);
    }

    status.style.display = "none";
    tableContainer.style.display = "block";
  } catch (err) {
    status.style.display = "block";
    status.textContent = "Error: " + err.message;
  }
}

renderDashboard();