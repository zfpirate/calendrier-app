async function renderCalendar(year, month) {
  try {
    ensureAuthed();
  } catch (err) {
    calendar.innerHTML = "<div class='not-logged'>Connecte-toi pour voir le calendrier</div>";
    if (monthYear) monthYear.textContent = "";
    return;
  }

  state.currentYear = year;
  state.currentMonth = month;
  calendar.innerHTML = "";

  if (monthYear) {
    monthYear.textContent = `${MONTH_NAMES[month]} ${year}`;
  }

  DAY_NAMES.forEach((name) => {
    const el = document.createElement("div");
    el.className = "day-name";
    el.textContent = name;
    calendar.appendChild(el);
  });

  const firstDay = new Date(year, month, 1);
  const startDay = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const tasksByDay = {};
  try {
    const snap = await getDocs(
      query(
        collection(db, "devoirs"),
        where("ownerUid", "==", state.currentUser.uid),
        where("year", "==", year),
        where("month", "==", month)
      )
    );
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const day = Number(data.day);
      if (!Number.isFinite(day)) return;
      if (!tasksByDay[day]) tasksByDay[day] = [];
      tasksByDay[day].push({ id: docSnap.id, ...data });
    });
  } catch (err) {
    console.error("Erreur chargement devoirs du mois:", err);
  }

  for (let i = 0; i < startDay; i++) {
    const empty = document.createElement("div");
    empty.className = "empty";
    calendar.appendChild(empty);
  }

  const today = startOfDay(new Date());

  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement("div");
    cell.className = "date";
    const dateObj = new Date(year, month, day);
    const dateStr = formatDate(dateObj);
    cell.dataset.date = dateStr;

    const header = document.createElement("div");
    header.className = "date-header";

    const numberEl = document.createElement("div");
    numberEl.className = "num";
    numberEl.textContent = String(day);
    header.appendChild(numberEl);

    if (startOfDay(dateObj).getTime() === today.getTime()) {
      cell.classList.add("today");
      const lbl = document.createElement("span");
      lbl.className = "today-label";
      lbl.textContent = "Aujourd'hui";
      header.appendChild(lbl);
    }

    cell.appendChild(header);

    const dayTasks = tasksByDay[day] ? sortTasksForDisplay(tasksByDay[day]) : [];
    if (dayTasks.length) {
      cell.classList.add("has-tasks");
      const container = document.createElement("div");
      container.className = "tasks";

      dayTasks.slice(0, 3).forEach((task) => {
        const entryType = task.type || (task.rappel ? "rappel" : "devoir");
        const el = document.createElement("div");
        el.className = "task";
        if (entryType === "rappel") el.classList.add("rappel");
        el.textContent = buildTaskLabel(task);
        el.dataset.id = task.id;
        el.dataset.groupId = task.groupId || task.id;
        el.dataset.type = entryType;
        el.draggable = true;
        el.addEventListener("dragstart", handleTaskDragStart);
        el.addEventListener("dragend", handleTaskDragEnd);
        el.addEventListener("click", (ev) => {
          ev.stopPropagation();
          openModal(task.date || dateStr, task.id, task);
        });
        container.appendChild(el);
      });

      if (dayTasks.length > 3) {
        const more = document.createElement("div");
        more.className = "task more";
        more.textContent = `+${dayTasks.length - 3} autres`;
        container.appendChild(more);
      }

      cell.appendChild(container);
    }

    cell.addEventListener("dragenter", handleCalendarDragOver);
    cell.addEventListener("dragover", handleCalendarDragOver);
    cell.addEventListener("dragleave", handleCalendarDragLeave);
    cell.addEventListener("drop", handleCalendarDrop);
    cell.addEventListener("click", () => openDayTasksModal(dateStr));

    calendar.appendChild(cell);
  }
}
