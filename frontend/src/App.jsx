import { useEffect, useState, useRef } from "react";
import "./App.css";
import io from "socket.io-client";
import Editor from "@monaco-editor/react";
import {v4 as uuid} from 'uuid';

// Connect to server
const socket = io("http://localhost:5000");

const App = () => {
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("// start code here");
  const [copySuccess, setCopySuccess] = useState("");
  const [users, setUsers] = useState([]);
  const [typing, setTyping] = useState("");
  const [output, setOutput] = useState("");
  const [version, setVersion] = useState("*");

  const typingTimeoutRef = useRef(null);

  // Event listeners
  useEffect(() => {
    socket.on("userJoined", (users) => {
      setUsers(users);
    });

    socket.on("codeUpdate", (newCode) => {
      setCode(newCode);
    });

    socket.on("userTyping", (user) => {
      if (user) {
        setTyping(`${user.slice(0, 8)}... is typing`);
        setTimeout(() => setTyping(""), 2000);
      }
    });

    socket.on("languageUpdate", (newLanguage) => {
      setLanguage(newLanguage);
    });

    socket.on("codeResponse", (response) => {
      setOutput(response.run?.output || "Error during execution.");
    });

    return () => {
      socket.off("userJoined");
      socket.off("codeUpdate");
      socket.off("userTyping");
      socket.off("languageUpdate");
      socket.off("codeResponse");
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      socket.emit("leaveRoom");
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // const joinRoom = () => {
  //   if (roomId && userName) {
  //     socket.emit("join", { roomId, userName });
  //     setJoined(true);
  //   }
  // };
const joinRoom = () => {
  if (roomId && userName) {
    socket.emit("join", { roomId, userName });
    localStorage.setItem("roomId", roomId);
    localStorage.setItem("userName", userName);
    setJoined(true);
  }
};
useEffect(() => {
  const savedRoomId = localStorage.getItem("roomId");
  const savedUserName = localStorage.getItem("userName");

  if (savedRoomId && savedUserName) {
    setRoomId(savedRoomId);
    setUserName(savedUserName);
    socket.emit("join", { roomId: savedRoomId, userName: savedUserName });
    setJoined(true);
  }
}, []);

 const leaveRoom = () => {
  socket.emit("leaveRoom");
  localStorage.removeItem("roomId");
  localStorage.removeItem("userName");
  setJoined(false);
  setRoomId("");
  setUserName("");
  setCode("// start code here");
  setLanguage("javascript");
  setOutput("");
};


  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopySuccess("Copied!");
    setTimeout(() => setCopySuccess(""), 2000);
  };

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    socket.emit("codeChange", { roomId, code: newCode });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    socket.emit("typing", { roomId, userName });
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing", { roomId, userName: "" });
    }, 1500);
  };

  const handleLanguageChange = (e) => {
    const newLanguage = e.target.value;
    setLanguage(newLanguage);
    socket.emit("languageChange", { roomId, language: newLanguage });
  };

  const [userInput,setuserInput]=useState("")

  const runCode = () => {
    if (code.trim()) {
      socket.emit("compileCode", { code, roomId, language, version, input: userInput });
    } else {
      setOutput("Please write some code before running.");
    }
  };
  const createRoomid=()=>{
    const roomId=uuid()
    setRoomId(roomId)
  }

  if (!joined) {
    return (
      <div className="join-container">
        <div className="join-form">
          <h1>Join Code Room</h1>
          <input
            type="text"
            placeholder="Room Id"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <button onClick={createRoomid}>Create Id</button>
          <input
            type="text"
            placeholder="Your Name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
          />
          <button onClick={joinRoom}>Join Room</button>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-container">
      <div className="sidebar">
        <div className="room-info">
          <h2>Room code: {roomId}</h2>
          <button onClick={copyRoomId} className="copy-button">
            Copy Id
          </button>
          {copySuccess && <span className="copy-success">{copySuccess}</span>}
        </div>
        <h3>Users in Room:</h3>
        <ul>
          {users.map((user, index) => (
            <li key={index}>{user.slice(0, 8)}...</li>
          ))}
        </ul>
        <p className="typing-indicator">{typing}</p>

        <select
          className="language-selector"
          value={language}
          onChange={handleLanguageChange}
        >
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
          <option value="java">Java</option>
          <option value="cpp">C++</option>
        </select>

        <button className="leave-button" onClick={leaveRoom}>
          Leave Room
        </button>
      </div>

      <div className="editor-wrapper">
        <Editor
          height="60%"
          language={language === "cpp" ? "cpp" : language}
          value={code}
          onChange={handleCodeChange}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
          }}
        />
        <textarea className="input-console" value={userInput} onChange={e=>setuserInput(e.target.value)} placeholder="Enter input here..."/>
        <div className="button-output-wrapper">
          <button className="run-btn" onClick={runCode}>
            Run Code
          </button>
          <textarea
            className="output-console"
            value={output}
            readOnly
            placeholder="Output will appear here ..."
          />
        </div>
      </div>
    </div>
  );
};

export default App;
