// server.js
const express = require("express");
const http = require("http");
const app = express();
const server = http.createServer(app);
const socketIO = require("socket.io");

const io = socketIO(server, {
  cors: { origin: "*" },
});

// Initialize board state with the same structure as frontend
const boardState = {
  columns: [
    { id: "c1", title: "To Do", taskIds: [] },
    { id: "c2", title: "In Progress", taskIds: [] },
    { id: "c3", title: "Done", taskIds: [] }
  ],
  tasks: {},
  loading: false
};

// Debug helper
function logAndEmitState(socket, message) {
  console.log(message, JSON.stringify(boardState, null, 2));
  socket.emit("board-state", boardState);
  io.emit("board-state", boardState);
}

io.on("connection", function (socket) {
  console.log("New socket connection:", socket.id);

  // Send initial state to newly connected client
  socket.emit("board-state", boardState);

  // Handle adding a new column
  socket.on("add-column", ({ title }) => {
    const id = `col-${Date.now()}`;
    const newColumn = { id, title, taskIds: [] };
    boardState.columns.push(newColumn);
    io.emit("board-state", boardState);
  });

  // Handle adding a new task
  socket.on("add-task", ({ columnId, title }) => {
    const id = `task-${Date.now()}`;
    boardState.tasks[id] = { id, title };
    const column = boardState.columns.find(col => col.id === columnId);
    if (column) {
      column.taskIds.push(id);
    }
    logAndEmitState(socket, "Task added:");
  });

  // Handle updating a task
  socket.on("update-task", ({ taskId, title }) => {
    const task = boardState.tasks[taskId];
    if (task) {
      task.title = title;
      io.emit("board-state", boardState);
    }
  });

  // Handle deleting a task
  socket.on("delete-task", ({ taskId }) => {
    const column = boardState.columns.find(col => col.taskIds.includes(taskId));
    if (column) {
      const index = column.taskIds.indexOf(taskId);
      if (index !== -1) {
        column.taskIds.splice(index, 1);
      }
    }
    delete boardState.tasks[taskId];
    io.emit("board-state", boardState);
  });

  // Handle moving a task
  socket.on("move-task", ({ source, destination, taskId }) => {
    const sourceColumn = boardState.columns.find(col => col.id === source.droppableId);
    const destColumn = boardState.columns.find(col => col.id === destination.droppableId);
    
    if (sourceColumn && destColumn) {
      sourceColumn.taskIds.splice(source.index, 1);
      destColumn.taskIds.splice(destination.index, 0, taskId);
      io.emit("board-state", boardState);
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

server.listen(4000, function () {
  console.log("Server running on port 4000");
});
