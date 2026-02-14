import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:8000"; // অথবা তোমার deployed URL
export const socket = io(SOCKET_URL, {
  transports: ["websocket"],
});