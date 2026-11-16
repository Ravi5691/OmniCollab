import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"
import { YSocketIO } from "y-socket.io/dist/server"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const publicDir = path.join(__dirname, "public")

app.use(express.static(publicDir))

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
})

const ySocketIO = new YSocketIO(io)
ySocketIO.initialize()

ySocketIO.on("document-loaded", (doc) => {
  console.log(`[Yjs] Document loaded: ${doc.name}`)
})

ySocketIO.on("all-document-connections-closed", (doc) => {
  console.log(`[Yjs] All connections closed for document: ${doc.name}`)
})

// Health check route
app.get("/health", (req, res) => {
  res.status(200).json({
    message: "Server is healthy",
    success: true,
  })
})

// Fallback to index.html for SPA routing
app.use((req, res, next) => {
  if (req.path.startsWith("/socket.io") || req.path === "/health") {
    return next()
  }
  if (req.method === "GET") {
    return res.sendFile(path.join(publicDir, "index.html"))
  }
  next()
})

const PORT = process.env.PORT || 3000
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})