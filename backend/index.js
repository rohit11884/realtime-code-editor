import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import axios from "axios";

const app = express();
const server = http.createServer(app);

const url = `https://realtime-code-editor-etn1.onrender.com`;
const interval = 30000;

function reloadWebsite() {
  axios
    .get(url)
    .then((response) => {
      console.log("website reloded");
    })
    .catch((error) => {
      console.error(`Error : ${error.message}`);
    });
}

setInterval(reloadWebsite, interval);

const io = new Server(server, { cors: { origin: "*" } });

const rooms = new Map();

const defaultSnippets = {
  javascript: "// Write your JavaScript code here",
  python: "# Write your Python code here",
  java: "// Write your Java code here",
  cpp: "// Write your C++ code here",
  c: "// Write your C code here",
  typescript: "// Write your TypeScript code here",
  go: "// Write your Go code here",
  ruby: "# Write your Ruby code here",
  rust: "// Write your Rust code here",
};

io.on("connection", (socket) => {
  console.log("User Connected", socket.id);

  let currentRoom = null;
  let currentUser = null;

  socket.on("join", ({ roomId, userName }) => {
    if (currentRoom) {
      socket.leave(currentRoom);
      rooms.get(currentRoom)?.users.delete(currentUser);
      io.to(currentRoom).emit("userJoined", Array.from(rooms.get(currentRoom).users));
    }

    currentRoom = roomId;
    currentUser = userName;
    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        users: new Set(),
        code: defaultSnippets["java"], 
        language: "java",
        version: "latest",
        output: "",
      });
    }

    rooms.get(roomId).users.add(userName);

    socket.emit("codeUpdate", rooms.get(roomId).code);
    socket.emit("languageUpdate", rooms.get(roomId).language);
    io.to(roomId).emit("userJoined", Array.from(rooms.get(roomId).users));
  });

  socket.on("codeChange", ({ roomId, code }) => {
    if (rooms.has(roomId)) {
      rooms.get(roomId).code = code;
      socket.to(roomId).emit("codeUpdate", code);
    }
  });

  socket.on("languageChange", ({ roomId, language }) => {
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.language = language;
      room.code = defaultSnippets[language] || "";
      io.to(roomId).emit("languageUpdate", language);
      io.to(roomId).emit("codeUpdate", room.code);
    }
  });

  socket.on("compileCode", async ({ code, roomId, language, version, input }) => {
    if (rooms.has(roomId)) {
      try {
        const response = await axios.post("https://emkc.org/api/v2/piston/execute", {
          language,
          version,
          files: [{ content: code }],
          stdin: input,
        });

        rooms.get(roomId).output = response.data.run.output;
        io.to(roomId).emit("codeResponse", response.data);
      } catch (err) {
        io.to(roomId).emit("codeResponse", { run: { output: "Error during compilation." } });
      }
    }
  });

  socket.on("typing", ({ roomId, userName }) => {
    socket.to(roomId).emit("userTyping", userName);
  });

  socket.on("leaveRoom", () => {
    if (currentRoom && currentUser) {
      const room = rooms.get(currentRoom);
      if (room) {
        room.users.delete(currentUser);
        io.to(currentRoom).emit("userJoined", Array.from(room.users));
      }
      socket.leave(currentRoom);
      currentRoom = null;
      currentUser = null;
    }
  });

  socket.on("disconnect", () => {
    if (currentRoom && currentUser) {
      const room = rooms.get(currentRoom);
      if (room) {
        room.users.delete(currentUser);
        io.to(currentRoom).emit("userJoined", Array.from(room.users));
      }
    }
    console.log("User Disconnected");
  });
});

const port = process.env.PORT || 5000;
const __dirname = path.resolve();

app.use(express.static(path.join(__dirname, "/frontend/dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "dist", "index.html"));
});

server.listen(port, () => {
  console.log(`Server is working on port ${port}`);
});
