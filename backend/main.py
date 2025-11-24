from fastapi import FastAPI, WebSocket
from fastapi.websockets import WebSocketDisconnect
from typing import Dict, List
import json
import os
import re
from prometheus_client import Counter, Gauge, generate_latest, CONTENT_TYPE_LATEST
from fastapi.responses import Response

app = FastAPI()

DATA_FILE = "/data/clicks.json"

total_clicks = Counter('burger_clicks_total', 'Total de clicks en hamburguesas', ['player'])
active_connections = Gauge('websocket_connections', 'Conexiones WebSocket activas')
current_scores = Gauge('player_score', 'Score actual de cada jugador', ['player'])

def load_data() -> Dict[str, int]:
    if not os.path.exists(DATA_FILE):
        return {}
    try:
        with open(DATA_FILE, "r") as f:
            content = f.read()
            if not content.strip():
                return {}
            data = json.loads(content)
            if not isinstance(data, dict):
                return {}
            if not all(isinstance(k, str) and isinstance(v, int) for k, v in data.items()):
                return {}
            return data
    except json.JSONDecodeError:
        return {}

def save_data(data: Dict[str, int]):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2)

# ---------- Gestión de conexiones ----------
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket, origin: str = None):
        allowed_origins = os.getenv('ALLOWED_ORIGINS', 'http://localhost:4200,http://localhost:3000').split(',')
        
        # Permitir cualquier origen localhost/127.0.0.1 en desarrollo
        if origin:
            from urllib.parse import urlparse
            parsed = urlparse(origin)
            if parsed.hostname not in ['localhost', '127.0.0.1', '192.168.49.2'] and origin not in allowed_origins:
                await websocket.close(code=1008, reason="Origin not allowed")
                return False
        
        await websocket.accept()
        self.active_connections.append(websocket)
        active_connections.set(len(self.active_connections))
        return True

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        active_connections.set(len(self.active_connections))

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
    origin = websocket.headers.get('origin')
    connected = await manager.connect(websocket, origin)
    if not connected:
        return
    
    try:
        scores = load_data()
        await websocket.send_text(msg_scores(scores))

        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue

            if not isinstance(data, dict) or 'type' not in data:
                continue

            if data.get("type") == "click":
                name = (data.get("name") or "").strip()
                
                if not name or len(name) > 50:
                    continue
                if not re.match(r'^[a-zA-Z0-9\s\-_]+$', name):
                    continue

                scores = load_data()
                total = scores.get(name, 0) + 1
                scores[name] = total
                save_data(scores)

                total_clicks.labels(player=name).inc()
                current_scores.labels(player=name).set(total)

                await manager.broadcast_text(msg_click(name, total))
                await manager.broadcast_text(msg_scores(scores))


    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.post("/reset")
async def reset_scores():
    save_data({})
    return {"status": "scores reset"}

@app.get("/metrics")
async def metrics():
    """Endpoint para Prometheus"""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)