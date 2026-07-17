import type { Express } from "express";

export type RoomRow = {
  id: string;
  name: string;
  type: string;
  capacity: number;
  accessLevel: string;
  floorId: string;
};

export const DEFAULT_ROOMS: RoomRow[] = [
  { id: "100", name: "100", type: "Кабинет", capacity: 4, accessLevel: "green", floorId: "floor-1" },
  { id: "101", name: "101", type: "Кабинет", capacity: 6, accessLevel: "green", floorId: "floor-1" },
  { id: "102", name: "102", type: "Переговорная", capacity: 8, accessLevel: "green", floorId: "floor-1" },
  { id: "103", name: "103", type: "Переговорная", capacity: 10, accessLevel: "green", floorId: "floor-1" },
  { id: "107", name: "107", type: "Большая лекционная «Север»", capacity: 150, accessLevel: "red", floorId: "floor-1" },
  { id: "109", name: "109", type: "Лекционная", capacity: 80, accessLevel: "yellow", floorId: "floor-1" },
  { id: "110", name: "110", type: "Аудитория", capacity: 40, accessLevel: "yellow", floorId: "floor-1" },
  { id: "111", name: "111", type: "Кабинет", capacity: 2, accessLevel: "red", floorId: "floor-1" },
  { id: "112", name: "112", type: "Студия", capacity: 15, accessLevel: "yellow", floorId: "floor-1" },
  { id: "200", name: "200", type: "Лекционная", capacity: 100, accessLevel: "yellow", floorId: "floor-2" },
  { id: "201", name: "201", type: "Кабинет", capacity: 4, accessLevel: "green", floorId: "floor-2" },
  { id: "202", name: "202", type: "Переговорная", capacity: 12, accessLevel: "green", floorId: "floor-2" },
  { id: "300", name: "300", type: "Конференц-зал", capacity: 200, accessLevel: "red", floorId: "floor-3" },
  { id: "301", name: "301", type: "Кабинет", capacity: 4, accessLevel: "green", floorId: "floor-3" },
];

export function registerRoomRoutes(app: Express) {
  const roomsStore = DEFAULT_ROOMS.map((room) => ({ ...room }));

  app.get("/api/rooms", async (_req, res) => {
    res.json(roomsStore);
  });
  app.get("/api/rooms/:id", async (req, res) => {
    const room = roomsStore.find((item) => item.id === req.params.id);
    if (!room) return res.status(404).json({ message: "Room not found" });
    res.json(room);
  });
  app.put("/api/rooms/:id", async (req, res) => {
    const index = roomsStore.findIndex((item) => item.id === req.params.id);
    if (index === -1) return res.status(404).json({ message: "Room not found" });
    const { capacity, accessLevel, name, type } = req.body;
    if (capacity != null) roomsStore[index].capacity = Number(capacity);
    if (accessLevel != null) roomsStore[index].accessLevel = String(accessLevel);
    if (name != null) roomsStore[index].name = String(name);
    if (type != null) roomsStore[index].type = String(type);
    res.json(roomsStore[index]);
  });
}
