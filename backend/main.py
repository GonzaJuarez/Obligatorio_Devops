from fastapi import FastAPI, WebSocket
from fastapi.websockets import WebSocketDisconnect
from typing import Dict, List
import json
import os

app = FastAPI()

DATA_FILE = "clicks.json"

# ---------- Persistencia sencilla en archivo ----------
def load_data() -> Dict[str, int]:
    if not os.path.exists(DATA_FILE):
        return {}
    try:
        with open(DATA_FILE, "r") as f:
            content = f.read()
            if not content.strip():
                return {}
            return json.loads(content)
    except json.JSONDecodeError:
        return {}

def save_data(data: Dict[str, int]):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2)

# ---------- Gestión de conexiones ----------
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast_text(self, message: str):
        dead: List[WebSocket] = []
        for ws in self.active_connections:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

manager = ConnectionManager()

# ---------- Helpers de mensajes ----------
def msg_scores(scores: Dict[str, int]) -> str:
    return json.dumps({"type": "scores", "scores": scores})

def msg_click(name: str, total: int) -> str:
    return json.dumps({"type": "click", "name": name, "total": total})

# ---------- WebSocket ----------
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # (1) Al conectarse, devolver scoreboard completo
        scores = load_data()
        await websocket.send_text(msg_scores(scores))

        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue

            # Esperamos { "type": "click", "name": "Player" }
            if data.get("type") == "click":
                name = (data.get("name") or "").strip()
                if not name:
                    continue

                # (2) Sumar SIEMPRE 1 por click
                scores = load_data()
                total = scores.get(name, 0) + 1
                scores[name] = total
                save_data(scores)

                # (3) Difundir a todos: el click puntual y el scoreboard actualizado
                await manager.broadcast_text(msg_click(name, total))
                await manager.broadcast_text(msg_scores(scores))

            # Si en el futuro querés más tipos, podés agregarlos acá

    except WebSocketDisconnect:
        manager.disconnect(websocket)

# ---------- Endpoint utilitario para testing ----------
@app.post("/reset")
async def reset_scores():
    save_data({})
    return {"status": "scores reset"}