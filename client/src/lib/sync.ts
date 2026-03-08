import { db, type ProductionRecord, type ProductionOrder, type InventoryRecord } from './db';

const SERVER_URL = (window as any).AndroidBridge?.getServerUrl?.() || '';
const API_BASE = SERVER_URL ? `${SERVER_URL}/api` : '/api';

let syncInProgress = false;
let lastSyncTime = 0;
let autoSyncInterval: ReturnType<typeof setInterval> | null = null;

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'offline';

const listeners: Set<(status: SyncStatus, message?: string) => void> = new Set();

export function onSyncStatus(cb: (status: SyncStatus, message?: string) => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function notify(status: SyncStatus, message?: string) {
  listeners.forEach(cb => cb(status, message));
}

export function isOnline(): boolean {
  return navigator.onLine;
}

function isLoggedIn(): boolean {
  return !!localStorage.getItem('userRole');
}

const PENDING_SYNC_KEY = 'pendingSyncItems';

interface PendingSyncItem {
  type: 'record' | 'order' | 'inventory';
  localId: number;
  timestamp: number;
}

function getPendingSyncQueue(): PendingSyncItem[] {
  try {
    return JSON.parse(localStorage.getItem(PENDING_SYNC_KEY) || '[]');
  } catch { return []; }
}

function addToPendingSyncQueue(item: PendingSyncItem) {
  const queue = getPendingSyncQueue();
  const exists = queue.find(q => q.type === item.type && q.localId === item.localId);
  if (!exists) {
    queue.push(item);
  } else {
    exists.timestamp = item.timestamp;
  }
  localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(queue));
}

function clearPendingSyncQueue() {
  localStorage.setItem(PENDING_SYNC_KEY, '[]');
}

export function getPendingSyncCount(): number {
  return getPendingSyncQueue().length;
}

async function apiRequest(path: string, options?: RequestInit) {
  if (!isLoggedIn()) {
    throw new Error('Not logged in');
  }
  if (!isOnline()) {
    throw new Error('Offline');
  }
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  });
  if (res.status === 401) {
    throw new Error('Session expired');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export async function syncRecordToServer(record: ProductionRecord) {
  if (!isOnline()) {
    addToPendingSyncQueue({ type: 'record', localId: record.id!, timestamp: Date.now() });
    return;
  }
  try {
    const payload = {
      clientId: record.id,
      orderId: record.orderId || null,
      date: record.date,
      shift: record.shift,
      section: record.section,
      data: record.data,
      actionBy: record.action_by || null,
      actionType: record.action_type || null,
      actionNote: record.action_note || null,
      actionTimestamp: record.action_timestamp || null,
      status: record.status || 'pending_supervisor',
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
    await apiRequest('/sync', {
      method: 'POST',
      body: JSON.stringify({ records: [payload], orders: [], inventory: [] }),
    });
  } catch (e) {
    addToPendingSyncQueue({ type: 'record', localId: record.id!, timestamp: Date.now() });
    console.warn('Record sync failed (queued for retry):', (e as Error).message);
  }
}

export async function syncOrderToServer(order: ProductionOrder) {
  if (!isOnline()) {
    addToPendingSyncQueue({ type: 'order', localId: order.id!, timestamp: Date.now() });
    return;
  }
  try {
    const payload = {
      clientId: order.id,
      date: order.date,
      productSize: order.productSize,
      targetQuantity: order.targetQuantity,
      status: order.status,
      notes: order.notes || null,
      createdAt: order.createdAt,
    };
    await apiRequest('/sync', {
      method: 'POST',
      body: JSON.stringify({ records: [], orders: [payload], inventory: [] }),
    });
  } catch (e) {
    addToPendingSyncQueue({ type: 'order', localId: order.id!, timestamp: Date.now() });
    console.warn('Order sync failed (queued for retry):', (e as Error).message);
  }
}

export async function syncInventoryToServer(inv: InventoryRecord) {
  if (!isOnline()) {
    addToPendingSyncQueue({ type: 'inventory', localId: inv.id!, timestamp: Date.now() });
    return;
  }
  try {
    const payload = {
      location: inv.location,
      material: inv.material,
      quantity: inv.quantity,
      unit: inv.unit,
      updatedAt: inv.updatedAt,
    };
    await apiRequest('/inventory', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch (e) {
    addToPendingSyncQueue({ type: 'inventory', localId: inv.id!, timestamp: Date.now() });
    console.warn('Inventory sync failed (queued for retry):', (e as Error).message);
  }
}

async function syncPendingQueue(): Promise<number> {
  const queue = getPendingSyncQueue();
  if (queue.length === 0) return 0;

  let synced = 0;
  const remaining: PendingSyncItem[] = [];

  for (const item of queue) {
    try {
      if (item.type === 'record') {
        const record = await db.records.get(item.localId);
        if (record) {
          const payload = {
            clientId: record.id,
            orderId: record.orderId || null,
            date: record.date,
            shift: record.shift,
            section: record.section,
            data: record.data,
            actionBy: record.action_by || null,
            actionType: record.action_type || null,
            actionNote: record.action_note || null,
            actionTimestamp: record.action_timestamp || null,
            status: record.status || 'pending_supervisor',
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
          };
          await apiRequest('/sync', {
            method: 'POST',
            body: JSON.stringify({ records: [payload], orders: [], inventory: [] }),
          });
          synced++;
        } else {
          synced++;
        }
      } else if (item.type === 'order') {
        const order = await db.orders.get(item.localId);
        if (order) {
          const payload = {
            clientId: order.id,
            date: order.date,
            productSize: order.productSize,
            targetQuantity: order.targetQuantity,
            status: order.status,
            notes: order.notes || null,
            createdAt: order.createdAt,
          };
          await apiRequest('/sync', {
            method: 'POST',
            body: JSON.stringify({ records: [], orders: [payload], inventory: [] }),
          });
          synced++;
        } else {
          synced++;
        }
      } else if (item.type === 'inventory') {
        const inv = await db.inventory.get(item.localId);
        if (inv) {
          const payload = {
            location: inv.location,
            material: inv.material,
            quantity: inv.quantity,
            unit: inv.unit,
            updatedAt: inv.updatedAt,
          };
          await apiRequest('/inventory', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          synced++;
        } else {
          synced++;
        }
      }
    } catch (e) {
      remaining.push(item);
    }
  }

  localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(remaining));
  return synced;
}

export async function fullSync(): Promise<{ success: boolean; message: string }> {
  if (syncInProgress) return { success: false, message: 'Sync already in progress' };

  if (!isOnline()) {
    notify('offline', 'No internet connection');
    return { success: false, message: 'No internet connection. Changes saved locally and will sync when online.' };
  }

  syncInProgress = true;
  notify('syncing');

  try {
    const pendingSynced = await syncPendingQueue();

    const [localRecords, localOrders, localInventory] = await Promise.all([
      db.records.toArray(),
      db.orders.toArray(),
      db.inventory.toArray(),
    ]);

    const recordPayloads = localRecords.map(r => ({
      clientId: r.id,
      orderId: r.orderId || null,
      date: r.date,
      shift: r.shift,
      section: r.section,
      data: r.data,
      actionBy: r.action_by || null,
      actionType: r.action_type || null,
      actionNote: r.action_note || null,
      actionTimestamp: r.action_timestamp || null,
      status: r.status || 'pending_supervisor',
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    const orderPayloads = localOrders.map(o => ({
      clientId: o.id,
      date: o.date,
      productSize: o.productSize,
      targetQuantity: o.targetQuantity,
      status: o.status,
      notes: o.notes || null,
      createdAt: o.createdAt,
    }));

    const inventoryPayloads = localInventory.map(i => ({
      location: i.location,
      material: i.material,
      quantity: i.quantity,
      unit: i.unit,
      updatedAt: i.updatedAt,
    }));

    await apiRequest('/sync', {
      method: 'POST',
      body: JSON.stringify({
        records: recordPayloads,
        orders: orderPayloads,
        inventory: inventoryPayloads,
      }),
    });

    const serverRecords: any[] = await apiRequest('/records');
    const serverOrders: any[] = await apiRequest('/orders');
    const serverInventory: any[] = await apiRequest('/inventory');

    for (const sr of serverRecords) {
      const clientId = sr.clientId;
      if (clientId) {
        const existing = await db.records.get(clientId);
        if (existing) {
          if (sr.updatedAt > existing.updatedAt) {
            await db.records.update(clientId, {
              status: sr.status,
              data: sr.data,
              action_by: sr.actionBy,
              action_type: sr.actionType,
              action_note: sr.actionNote,
              action_timestamp: sr.actionTimestamp,
              updatedAt: sr.updatedAt,
            });
          }
        }
      } else {
        const hasMatch = await db.records.where('createdAt').equals(sr.createdAt).first();
        if (!hasMatch) {
          await db.records.add({
            orderId: sr.orderId,
            date: sr.date,
            shift: sr.shift,
            section: sr.section,
            data: sr.data,
            action_by: sr.actionBy,
            action_type: sr.actionType,
            action_note: sr.actionNote,
            action_timestamp: sr.actionTimestamp,
            status: sr.status,
            createdAt: sr.createdAt,
            updatedAt: sr.updatedAt,
          });
        }
      }
    }

    for (const so of serverOrders) {
      const clientId = so.clientId;
      if (clientId) {
        const existing = await db.orders.get(clientId);
        if (!existing) {
          await db.orders.add({
            date: so.date,
            productSize: so.productSize,
            targetQuantity: so.targetQuantity,
            status: so.status,
            notes: so.notes,
            createdAt: so.createdAt,
          });
        }
      }
    }

    for (const si of serverInventory) {
      const existing = await db.inventory
        .where('location').equals(si.location)
        .and(item => item.material === si.material)
        .first();
      if (existing) {
        if (si.updatedAt > existing.updatedAt) {
          await db.inventory.update(existing.id!, {
            quantity: si.quantity,
            unit: si.unit,
            updatedAt: si.updatedAt,
          });
        }
      } else {
        await db.inventory.add({
          location: si.location,
          material: si.material,
          quantity: si.quantity,
          unit: si.unit,
          updatedAt: si.updatedAt,
        });
      }
    }

    lastSyncTime = Date.now();
    localStorage.setItem('lastSyncTime', String(lastSyncTime));
    const pendingMsg = pendingSynced > 0 ? ` (${pendingSynced} queued items synced)` : '';
    notify('success', `Synced at ${new Date().toLocaleTimeString()}${pendingMsg}`);
    return { success: true, message: `Sync complete${pendingMsg}. ${serverRecords.length} records, ${serverOrders.length} orders, ${serverInventory.length} inventory items on server.` };
  } catch (e) {
    const msg = (e as Error).message;
    notify('error', msg);
    return { success: false, message: msg };
  } finally {
    syncInProgress = false;
  }
}

export function getLastSyncTime() {
  if (!lastSyncTime) {
    lastSyncTime = parseInt(localStorage.getItem('lastSyncTime') || '0', 10);
  }
  return lastSyncTime;
}

export function startAutoSync() {
  if (autoSyncInterval) return;

  window.addEventListener('online', () => {
    console.log('[Sync] Back online — syncing...');
    notify('syncing', 'Back online, syncing...');
    fullSync().then(result => {
      if (result.success) {
        console.log('[Sync] Auto-sync on reconnect complete');
      }
    });
  });

  window.addEventListener('offline', () => {
    console.log('[Sync] Went offline');
    notify('offline', 'Working offline. Changes will sync when connected.');
  });

  autoSyncInterval = setInterval(() => {
    if (isOnline() && isLoggedIn() && getPendingSyncCount() > 0) {
      console.log('[Sync] Auto-syncing pending items...');
      fullSync().catch(() => {});
    }
  }, 60000);
}

export function stopAutoSync() {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
    autoSyncInterval = null;
  }
}
