let tasks = [];
let users = [];

window.onclick =  (event) =>{
if (event.target.id === "overlay") {
        closeOverlay();
    }
}

/**
 * Loads all tasks from Firebase and updates the global tasks array
 */
async function loadTasksFromFirebase() {
  const response = await fetch(`${BASE_URL}tasks.json`);
  const data = await response.json();

  tasks = [];
  for (const [id, task] of Object.entries(data || {})) {
    if (!task || typeof task !== "object") continue;
    task.id = id;
    tasks.push(task);
  }

  renderCurrentTasks();
}

/**
 * Initializes the application by loading users and tasks from Firebase
 */
async function init() {
  await loadUsersFromFirebase();
  await loadTasksFromFirebase();
  
let index = 0; // Beispiel: erster User
let userColor = users[index]?.color;
  showCurrentBoard();
}

/**
 * Renders all tasks in their respective status columns on the Kanban board
 * - De-dups assignees
 * - Caps visible avatars at 4 and shows a +N counter
 */
function renderCurrentTasks() {
  const statusContainers = proofStatus();
  const statusCounts = proofStatusCounts();

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const taskData = prepareTaskForTemplate(task);

    const assignedUsersHTML = buildAssignedUsersHTML(task.assignedTo);

    const container = statusContainers[task.status];
    if (container) {
      container.innerHTML += getKanbanTemplate(taskData, assignedUsersHTML, i);
      statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
    }

    setTimeout(() => {
      proofSubtasks(task, i);
    }, 0);
  }

  showStatusPlaceholder(statusCounts, statusContainers);

  // Attach events after DOM paint (once)
  setTimeout(() => {
    attachTaskEventHandlers();
  }, 0);
}

/**
 * Gets status container elements and clears their content
 * @returns {Object} Object containing status container elements
 */
function proofStatus() {
  const statusContainers = {
    toDo: document.getElementById("toDoContainer"),
    inProgress: document.getElementById("inProgressContainer"),
    awaitFeedback: document.getElementById("awaitFeedbackContainer"),
    done: document.getElementById("doneContainer"),
  };

  Object.values(statusContainers).forEach(
    (container) => (container.innerHTML = "")
  );
  return statusContainers;
}

/**
 * Initializes status count counters for each task status
 * @returns {Object} Object with count properties for each status
 */
function proofStatusCounts() {
  const statusCounts = {
    toDo: 0,
    inProgress: 0,
    awaitFeedback: 0,
    done: 0,
  };

  return statusCounts;
}

/**
 * Displays subtask progress for a task if it has subtasks
 * @param {Object} task - The task object containing subtasks
 * @param {number} index - The index of the task for DOM targeting
 */
function proofSubtasks(task, index) {
  if (!task.subTasks || task.subTasks.length === 0) return;

  const subtaskContainer = document.getElementById(
    `subtask_container_${index}`
  );

  if (subtaskContainer) {
    // Fortschritt berechnen (hier: 0 erledigt, kann angepasst werden)
    const total = task.subTasks.length;
    const done = task.subTasks.filter((t) => t.done === true).length;
    const percent = Math.round((done / total) * 100) || 0;

    subtaskContainer.innerHTML = `
            <div class="progress_container">
                <div class="progress_bar_bg">
                    <div class="progress-bar" style="width: ${percent}%;"></div>
                </div>
                <p class="subtasks_progress">${done}/${total} Subtasks</p>
            </div>
        `;
  }
}

/**
 * Shows placeholder text for empty status columns
 * @param {Object} statusCounts - Object containing task counts for each status
 * @param {Object} statusContainers - Object containing DOM container elements
 */
function showStatusPlaceholder(statusCounts, statusContainers) {
  for (const [status, count] of Object.entries(statusCounts)) {
    if (count === 0) {
      const container = statusContainers[status];
      container.innerHTML = `<div class="no_task_placeholder">No tasks</div>`;
    }
  }
}

/**
 * Shows subtask progress container (legacy function)
 */
function showSubtasks() {
  container.innerHTML = `
                        <div class="progress_container">
                            <div class="progress-bar" style="width: 50%;"></div>
                            <p class="subtasks_progress">1/2 Subtasks</p>
                        </div>
`;
}

/**
 * Attaches click and drag event handlers to all task containers
 * - Uses the same avatar builder as the board card so the overlay matches
 */
function attachTaskEventHandlers() {
  const containers = document.querySelectorAll(".task_container");

  containers.forEach((container) => {
    const id = container.dataset.taskId;
    const index = parseInt(container.dataset.taskIndex, 10);
    const task = tasks.find((t) => t.id == id);
    if (!task) return;

    const taskData = prepareTaskForTemplate(task);
    // Build avatars with de-dup + +N overflow (use raw names)
    const assignedUsersHTML = buildAssignedUsersHTML(task.assignedTo);

    // Open details overlay on click
    container.addEventListener("click", () => {
      openTask(taskData, assignedUsersHTML, index);
    });

    // Support drag start (template also has ondragstart; keeping for robustness)
    container.addEventListener("dragstart", () => {
      startDragging(task.id);
    });
  });
}

/**
 * Prepares task data for template rendering with formatted properties
 * @param {Object} task - Raw task object from Firebase
 * @returns {Object} Formatted task object ready for template rendering
 */
function prepareTaskForTemplate(task) {
  const uniqueAssigned = [...new Set(task.assignedTo || [])];

  const assignedTo = uniqueAssigned.map((name) => {
    const user = Object.values(Contacts).find((u) => u.name === name);
    const initials = name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();

    let color = "#2A3647";
    if (user) {
      color = getColor(initials); // uses add_task.js palette
    }
    return { initials, color };
  });

  return {
    id: task.id,
    category: task.category || "General",
    categoryClass: (task.category || "general").toLowerCase().replace(/\s/g, "_"),
    dueDate: task.dueDate,
    title: task.title || task.task || "Untitled",
    description: task.description || "",
    assignedTo,
    priority: (task.priority || "low").toLowerCase(),
    subTasks: task.subTasks || [],
  };
}

/**
 * Displays the current board by rendering all tasks
 */
function showCurrentBoard() {
  renderCurrentTasks();
}

/**
 * Loads user data from Firebase
 */
async function loadUsersFromFirebase() {
  const response = await fetch(`${BASE_URL}user.json`);
  const data = await response.json();
  users = data || [];
}

  /**
   * A live HTMLCollection of all elements with the class "task_container hover".
   * Used to access and manipulate all task container elements currently present in the DOM.
   * 
   * @type {HTMLCollectionOf<Element>}
   */
window.addEventListener("DOMContentLoaded", function () {
  var searchInput = document.getElementsByClassName("search_input")[0];
  var taskElements = document.getElementsByClassName("task_container hover"); 
  searchInput.addEventListener("input", function () {
    var searchTerm = searchInput.value.toLowerCase();
    for (var i = 0; i < taskElements.length; i++) {
      var task = taskElements[i];
      var titleElements = task.getElementsByClassName("task_title");
      var detailElements = task.getElementsByClassName("task_details");
      var title = titleElements.length
        ? titleElements[0].textContent.toLowerCase()
        : "";
      var details = detailElements.length
        ? detailElements[0].textContent.toLowerCase()
        : "";
      var match = title.includes(searchTerm) || details.includes(searchTerm);
      task.style.display = match ? "block" : "none";
    }
    var statusIds = ["toDoContainer", "inProgressContainer", "awaitFeedbackContainer", "doneContainer"];
    showSearchPlaceholders(statusIds, "task_container");
  });
});

/**
 * Displays a placeholder message ("No tasks") in containers when no visible tasks are present.
 * Removes any existing placeholder before adding a new one.
 *
 * @param {string[]} statusIds - Array of container element IDs to check for tasks.
 * @param {string} taskClass - The class name used to identify task elements within each container.
 */
function showSearchPlaceholders(statusIds, taskClass) {
  statusIds.forEach(function (id) {
    var container = document.getElementById(id);
    if (!container) return;
    var visibleTasks = Array.from(container.getElementsByClassName(taskClass))
      .filter(function (el) { return el.style.display !== "none"; });
    var oldPlaceholder = container.querySelector(".no_task_placeholder");
    if (oldPlaceholder) oldPlaceholder.remove();
    if (visibleTasks.length === 0) {
      var placeholder = document.createElement("div");
      placeholder.className = "no_task_placeholder";
      placeholder.textContent = "No tasks";
      container.appendChild(placeholder);
    }
  });
}

/**
 * Reindexes all tasks in Firebase with sequential IDs
 */
async function reindexTasksInFirebase() {
  const newTasks = {};

  for (let i = 0; i < tasks.length; i++) {
    const task = { ...tasks[i] };
    task.id = i;
    newTasks[i] = task;
  }

  await fetch(`${BASE_URL}tasks.json`, {
    method: "PUT",
    body: JSON.stringify(newTasks),
  });

  await loadTasksFromFirebase();
}

/**
 * Deletes a task from the board after user confirmation
 * @param {string} taskId - ID of the task to delete
 */
async function deleteTaskFromBoardPopup(taskId) {
  const confirmDelete = await showConfirmation(
    "Are you sure you want to delete this task?"
  );
  if (!confirmDelete) return;

  try {
    tasks = tasks.filter((t) => t.id != taskId);
    await reindexTasksInFirebase();
    closeOverlay();
  } catch (error) {
    showToast("Error deleting task", "./assets/icons/error.png");
    console.error("Delete error:", error);
  }
}

/**
 * Closes any open overlay when the Escape key is pressed
 */
document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeOverlay();
  }
});

/**
 * Generates HTML markup for displaying assigned user avatars in a task card.
 * - Removes duplicate assignees.
 * - Shows up to a maximum number of avatars (default: 4).
 * - If there are more assignees, displays a "+N" counter for overflow.
 *
 * @param {string[]} assignedTo - Array of user names assigned to the task.
 * @param {number} [maxVisible=4] - Maximum number of avatars to display before showing a counter.
 * @returns {string} HTML string containing user avatar circles and an optional overflow counter.
 *
 * @example
 * // Returns HTML for up to 4 user avatars and a "+2" counter if there are 6 assignees
 * buildAssignedUsersHTML(['Alice Smith', 'Bob Jones', 'Carol Lee', 'Dan Wu', 'Eve Kim', 'Frank Li']);
 */
function buildAssignedUsersHTML(assignedTo, maxVisible = 4) {
  const uniq = [...new Set(assignedTo || [])];
  const visible = uniq.slice(0, maxVisible);
  const extra = Math.max(0, uniq.length - maxVisible);

  const avatars = visible.map(name => {
    const initials = name.split(" ").map(n => n[0]).join("").toUpperCase();
    const color = getColor(initials[0]); // from add_task.js
    return `<div class="user_initials_circle" style="background-color:${color};color:white;">${initials}</div>`;
  }).join("");

  const counter = extra > 0
    ? `<div class="user_initials_circle" style="background-color:#2A3647;color:white;">+${extra}</div>`
    : "";

  return avatars + counter;
}