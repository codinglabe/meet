'use strict';

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const dataDir = path.join(process.cwd(), '.data');
const usersFile = path.join(dataDir, 'users.json');

function readUsers() {
  try {
    if (!fs.existsSync(usersFile)) return [];
    const raw = fs.readFileSync(usersFile, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeUsers(users) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), 'utf8');
}

export function findUserByEmail(email) {
  const e = String(email || '').toLowerCase().trim();
  return readUsers().find(u => u.email === e) || null;
}

export function findUserById(id) {
  return readUsers().find(u => u.id === id) || null;
}

export function createUser({ email, password, displayName }) {
  const e = String(email || '').toLowerCase().trim();
  const name = String(displayName || '').trim().slice(0, 60);
  if (!e || !name) throw new Error('Email and display name are required');
  if (password.length < 8) throw new Error('Password must be at least 8 characters');
  if (findUserByEmail(e)) throw new Error('An account with this email already exists');

  const id = crypto.randomUUID();
  const passwordHash = bcrypt.hashSync(password, 10);
  const users = readUsers();
  users.push({
    id,
    email: e,
    displayName: name,
    passwordHash,
    createdAt: new Date().toISOString()
  });
  writeUsers(users);
  return { id, email: e, displayName: name };
}

export function verifyLogin(email, password) {
  const user = findUserByEmail(email);
  if (!user) return null;
  const ok = bcrypt.compareSync(password, user.passwordHash);
  if (!ok) return null;
  return { id: user.id, email: user.email, displayName: user.displayName };
}
