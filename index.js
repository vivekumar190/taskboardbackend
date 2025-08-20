// server.js
const express = require("express");
const http = require("http");
const app = express();
const server = http.createServer(app);
const socketIO = require("socket.io");

const io = socketIO(server, {
  cors: { origin: "*" },
});
// this logic taken from frontend redux toolkit implmentation
const boardState = {
  columns: [
    { id: "c1", title: "To Do", taskIds: [] },
    { id: "c2", title: "In Progress", taskIds: [] },
    { id: "c3", title: "Done", taskIds: [] }
  ],
  tasks: {},
  loading: false
};


function logAndEmitState(socket, message) {
  console.log(message, JSON.stringify(boardState, null, 2));
  socket.emit("board-state", boardState);
  io.emit("board-state", boardState);
}

// Store connected users and their pointer positions
const connectedUsers = {};

io.on("connection", function (socket) {
  console.log("New socket connection:", socket.id);
  
  // Add new user with pointerxy to connected users
  connectedUsers[socket.id] = {
    id: socket.id,
    pointer: { x: 0, y: 0 }
  };
  
  // Emitted current users to all clients
  io.emit("users-update", Object.values(connectedUsers));
  
  // Send initial board state to new client
  socket.emit("board-state", boardState);
  
  // Handle pointer movement
  socket.on("pointer-move", ({ x, y }) => {
    if (connectedUsers[socket.id]) {
      connectedUsers[socket.id].pointer = { x, y };
      // Broadcast pointer position to all other clients
      socket.broadcast.emit("pointer-update", {
        userId: socket.id,
        pointer: { x, y }
      });
    }
  });

  socket.on("add-column", ({ title }) => {
    const id = `col-${Date.now()}`;
    const newColumn = { id, title, taskIds: [] };
    boardState.columns.push(newColumn);
    io.emit("board-state", boardState);
  });

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
    const sourceColumn = boardState.columns.find(column =>  column.id === source.droppableId);
    const destColumn = boardState.columns.find(column =>column.id === destination.droppableId);   
       sourceColumn.taskIds.splice(source.index, 1);
      destColumn.taskIds.splice(destination.index, 0, taskId);
      io.emit("board-state", boardState);
  });
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    // Remove user from connected users
    delete connectedUsers[socket.id];
    // Notify other clients about user disconnection
    io.emit("users-update", Object.values(connectedUsers));
  });
});

server.listen(4000, function () {
  console.log("Server running on port 4000");
});
