export interface SavedAddress {
  id: string;
  label: string;
  flat: string;
  area: string;
  landmark: string;
  city: string;
  pincode: string;
  isDefault: boolean;
  lat?: string;
  lng?: string;
}

function getAddressKey(contact: string) { return `addresses_${contact}`; }
function getPhoneKey(contact: string)   { return `phone_${contact}`; }

export function loadAddresses(contact: string): SavedAddress[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(getAddressKey(contact)) || '[]'); } catch { return []; }
}

export function saveAddresses(contact: string, list: SavedAddress[]) {
  localStorage.setItem(getAddressKey(contact), JSON.stringify(list));
}

export function loadPhone(contact: string): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(getPhoneKey(contact)) || '';
}

export function savePhone(contact: string, phone: string) {
  if (phone) localStorage.setItem(getPhoneKey(contact), phone);
}
