const storageKey = "checkapp-state-v1";
const trashRetentionDays = 3;
const trashRetentionMs = trashRetentionDays * 24 * 60 * 60 * 1000;

const defaultState = {
  activeListId: "today",
  meta: {
    archiveExamplesSeeded: true
  },
  trash: [],
  lists: [
    {
      id: "today",
      name: "Heute",
      tasks: [
        { id: "task-1", title: "Erste Aufgabe abhaken", done: false, dueDate: "2026-05-23" },
        { id: "task-2", title: "Neue Checkliste erstellen", done: false, dueDate: "2026-05-30" },
        { id: "archive-example-1", title: "Rechnung abgelegt", done: true, completedAt: "2026-05-10T10:00:00.000Z" },
        { id: "archive-example-2", title: "Wochenplanung geprüft", done: true, completedAt: "2026-05-12T15:30:00.000Z" }
      ]
    }
  ]
};

const elements = {
  inputPanel: document.querySelector("#input-panel"),
  openTaskForm: document.querySelector("#open-task-form"),
  openListForm: document.querySelector("#open-list-form"),
  taskForm: document.querySelector("#task-form"),
  taskInput: document.querySelector("#task-input"),
  taskDueInput: document.querySelector("#task-due-input"),
  listSelect: document.querySelector("#list-select"),
  listForm: document.querySelector("#list-form"),
  listInput: document.querySelector("#list-input"),
  lists: document.querySelector("#lists"),
  tasks: document.querySelector("#tasks"),
  archiveToggle: document.querySelector("#archive-toggle"),
  archiveSection: document.querySelector("#archive-section"),
  archiveTasks: document.querySelector("#archive-tasks"),
  archiveCount: document.querySelector("#archive-count"),
  archiveFilter: document.querySelector("#archive-filter"),
  archiveSort: document.querySelector("#archive-sort"),
  archiveEmptyState: document.querySelector("#archive-empty-state"),
  emptyState: document.querySelector("#empty-state"),
  activeListTitle: document.querySelector("#active-list-title"),
  activeListCount: document.querySelector("#active-list-count"),
  renameList: document.querySelector("#rename-list"),
  deleteList: document.querySelector("#delete-list"),
  progressLabel: document.querySelector("#progress-label"),
  progressBar: document.querySelector("#progress-bar"),
  trashToggle: document.querySelector("#trash-toggle"),
  trashSection: document.querySelector("#trash-section"),
  trashTasks: document.querySelector("#trash-tasks"),
  trashCount: document.querySelector("#trash-count"),
  trashEmptyState: document.querySelector("#trash-empty-state"),
  deleteDialog: document.querySelector("#delete-dialog"),
  deleteTaskTitle: document.querySelector("#delete-task-title"),
  cancelDelete: document.querySelector("#cancel-delete"),
  confirmDelete: document.querySelector("#confirm-delete"),
};

let state = loadState();
let openForm = null;
let archiveOpen = false;
let trashOpen = false;
let pendingDelete = null;

function loadState() {
  let saved = null;
  try {
    saved = localStorage.getItem(storageKey);
  } catch {
    return structuredClone(defaultState);
  }

  if (!saved) {
    return structuredClone(defaultState);
  }

  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed.lists) || parsed.lists.length === 0) {
      return structuredClone(defaultState);
    }
    return migrateState(parsed);
  } catch {
    return structuredClone(defaultState);
  }
}

function migrateState(savedState) {
  const savedLists = Array.isArray(savedState.lists) && savedState.lists.length > 0
    ? savedState.lists
    : structuredClone(defaultState.lists);

  const migrated = {
    ...savedState,
    meta: savedState.meta || {},
    trash: Array.isArray(savedState.trash)
      ? savedState.trash.filter((trashItem) => trashItem.task && trashItem.deletedAt && trashItem.purgeAt)
      : [],
    lists: savedLists.map((list) => ({
      ...list,
      id: list.id || createId("list"),
      name: list.name || "Ohne Titel",
      tasks: (Array.isArray(list.tasks) ? list.tasks : []).map((task) => ({
        ...task,
        id: task.id || createId("task"),
        title: task.title || "Ohne Titel",
        done: Boolean(task.done),
        dueDate: task.dueDate || "",
        completedAt: task.done ? task.completedAt || new Date().toISOString() : null
      }))
    }))
  };

  if (!migrated.lists.some((list) => list.id === migrated.activeListId)) {
    migrated.activeListId = migrated.lists[0].id;
  }

  if (!migrated.meta.archiveExamplesSeeded) {
    const firstList = migrated.lists[0];
    const hasExamples = firstList.tasks.some((task) => task.id === "archive-example-1" || task.id === "archive-example-2");

    if (!hasExamples) {
      firstList.tasks.push(
        { id: "archive-example-1", title: "Rechnung abgelegt", done: true, completedAt: "2026-05-10T10:00:00.000Z" },
        { id: "archive-example-2", title: "Wochenplanung geprüft", done: true, completedAt: "2026-05-12T15:30:00.000Z" }
      );
    }

    migrated.meta.archiveExamplesSeeded = true;
  }

  return migrated;
}

function saveState() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // If browser storage is unavailable, keep the in-memory state usable.
  }
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getActiveList() {
  if (!Array.isArray(state.lists) || state.lists.length === 0) {
    state = structuredClone(defaultState);
  }

  return state.lists.find((list) => list.id === state.activeListId) || state.lists[0];
}

function render() {
  cleanupTrash();
  const activeList = getActiveList();
  state.activeListId = activeList.id;

  renderListSelect();
  renderLists(activeList);
  renderTasks(activeList);
  renderArchive(activeList);
  renderTrash();
  renderProgress();
  saveState();
}

function renderListSelect() {
  elements.listSelect.innerHTML = "";
  state.lists.forEach((list) => {
    const option = document.createElement("option");
    option.value = list.id;
    option.textContent = list.name;
    option.selected = list.id === state.activeListId;
    elements.listSelect.append(option);
  });
}

function renderTrash() {
  const trashItems = state.trash
    .slice()
    .sort((a, b) => new Date(b.deletedAt || 0) - new Date(a.deletedAt || 0));

  elements.trashSection.hidden = !trashOpen;
  elements.trashToggle.classList.toggle("active", trashOpen);
  elements.trashToggle.setAttribute("aria-expanded", String(trashOpen));
  elements.trashToggle.textContent = `Papierkorb (${trashItems.length})`;
  elements.trashCount.textContent = `${trashItems.length} gelöschte Aufgaben`;
  elements.trashTasks.innerHTML = "";
  elements.trashEmptyState.classList.toggle("visible", trashItems.length === 0);

  trashItems.forEach((trashItem) => {
    elements.trashTasks.append(createTrashItem(trashItem));
  });
}

function createTrashItem(trashItem) {
  const item = document.createElement("li");
  item.className = "trash-item";
  item.dataset.trashId = trashItem.id;

  const info = document.createElement("div");
  info.className = "trash-info";

  const title = document.createElement("span");
  title.className = "task-title";
  title.textContent = trashItem.task.title;

  const meta = document.createElement("div");
  meta.className = "trash-meta";
  meta.append(
    createMetaText(`Liste: ${trashItem.listName}`),
    createMetaText(`Gelöscht: ${formatDateTime(trashItem.deletedAt)}`),
    createMetaText(`Endgültig: ${formatDateTime(trashItem.purgeAt)}`)
  );

  const restoreButton = document.createElement("button");
  restoreButton.type = "button";
  restoreButton.className = "restore-button";
  restoreButton.textContent = "Wiederherstellen";
  restoreButton.setAttribute("aria-label", `${trashItem.task.title} wiederherstellen`);

  info.append(title, meta);
  item.append(info, restoreButton);
  return item;
}

function createMetaText(text) {
  const item = document.createElement("span");
  item.textContent = text;
  return item;
}

function compareTasksByDueDate(a, b) {
  if (!a.dueDate && !b.dueDate) {
    return a.title.localeCompare(b.title, "de");
  }

  if (!a.dueDate) {
    return 1;
  }

  if (!b.dueDate) {
    return -1;
  }

  return a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title, "de");
}

function renderLists(activeList) {
  elements.lists.innerHTML = "";

  state.lists.forEach((list) => {
    const openTasks = list.tasks.filter((task) => !task.done).length;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `list-button${list.id === activeList.id ? " active" : ""}`;
    button.dataset.listId = list.id;
    button.setAttribute("aria-current", list.id === activeList.id ? "true" : "false");
    button.innerHTML = `
      <span class="list-name"></span>
      <span class="badge">${openTasks}</span>
    `;
    button.querySelector(".list-name").textContent = list.name;
    elements.lists.append(button);
  });
}

function renderTasks(activeList) {
  elements.tasks.innerHTML = "";
  elements.activeListTitle.textContent = activeList.name;

  const openTasks = activeList.tasks.filter((task) => !task.done);
  openTasks.sort(compareTasksByDueDate);
  const archivedTasks = activeList.tasks.filter((task) => task.done);
  elements.activeListCount.textContent = `${openTasks.length} offen, ${archivedTasks.length} im Archiv`;
  elements.emptyState.classList.toggle("visible", openTasks.length === 0);
  elements.deleteList.disabled = state.lists.length <= 1;

  openTasks.forEach((task) => {
    elements.tasks.append(createTaskItem(task, false));
  });
}

function renderArchive(activeList) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const archivedTasks = activeList.tasks
    .filter((task) => task.done)
    .filter((task) => {
      const completedAt = new Date(task.completedAt || 0);

      if (elements.archiveFilter.value === "week") {
        return completedAt >= weekAgo;
      }

      if (elements.archiveFilter.value === "older") {
        return completedAt < weekAgo;
      }

      return true;
    })
    .sort((a, b) => {
      const first = new Date(a.completedAt || 0);
      const second = new Date(b.completedAt || 0);
      return elements.archiveSort.value === "oldest" ? first - second : second - first;
    });

  elements.archiveSection.hidden = !archiveOpen;
  elements.archiveToggle.classList.toggle("active", archiveOpen);
  elements.archiveToggle.setAttribute("aria-expanded", String(archiveOpen));
  elements.archiveToggle.textContent = `Archiv (${archivedTasks.length})`;
  elements.archiveCount.textContent = `${archivedTasks.length} erledigte Aufgaben angezeigt`;
  elements.archiveTasks.innerHTML = "";
  elements.archiveEmptyState.classList.toggle("visible", archivedTasks.length === 0);

  archivedTasks.forEach((task) => {
    elements.archiveTasks.append(createTaskItem(task, true));
  });
}

function createTaskItem(task, isArchived) {
  const item = document.createElement("li");
  item.className = `task-item${task.done ? " done" : ""}`;
  item.dataset.taskId = task.id;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = task.done;
  checkbox.setAttribute("aria-label", `${task.title} erledigt`);

  const titleWrap = document.createElement("span");
  const title = document.createElement("span");
  title.className = "task-title";
  title.textContent = task.title;
  titleWrap.append(title);

  if (isArchived) {
    const meta = document.createElement("span");
    meta.className = "task-meta";
    meta.textContent = `Erledigt am ${formatDate(task.completedAt)}`;
    titleWrap.append(meta);
  }

  const dueDate = document.createElement("span");
  dueDate.className = `due-date${task.dueDate ? "" : " empty"}${isOverdue(task.dueDate, task.done) ? " overdue" : ""}`;
  dueDate.textContent = task.dueDate ? formatDate(task.dueDate) : "Ohne Datum";

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "delete-button";
  deleteButton.textContent = "×";
  deleteButton.setAttribute("aria-label", "Aufgabe löschen");
  deleteButton.title = `${task.title} löschen`;

  item.append(checkbox, titleWrap, dueDate, deleteButton);
  return item;
}

function formatDateTime(value) {
  if (!value) {
    return "unbekannt";
  }

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatDate(value) {
  if (!value) {
    return "unbekannt";
  }

  const dateValue = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(dateValue));
}

function isOverdue(value, done) {
  if (!value || done) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(`${value}T00:00:00`);
  return dueDate < today;
}

function renderProgress() {
  const allTasks = state.lists.flatMap((list) => list.tasks);
  const total = allTasks.length;
  const done = allTasks.filter((task) => task.done).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  elements.progressLabel.textContent = `${done} von ${total} erledigt`;
  elements.progressBar.style.width = `${percent}%`;
}

function cleanupTrash() {
  const now = Date.now();
  state.trash = Array.isArray(state.trash) ? state.trash : [];
  state.trash = state.trash.filter((trashItem) => new Date(trashItem.purgeAt).getTime() > now);
}

function openDeleteDialog(taskId) {
  const activeList = getActiveList();
  const task = activeList.tasks.find((entry) => entry.id === taskId);
  if (!task) {
    return;
  }

  pendingDelete = { listId: activeList.id, taskId };
  elements.deleteTaskTitle.textContent = task.title;

  if (typeof elements.deleteDialog.showModal === "function") {
    elements.deleteDialog.showModal();
  } else if (window.confirm("Möchtest du diese Aufgabe wirklich löschen?")) {
    movePendingDeleteToTrash();
  }
}

function closeDeleteDialog() {
  pendingDelete = null;

  if (elements.deleteDialog.open) {
    elements.deleteDialog.close();
  }
}

function movePendingDeleteToTrash() {
  if (!pendingDelete) {
    return;
  }

  const list = state.lists.find((entry) => entry.id === pendingDelete.listId);
  if (!list) {
    closeDeleteDialog();
    return;
  }

  const task = list.tasks.find((entry) => entry.id === pendingDelete.taskId);
  if (!task) {
    closeDeleteDialog();
    return;
  }

  moveTaskToTrash(list, task);
  list.tasks = list.tasks.filter((entry) => entry.id !== task.id);
  closeDeleteDialog();
  render();
}

function moveTaskToTrash(list, task) {
  const deletedAt = new Date();
  const purgeAt = new Date(deletedAt.getTime() + trashRetentionMs);

  state.trash.unshift({
    id: createId("trash"),
    listId: list.id,
    listName: list.name,
    deletedAt: deletedAt.toISOString(),
    purgeAt: purgeAt.toISOString(),
    task: { ...task }
  });
}

function restoreTrashItem(trashId) {
  const trashItem = state.trash.find((entry) => entry.id === trashId);
  if (!trashItem) {
    return;
  }

  let list = state.lists.find((entry) => entry.id === trashItem.listId);
  if (!list) {
    list = state.lists[0];
  }

  list.tasks.unshift({ ...trashItem.task });
  state.activeListId = list.id;
  state.trash = state.trash.filter((entry) => entry.id !== trashId);
  render();
}

function renameActiveList() {
  const activeList = getActiveList();
  const name = window.prompt("Neuer Name der Checkliste:", activeList.name);
  if (!name) {
    return;
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    return;
  }

  const oldName = activeList.name;
  activeList.name = trimmedName;
  state.trash.forEach((trashItem) => {
    if (trashItem.listId === activeList.id && trashItem.listName === oldName) {
      trashItem.listName = trimmedName;
    }
  });
  render();
}

function deleteActiveList() {
  const activeList = getActiveList();
  if (state.lists.length <= 1) {
    window.alert("Die letzte Checkliste kann nicht gelöscht werden.");
    return;
  }

  const taskCount = activeList.tasks.length;
  const message = taskCount === 0
    ? `Möchtest du die Checkliste "${activeList.name}" wirklich löschen?`
    : `Möchtest du die Checkliste "${activeList.name}" wirklich löschen? Die ${taskCount} Aufgaben werden in den Papierkorb verschoben.`;

  if (!window.confirm(message)) {
    return;
  }

  activeList.tasks.forEach((task) => {
    moveTaskToTrash(activeList, task);
  });

  state.lists = state.lists.filter((list) => list.id !== activeList.id);
  state.activeListId = state.lists[0].id;
  render();
}

function setOpenForm(formName) {
  openForm = openForm === formName ? null : formName;

  const taskIsOpen = openForm === "task";
  const listIsOpen = openForm === "list";

  elements.inputPanel.hidden = !openForm;
  elements.taskForm.hidden = !taskIsOpen;
  elements.listForm.hidden = !listIsOpen;
  elements.openTaskForm.classList.toggle("active", taskIsOpen);
  elements.openListForm.classList.toggle("active", listIsOpen);
  elements.openTaskForm.setAttribute("aria-expanded", String(taskIsOpen));
  elements.openListForm.setAttribute("aria-expanded", String(listIsOpen));

  if (taskIsOpen) {
    elements.taskInput.focus();
  }

  if (listIsOpen) {
    elements.listInput.focus();
  }
}

elements.openTaskForm.addEventListener("click", () => {
  setOpenForm("task");
});

elements.openListForm.addEventListener("click", () => {
  setOpenForm("list");
});

elements.archiveToggle.addEventListener("click", () => {
  archiveOpen = !archiveOpen;
  render();
});

elements.archiveFilter.addEventListener("change", () => {
  archiveOpen = true;
  render();
});

elements.archiveSort.addEventListener("change", () => {
  archiveOpen = true;
  render();
});

elements.renameList.addEventListener("click", () => {
  renameActiveList();
});

elements.deleteList.addEventListener("click", () => {
  deleteActiveList();
});

elements.trashToggle.addEventListener("click", () => {
  trashOpen = !trashOpen;
  render();
});

elements.cancelDelete.addEventListener("click", () => {
  closeDeleteDialog();
});

elements.confirmDelete.addEventListener("click", () => {
  movePendingDeleteToTrash();
});

elements.deleteDialog.addEventListener("cancel", () => {
  pendingDelete = null;
});

elements.taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = elements.taskInput.value.trim();
  if (!title) {
    return;
  }

  const selectedList = state.lists.find((list) => list.id === elements.listSelect.value) || getActiveList();
  selectedList.tasks.unshift({ id: createId("task"), title, dueDate: elements.taskDueInput.value, done: false });
  state.activeListId = selectedList.id;
  elements.taskInput.value = "";
  elements.taskDueInput.value = "";
  elements.taskInput.focus();
  render();
});

elements.listForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = elements.listInput.value.trim();
  if (!name) {
    return;
  }

  const list = { id: createId("list"), name, tasks: [] };
  state.lists.push(list);
  state.activeListId = list.id;
  elements.listInput.value = "";
  render();
});

elements.lists.addEventListener("click", (event) => {
  const button = event.target.closest(".list-button");
  if (!button) {
    return;
  }

  state.activeListId = button.dataset.listId;
  render();
});

elements.tasks.addEventListener("change", (event) => {
  if (event.target.type !== "checkbox") {
    return;
  }

  const item = event.target.closest(".task-item");
  const task = getActiveList().tasks.find((entry) => entry.id === item.dataset.taskId);
  task.done = event.target.checked;
  task.completedAt = task.done ? new Date().toISOString() : null;
  render();
});

elements.archiveTasks.addEventListener("change", (event) => {
  if (event.target.type !== "checkbox") {
    return;
  }

  const item = event.target.closest(".task-item");
  const task = getActiveList().tasks.find((entry) => entry.id === item.dataset.taskId);
  task.done = event.target.checked;
  task.completedAt = task.done ? task.completedAt || new Date().toISOString() : null;
  render();
});

elements.tasks.addEventListener("click", (event) => {
  const button = event.target.closest(".delete-button");
  if (!button) {
    return;
  }

  const item = button.closest(".task-item");
  openDeleteDialog(item.dataset.taskId);
});

elements.archiveTasks.addEventListener("click", (event) => {
  const button = event.target.closest(".delete-button");
  if (!button) {
    return;
  }

  const item = button.closest(".task-item");
  openDeleteDialog(item.dataset.taskId);
});

elements.trashTasks.addEventListener("click", (event) => {
  const button = event.target.closest(".restore-button");
  if (!button) {
    return;
  }

  const item = button.closest(".trash-item");
  restoreTrashItem(item.dataset.trashId);
});

render();
