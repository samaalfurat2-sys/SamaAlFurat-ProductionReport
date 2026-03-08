import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import path from "path";
import fs from "fs";

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({ error: "Authentication required" });
}

function requireManager(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (req.session.role !== "manager") {
    return res.status(403).json({ error: "Manager access required" });
  }
  return next();
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

async function ensureDefaultManager() {
  const existing = await storage.getUserByUsername("manager");
  if (!existing) {
    const hashedPw = await hashPassword("admin123");
    await storage.createUser({
      username: "manager",
      password: hashedPw,
      displayName: "System Manager",
      role: "manager",
      enabled: true,
      permissions: {},
    });
    console.log("Default manager user created (username: manager, password: admin123)");
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  await ensureDefaultManager();

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ error: "Invalid username or password" });
      }
      if (!user.enabled) {
        return res.status(403).json({ error: "Account is disabled" });
      }
      const valid = await comparePasswords(password, user.password);
      if (!valid) {
        return res.status(401).json({ error: "Invalid username or password" });
      }
      req.session.userId = user.id;
      req.session.role = user.role;
      req.session.username = user.username;

      const { password: _pw, ...safeUser } = user;
      res.json(safeUser);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ error: "Logout failed" });
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (req.session && req.session.userId) {
      return res.json({ userId: req.session.userId, role: req.session.role, username: req.session.username });
    }
    return res.status(401).json({ error: "Not authenticated" });
  });

  app.get("/api/admin/users", requireManager, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const safe = allUsers.map(({ password, ...u }) => u);
      res.json(safe);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/users", requireManager, async (req, res) => {
    try {
      const { username, password, displayName, role, enabled, permissions } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }
      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(409).json({ error: "Username already exists" });
      }
      const hashedPw = await hashPassword(password);
      const user = await storage.createUser({
        username,
        password: hashedPw,
        displayName: displayName || username,
        role: role || "operator",
        enabled: enabled !== false,
        permissions: permissions || {},
      });
      const { password: _pw, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/users/:id", requireManager, async (req, res) => {
    try {
      const { username, password, displayName, role, enabled, permissions } = req.body;
      const updates: any = {};
      if (username !== undefined) updates.username = username;
      if (displayName !== undefined) updates.displayName = displayName;
      if (role !== undefined) updates.role = role;
      if (enabled !== undefined) updates.enabled = enabled;
      if (permissions !== undefined) updates.permissions = permissions;
      if (password) {
        updates.password = await hashPassword(password);
      }
      const user = await storage.updateUser(req.params.id, updates);
      if (!user) return res.status(404).json({ error: "User not found" });
      const { password: _pw, ...safeUser } = user;
      res.json(safeUser);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/users/:id", requireManager, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) return res.status(404).json({ error: "User not found" });
      if (user.role === "manager") {
        const allUsers = await storage.getAllUsers();
        const managers = allUsers.filter(u => u.role === "manager");
        if (managers.length <= 1) {
          return res.status(400).json({ error: "Cannot delete the last manager" });
        }
      }
      await storage.deleteUser(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/records", requireAuth, async (_req, res) => {
    try {
      const records = await storage.getAllRecords();
      res.json(records);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/records/:id", requireAuth, async (req, res) => {
    try {
      const record = await storage.getRecord(parseInt(req.params.id));
      if (!record) return res.status(404).json({ error: "Not found" });
      res.json(record);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/records", requireAuth, async (req, res) => {
    try {
      const record = await storage.createRecord(req.body);
      res.status(201).json(record);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/records/:id", requireAuth, async (req, res) => {
    try {
      const record = await storage.updateRecord(parseInt(req.params.id), req.body);
      if (!record) return res.status(404).json({ error: "Not found" });
      res.json(record);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/records/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteRecord(parseInt(req.params.id));
      if (!deleted) return res.status(404).json({ error: "Not found" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/orders", requireAuth, async (_req, res) => {
    try {
      const orders = await storage.getAllOrders();
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/orders", requireAuth, async (req, res) => {
    try {
      const order = await storage.createOrder(req.body);
      res.status(201).json(order);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/orders/:id", requireAuth, async (req, res) => {
    try {
      const order = await storage.updateOrder(parseInt(req.params.id), req.body);
      if (!order) return res.status(404).json({ error: "Not found" });
      res.json(order);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/inventory", requireAuth, async (_req, res) => {
    try {
      const items = await storage.getAllInventory();
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/inventory/:location", requireAuth, async (req, res) => {
    try {
      const items = await storage.getInventoryByLocation(req.params.location);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/inventory", requireAuth, async (req, res) => {
    try {
      const item = await storage.upsertInventory(req.body);
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/download/apk", (req, res) => {
    const apkPath = path.resolve("SamaAlFurat-ProductionReport.apk");
    if (fs.existsSync(apkPath)) {
      res.setHeader("Content-Type", "application/vnd.android.package-archive");
      res.setHeader("Content-Disposition", "attachment; filename=SamaAlFurat-ProductionReport.apk");
      const stream = fs.createReadStream(apkPath);
      stream.pipe(res);
    } else {
      res.status(404).json({ error: "APK not found" });
    }
  });

  app.post("/api/sync", requireAuth, async (req, res) => {
    try {
      const { records = [], orders = [], inventory = [] } = req.body;
      const result = await storage.bulkSync({ records, orders, inventory });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}
