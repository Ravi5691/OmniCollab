import { spawn } from "child_process"
import { SocketIOProvider } from "./backend/node_modules/y-socket.io/dist/index.mjs"
import * as Y from "./backend/node_modules/yjs/dist/yjs.mjs"

console.log("=== Starting End-to-End Verification Test ===")

// 1. Start backend server
const serverProcess = spawn("node", ["backend/server.js"], {
  env: { ...process.env, PORT: "3000" },
  stdio: ["ignore", "pipe", "pipe"],
})

let serverStarted = false
serverProcess.stdout.on("data", (data) => {
  const msg = data.toString()
  process.stdout.write(`[Server Log] ${msg}`)
  if (msg.includes("Server is running on port 3000")) {
    serverStarted = true
  }
})
serverProcess.stderr.on("data", (data) => {
  process.stderr.write(`[Server Err] ${data.toString()}`)
})

// Wait for server to start
let retries = 0
while (!serverStarted && retries < 20) {
  await new Promise((r) => setTimeout(r, 250))
  retries++
}

if (!serverStarted) {
  serverProcess.kill()
  throw new Error("Server failed to start within timeout")
}

console.log("\n--- Step 1: Testing HTTP Endpoints ---")
// Test /health
const healthRes = await fetch("http://localhost:3000/health")
const healthJson = await healthRes.json()
console.log("Health check status:", healthRes.status, "Body:", healthJson)
if (!healthJson.success) throw new Error("Health check failed")

// Test /
const indexRes = await fetch("http://localhost:3000/")
const indexHtml = await indexRes.text()
console.log("Index HTML status:", indexRes.status, "Contains root:", indexHtml.includes('id="root"'))
if (!indexHtml.includes('id="root"')) throw new Error("Frontend index.html failed to serve")

console.log("\n--- Step 2: Client 1 (Alice) Joining ---")
const docAlice = new Y.Doc()
const providerAlice = new SocketIOProvider("http://localhost:3000", "monaco", docAlice, {
  autoConnect: true,
})
const textAlice = docAlice.getText("monaco")

providerAlice.awareness.setLocalStateField("user", {
  username: "Alice",
  color: "#38bdf8",
})

await new Promise((r) => setTimeout(r, 800))

textAlice.insert(0, "function hello() {\n  return 'Hello from Alice';\n}\n")
console.log("Alice inserted initial code:\n" + textAlice.toString())

console.log("\n--- Step 3: Client 2 (Bob) Joining ---")
const docBob = new Y.Doc()
const providerBob = new SocketIOProvider("http://localhost:3000", "monaco", docBob, {
  autoConnect: true,
})
const textBob = docBob.getText("monaco")

providerBob.awareness.setLocalStateField("user", {
  username: "Bob",
  color: "#f472b6",
})

// Wait for sync
await new Promise((r) => setTimeout(r, 1200))

console.log("Bob received synced text:\n" + textBob.toString())
if (textBob.toString() !== textAlice.toString()) {
  throw new Error("Sync failed! Bob's text doesn't match Alice's text.")
}

const aliceUsers = Array.from(providerAlice.awareness.getStates().values()).map((s) => s.user?.username).filter(Boolean)
const bobUsers = Array.from(providerBob.awareness.getStates().values()).map((s) => s.user?.username).filter(Boolean)
console.log("Alice sees users:", aliceUsers)
console.log("Bob sees users:", bobUsers)

if (!aliceUsers.includes("Bob") || !bobUsers.includes("Alice")) {
  throw new Error("Awareness sync failed! Users do not see each other.")
}

console.log("\n--- Step 4: Bob making real-time edits ---")
textBob.insert(textBob.length, "// Bob appended this line\n")

await new Promise((r) => setTimeout(r, 800))

console.log("Alice text after Bob's edit:\n" + textAlice.toString())
if (!textAlice.toString().includes("// Bob appended this line")) {
  throw new Error("Bidirectional sync failed! Alice did not receive Bob's edit.")
}

console.log("\n--- Step 5: Bob leaving ---")
providerBob.awareness.setLocalStateField("user", null)
providerBob.destroy()

await new Promise((r) => setTimeout(r, 800))

const remainingUsers = Array.from(providerAlice.awareness.getStates().values()).map((s) => s.user?.username).filter(Boolean)
console.log("Alice sees remaining users after Bob leaves:", remainingUsers)
if (remainingUsers.includes("Bob")) {
  throw new Error("User leave cleanup failed! Bob still in user list.")
}

providerAlice.destroy()
serverProcess.kill()

console.log("\n=== ALL REAL-TIME COLLABORATION TESTS PASSED PERFECTLY! ===")
