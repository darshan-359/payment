// api.js — Centralized API calls to the QuorumGuard backend.

const BASE = '/api';

async function handleResponse(res) {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

export async function authorize(payload) {
  const res = await fetch(`${BASE}/authorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function getTransactions() {
  const res = await fetch(`${BASE}/transactions`);
  return handleResponse(res);
}

export async function getSystemStatus() {
  const res = await fetch(`${BASE}/system-status`);
  return handleResponse(res);
}

export async function simulatePartition() {
  const res = await fetch(`${BASE}/partition`, { method: 'POST' });
  return handleResponse(res);
}

export async function restoreNetwork() {
  const res = await fetch(`${BASE}/restore`, { method: 'POST' });
  return handleResponse(res);
}

export async function getOutbox() {
  const res = await fetch(`${BASE}/outbox`);
  return handleResponse(res);
}

export async function setRegion(region) {
  const res = await fetch(`${BASE}/region`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ region }),
  });
  return handleResponse(res);
}
