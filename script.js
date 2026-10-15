/* ==========================================================
   Student Records Viewer
   - Loads students_25.json with fetch()
   - Search + filter (.filter()) -> sort a copy (.sort()) -> render
   - The original dataset (allStudents) is never modified
   ========================================================== */

const DATA_URL = "students_25.json";
const PAGE_SIZE = 5;                 // used only when pagination is switched on

// The original records. Filled once after the JSON loads, then never changed.
let allStudents = [];
let currentPage = 1;

// ---------- DOM references ----------
const searchInput    = document.getElementById("searchInput");
const sortSelect     = document.getElementById("sortSelect");
const programFilter  = document.getElementById("programFilter");
const yearFilter     = document.getElementById("yearFilter");
const resetBtn       = document.getElementById("resetBtn");
const tableBody      = document.getElementById("tableBody");
const recordCount    = document.getElementById("recordCount");
const errorMessage   = document.getElementById("errorMessage");
const paginateToggle = document.getElementById("paginateToggle");
const pagination     = document.getElementById("pagination");
const prevBtn        = document.getElementById("prevBtn");
const nextBtn        = document.getElementById("nextBtn");
const pageInfo       = document.getElementById("pageInfo");


/* ==========================================================
   STEP 1: Load the data
   ========================================================== */

// Field names can differ between JSON files (firstName, first_name, "First Name"...).
// This helper finds the value no matter how the key is written.
function normalizeRecord(raw) {
  const simplified = {};
  Object.keys(raw).forEach((key) => {
    simplified[key.toLowerCase().replace(/[^a-z]/g, "")] = raw[key];
  });

  const pick = (...names) => {
    for (const name of names) {
      if (simplified[name] !== undefined && simplified[name] !== null) {
        return String(simplified[name]).trim();
      }
    }
    return "";
  };

  const yearText = pick("yearlevel", "year", "yearlvl", "level");

  return {
    firstName:     pick("firstname", "first", "fname", "givenname"),
    middleInitial: pick("middleinitial", "mi", "middle", "middlename"),
    lastName:      pick("lastname", "last", "lname", "surname", "familyname"),
    program:       pick("program", "course", "degree").toUpperCase(),
    yearLevel:     parseInt(yearText.replace(/\D/g, ""), 10)   // "Year 2" or "2" -> 2
  };
}

async function loadStudents() {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    const data = await response.json();

    // Accept either [ ... ] or { "students": [ ... ] }
    const list = Array.isArray(data) ? data : Object.values(data).find(Array.isArray);
    if (!list || list.length === 0) {
      throw new Error("The JSON file has no student records.");
    }

    allStudents = list.map(normalizeRecord);
    allStudents.forEach(Object.freeze);   // protect each record from accidental changes
    Object.freeze(allStudents);           // protect the original array

    updateTable();
  } catch (error) {
    showLoadError(error);
  }
}

function showLoadError(error) {
  errorMessage.hidden = false;
  errorMessage.textContent =
    "Could not load " + DATA_URL + " (" + error.message + "). " +
    "Make sure the file is in the same folder as index.html and run the page " +
    "with a local server such as the VS Code Live Server extension " +
    "(opening index.html directly with file:// will not work).";
  recordCount.textContent = "No records loaded.";
  [searchInput, sortSelect, programFilter, yearFilter, resetBtn, paginateToggle]
    .forEach((el) => { el.disabled = true; });
}


/* ==========================================================
   STEP 2: Render the table
   ========================================================== */

function renderTable(records, summaryText) {
  // 1. Clear the existing table body
  tableBody.replaceChildren();

  // Nothing matched: show a message instead of rows
  if (records.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.className = "no-results";
    cell.textContent = "No matching records found.";
    row.appendChild(cell);
    tableBody.appendChild(row);
  }

  // 2-4. Loop through the records, create a row for each student, fill the cells
  const columns = [
    ["First Name",     "firstName"],
    ["Middle Initial", "middleInitial"],
    ["Last Name",      "lastName"],
    ["Program",        "program"],
    ["Year Level",     "yearLevel"]
  ];

  records.forEach((student) => {
    const row = document.createElement("tr");
    columns.forEach(([label, key]) => {
      const cell = document.createElement("td");
      cell.dataset.label = label;          // used by the mobile card layout
      cell.textContent = student[key];     // textContent is safe from HTML injection
      row.appendChild(cell);
    });
    tableBody.appendChild(row);
  });

  // 5. Update the displayed record count
  recordCount.textContent = summaryText ||
    "Showing " + records.length + " of " + allStudents.length + " students";
}


/* ==========================================================
   STEP 3: Search and filters
   ========================================================== */

function getFilteredRecords() {
  const query   = searchInput.value.trim().toLowerCase();
  const program = programFilter.value;     // "all", "BSIT", "BSIS", "BSCS"
  const year    = yearFilter.value;        // "all", "1" ... "4"

  return allStudents.filter((student) => {
    // Case-insensitive search across first name, middle initial, last name, program
    const matchesSearch =
      query === "" ||
      [student.firstName, student.middleInitial, student.lastName, student.program]
        .some((value) => value.toLowerCase().includes(query));

    const matchesProgram = program === "all" || student.program === program;
    const matchesYear    = year === "all" || student.yearLevel === Number(year);

    return matchesSearch && matchesProgram && matchesYear;
  });
}


/* ==========================================================
   STEP 4: Sorting (always on a COPY of the filtered records)
   ========================================================== */

function compareText(a, b) {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function getSortedRecords(records) {
  const sorted = [...records];             // copy, so the original array is untouched
  const option = sortSelect.value;

  // Tie-breakers keep the order predictable when values are equal
  const byLast  = (a, b) => compareText(a.lastName, b.lastName) || compareText(a.firstName, b.firstName);
  const byFirst = (a, b) => compareText(a.firstName, b.firstName) || compareText(a.lastName, b.lastName);

  switch (option) {
    case "first-asc":  sorted.sort(byFirst); break;
    case "first-desc": sorted.sort((a, b) => byFirst(b, a)); break;
    case "last-asc":   sorted.sort(byLast); break;
    case "last-desc":  sorted.sort((a, b) => byLast(b, a)); break;
    case "year-asc":   sorted.sort((a, b) => (a.yearLevel - b.yearLevel) || byLast(a, b)); break;   // numeric, not alphabetic
    case "year-desc":  sorted.sort((a, b) => (b.yearLevel - a.yearLevel) || byLast(a, b)); break;
    default: break;                        // "default": keep the order from the JSON file
  }
  return sorted;
}


/* ==========================================================
   STEP 5: Update the interface
   ========================================================== */

function updateTable() {
  const filtered = getFilteredRecords();      // 1. search + filters
  const sorted   = getSortedRecords(filtered); // 2. sort the result

  // Bonus: pagination (5 students per page) works on the final sorted list
  if (paginateToggle.checked) {
    const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    currentPage = Math.min(Math.max(currentPage, 1), totalPages);

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageRecords = sorted.slice(start, start + PAGE_SIZE);

    const summary = sorted.length === 0
      ? "Showing 0 of " + allStudents.length + " students"
      : "Showing " + (start + 1) + "\u2013" + (start + pageRecords.length) +
        " of " + sorted.length + " matching students (" + allStudents.length + " total)";

    renderTable(pageRecords, summary);

    pagination.hidden = false;
    pageInfo.textContent = "Page " + currentPage + " of " + totalPages;
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;
  } else {
    pagination.hidden = true;
    renderTable(sorted);                       // 3. display everything that matches
  }
}

// Any change to search, sort, or filters starts again from page 1
function onControlChange() {
  currentPage = 1;
  updateTable();
}

function resetAll() {
  searchInput.value   = "";
  sortSelect.value    = "default";
  programFilter.value = "all";
  yearFilter.value    = "all";
  paginateToggle.checked = false;
  currentPage = 1;
  updateTable();
}


/* ==========================================================
   Event listeners
   ========================================================== */

searchInput.addEventListener("input", onControlChange);      // updates while typing
sortSelect.addEventListener("change", onControlChange);
programFilter.addEventListener("change", onControlChange);
yearFilter.addEventListener("change", onControlChange);
paginateToggle.addEventListener("change", onControlChange);
resetBtn.addEventListener("click", resetAll);

prevBtn.addEventListener("click", () => { currentPage--; updateTable(); });
nextBtn.addEventListener("click", () => { currentPage++; updateTable(); });

// Start the app
loadStudents();