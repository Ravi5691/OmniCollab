import "./App.css"
import { Editor } from "@monaco-editor/react"
import { MonacoBinding } from "y-monaco"
import { useRef, useMemo, useState, useEffect, useCallback } from "react"
import * as Y from "yjs"
import { SocketIOProvider } from "y-socket.io"

const USER_COLORS = [
  "#38bdf8", // Sky blue
  "#f472b6", // Pink
  "#4ade80", // Green
  "#facc15", // Yellow
  "#fb923c", // Orange
  "#a78bfa", // Purple
  "#34d399", // Emerald
  "#f87171", // Red
]

function getUserColor(clientID) {
  const index = Math.abs(clientID) % USER_COLORS.length
  return USER_COLORS[index]
}

function App() {
  const [username, setUsername] = useState(() => {
    return new URLSearchParams(window.location.search).get("username") || ""
  })
  const [nameInput, setNameInput] = useState("")
  const [users, setUsers] = useState([])
  const [status, setStatus] = useState("disconnected")
  const [editor, setEditor] = useState(null)
  const [provider, setProvider] = useState(null)

  const ydoc = useMemo(() => new Y.Doc(), [])
  const yText = useMemo(() => ydoc.getText("monaco"), [ydoc])

  // Handle Join Form Submission
  const handleJoin = (e) => {
    e.preventDefault()
    const trimmed = nameInput.trim()
    if (!trimmed) return
    setUsername(trimmed)
    const url = new URL(window.location.href)
    url.searchParams.set("username", trimmed)
    window.history.pushState({}, "", url.toString())
  }

  // Handle Leave / Switch User
  const handleLeave = () => {
    const url = new URL(window.location.href)
    url.searchParams.delete("username")
    window.history.pushState({}, "", url.toString())
    setUsername("")
  }

  // Initialize SocketIOProvider when username is present
  useEffect(() => {
    if (!username) {
      setProvider(null)
      setUsers([])
      setStatus("disconnected")
      return
    }

    const serverUrl = import.meta.env.VITE_BACKEND_URL || window.location.origin
    const userColor = getUserColor(ydoc.clientID)

    const socketProvider = new SocketIOProvider(serverUrl, "monaco", ydoc, {
      autoConnect: true,
    })

    // Set awareness local state for user info
    socketProvider.awareness.setLocalStateField("user", {
      username,
      color: userColor,
    })

    const handleStatus = ({ status: newStatus }) => {
      setStatus(newStatus)
    }

    const updateUsers = () => {
      const states = socketProvider.awareness.getStates()
      const activeUsers = []
      states.forEach((state, clientID) => {
        if (state.user && state.user.username) {
          activeUsers.push({
            clientID,
            username: state.user.username,
            color: state.user.color || getUserColor(clientID),
            isSelf: clientID === ydoc.clientID,
          })
        }
      })
      setUsers(activeUsers)
    }

    socketProvider.on("status", handleStatus)
    socketProvider.awareness.on("change", updateUsers)

    // Set initial template once synced if the document is completely empty
    socketProvider.once("sync", (isSynced) => {
      if (isSynced && yText.length === 0) {
        yText.insert(
          0,
          `// OmniCollab — Real-Time Collaborative Workspace\n// Room: monaco\n// Welcome, ${username}!\n\nfunction welcome() {\n  console.log("Real-time collaborative editing is active in OmniCollab!");\n}\n\nwelcome();\n`
        )
      }
    })

    const handleBeforeUnload = () => {
      socketProvider.awareness.setLocalStateField("user", null)
    }
    window.addEventListener("beforeunload", handleBeforeUnload)

    setProvider(socketProvider)
    updateUsers()

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      socketProvider.awareness.setLocalStateField("user", null)
      socketProvider.awareness.off("change", updateUsers)
      socketProvider.off("status", handleStatus)
      socketProvider.destroy()
      setProvider(null)
    }
  }, [username, ydoc, yText])

  // Bind Monaco Editor with Yjs and Awareness
  useEffect(() => {
    if (!editor || !provider) return

    const monacoModel = editor.getModel()
    if (!monacoModel) return

    const binding = new MonacoBinding(
      yText,
      monacoModel,
      new Set([editor]),
      provider.awareness
    )

    return () => {
      binding.destroy()
    }
  }, [editor, provider, yText])

  // Monaco Editor onMount handler
  const handleMount = useCallback((editorInstance) => {
    setEditor(editorInstance)
  }, [])

  // Login / Join screen
  if (!username) {
    return (
      <main className="h-screen w-full bg-neutral-950 flex flex-col justify-center items-center p-4 text-white">
        <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-8 shadow-2xl flex flex-col gap-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-7 h-7"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              OmniCollab
            </h1>
            <p className="text-sm text-neutral-400 mt-1">
              All-in-one real-time collaborative workspace
            </p>
          </div>

          <form onSubmit={handleJoin} className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="username-input"
                className="block text-xs font-medium text-neutral-400 mb-1.5"
              >
                Your Display Name
              </label>
              <input
                id="username-input"
                type="text"
                autoFocus
                placeholder="e.g. Alex, Maya"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-neutral-800/80 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={!nameInput.trim()}
              className="w-full py-3 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-neutral-950 transition-colors shadow-lg shadow-sky-500/20 cursor-pointer text-sm"
            >
              Join Coding Session
            </button>
          </form>

          <div className="text-center text-xs text-neutral-500">
            Powered by Yjs &amp; Socket.IO
          </div>
        </div>
      </main>
    )
  }

  // Active collaborative editor screen
  return (
    <div className="h-screen w-full bg-neutral-950 flex flex-col text-white overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="h-14 bg-neutral-900 border-b border-neutral-800 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-sm">
            &lt;/&gt;
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide text-neutral-200">
              OmniCollab
            </h1>
            <div className="text-xs text-neutral-400 flex items-center gap-2">
              <span>Room: <strong className="text-neutral-300">monaco</strong></span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    status === "connected"
                      ? "bg-emerald-400 animate-pulse"
                      : status === "connecting"
                      ? "bg-amber-400 animate-ping"
                      : "bg-rose-500"
                  }`}
                />
                <span className="capitalize">{status}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs bg-neutral-800/80 border border-neutral-700/60 rounded-lg px-3 py-1.5 text-neutral-300 flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: getUserColor(ydoc.clientID) }}
            />
            <span>Signed in as <strong className="text-white">{username}</strong></span>
          </div>
          <button
            onClick={handleLeave}
            className="text-xs px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer border border-neutral-700"
          >
            Leave
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden p-3 gap-3">
        {/* Left Sidebar: Active Collaborators */}
        <aside className="w-64 bg-neutral-900 border border-neutral-800 rounded-xl flex flex-col overflow-hidden shrink-0 shadow-lg">
          <div className="p-3.5 border-b border-neutral-800 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Collaborators
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 border border-neutral-700 text-sky-400 font-medium">
              {users.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {users.map((user) => (
              <div
                key={user.clientID}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-neutral-800/50 transition-colors"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-neutral-950 uppercase shadow-sm shrink-0"
                  style={{ backgroundColor: user.color }}
                >
                  {user.username.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-neutral-200 truncate">
                      {user.username}
                    </span>
                    {user.isSelf && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-400 font-medium">
                        You
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-neutral-500 flex items-center gap-1">
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: user.color }}
                    />
                    <span>Active</span>
                  </div>
                </div>
              </div>
            ))}

            {users.length === 0 && (
              <div className="p-4 text-center text-xs text-neutral-500">
                Waiting for connection...
              </div>
            )}
          </div>

          <div className="p-3 border-t border-neutral-800 bg-neutral-900/60 text-[11px] text-neutral-400">
            <p className="leading-relaxed">
              Open another browser window or share this link to code together in real-time.
            </p>
          </div>
        </aside>

        {/* Right Editor Area */}
        <main className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden flex flex-col shadow-lg">
          <div className="h-9 bg-neutral-900 border-b border-neutral-800 px-4 flex items-center text-xs text-neutral-400 font-mono">
            <span>workspace.js</span>
          </div>
          <div className="flex-1">
            <Editor
              height="100%"
              width="100%"
              defaultLanguage="javascript"
              theme="vs-dark"
              options={{
                fontSize: 14,
                lineHeight: 22,
                minimap: { enabled: true },
                automaticLayout: true,
                scrollBeyondLastLine: false,
                tabSize: 2,
                cursorBlinking: "smooth",
                smoothScrolling: true,
              }}
              onMount={handleMount}
            />
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
