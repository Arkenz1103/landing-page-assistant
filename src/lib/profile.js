import { readJson, writeJson } from './storage.js';

// Each user's profile (Settings > Account), saved on this device: { fullName, displayName, photo (data URL) }
const profileKey = (userId) => `lpa-profile:${userId}`;

export const PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
// the saved photo is a small square, so it fits in browser storage
const PHOTO_SIZE = 160;

const text = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

export function loadProfile(userId) {
  const p = readJson(profileKey(userId)) ?? {};
  return {
    fullName: text(p.fullName, 80),
    displayName: text(p.displayName, 40),
    photo: typeof p.photo === 'string' && p.photo.startsWith('data:image/') ? p.photo : '',
  };
}

// true when saved
export function saveProfile(userId, profile) {
  return writeJson(profileKey(userId), profile);
}

// The name the sidebar shows: what they want to be called, else their full name, else the username
export function shownName(profile, user) {
  return profile.displayName.trim() || profile.fullName.trim() || user.name;
}

// The name in the welcome greeting: only one the user gave (what to call them, else their first name), never the login
export function greetName(profile) {
  return profile.displayName.trim() || profile.fullName.trim().split(/\s+/)[0] || '';
}

// "Smart Local" -> "SL", "admin" -> "A"
export function initials(name) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  return (words.length > 1 ? words[0][0] + words[words.length - 1][0] : words[0][0]).toUpperCase();
}

/**
 * A picked image file -> a small square data URL (centre-cropped). Throws an Error with a sentence for the
 * settings page when the file isn't a PNG / JPEG / WebP up to 10MB or can't be read.
 */
export async function photoFromFile(file) {
  if (!PHOTO_TYPES.includes(file.type)) throw new Error('Use a PNG, JPEG, or WebP image.');
  if (file.size > PHOTO_MAX_BYTES) throw new Error('That image is over 10MB. Pick a smaller one.');
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('That image couldn’t be read. Try another one.');
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = PHOTO_SIZE;
  canvas
    .getContext('2d')
    .drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
  bitmap.close();
  return canvas.toDataURL('image/webp', 0.9);
}
