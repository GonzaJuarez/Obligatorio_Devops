from fastapi import FastAPI, WebSocket
from fastapi.websockets import WebSocketDisconnect
from typing import Dict
import json
import os

app = FastAPI()

DATA_FILE = "clicks.json"


def load_data() -> Dict[str, int]:
    if not os.path.exists(DATA_FILE):
        return {}  # Devuelve un diccionario vacío si el archivo no existe

    try:
        with open(DATA_FILE, "r") as f:
            content = f.read()
            if not content.strip():  # Si el archivo está vacío
                return {}
            return json.loads(content)
    except json.JSONDecodeError:
        return {}  # Si hay error de decodificación, devuelve vacío


def save_data(data: Dict[str, int]):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2)  # indent=2 para formato legible


# Almacén para conexiones WebSocket activas
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)


manager = ConnectionManager()


# Endpoint WebSocket
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Enviar el estado actual al conectarse
        current_data = load_data()
        await websocket.send_text(json.dumps(current_data))

        while True:
            data = await websocket.receive_text()
            try:
                # Procesar los datos recibidos
                message = json.loads(data)
                name = message.get("name")
                clicks = message.get("clicks")

                if not name or clicks is None:
                    continue

                # Actualizar datos
                current_data = load_data()
                current_data[name] = current_data.get(name, 0) + clicks
                save_data(current_data)

                # Broadcast a todos los clientes
                await manager.broadcast(json.dumps(current_data))

            except json.JSONDecodeError:
                continue

    except WebSocketDisconnect:
        manager.disconnect(websocket)


# Endpoint para obtener el estado actual (HTTP)
@app.get("/scores")
async def get_scores():
    return load_data()


# Endpoint para resetear los datos (útil para testing)
@app.post("/reset")
async def reset_scores():
    save_data({})
    return {"status": "scores reset"}