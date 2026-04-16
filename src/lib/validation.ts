// Input validation utilities for production-ready app

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface StringValidationOptions {
  min?: number;
  max?: number;
  name?: string;
}

export function validateEmail(email: string): ValidationResult {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }
  return { valid: true };
}

export function validatePhone(phone: string): ValidationResult {
  const phoneRegex = /^[\d\s\-\+\(\)]{7,15}$/;
  if (!phoneRegex.test(phone.trim())) {
    return { valid: false, error: 'Invalid phone number format' };
  }
  return { valid: true };
}

export function validatePrice(price: unknown): ValidationResult {
  if (price === null || price === undefined || price === '') {
    return { valid: false, error: 'Price must be a positive number' };
  }
  const num = Number(price);
  if (isNaN(num) || num < 0 || num > 999999) {
    return { valid: false, error: 'Price must be a positive number' };
  }
  return { valid: true };
}

export function validateString(
  str: unknown,
  opts: number | StringValidationOptions = { min: 1, max: 500, name: 'value' },
  maxLen?: number,
  name = 'value'
): ValidationResult {
  let minLength = 1;
  let maximumLength = 500;
  let fieldName = 'value';

  if (typeof opts === 'number') {
    minLength = opts;
    maximumLength = typeof maxLen === 'number' ? maxLen : 500;
    fieldName = name;
  } else {
    minLength = opts.min ?? 1;
    maximumLength = opts.max ?? 500;
    fieldName = opts.name ?? 'value';
  }

  if (typeof str !== 'string') {
    return { valid: false, error: `${fieldName} must be a string` };
  }
  if (str.trim().length < minLength) {
    return { valid: false, error: `${fieldName} must be at least ${minLength} characters` };
  }
  if (str.length > maximumLength) {
    return { valid: false, error: `${fieldName} must be at most ${maximumLength} characters` };
  }
  return { valid: true };
}

export function validateURL(url: string): ValidationResult {
  try {
    new URL(url);
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

export function sanitizeString(str: string): string {
  return str.trim().slice(0, 500);
}

export function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateOrderStatus(status: string): ValidationResult {
  const validStatuses = ['Pending', 'Preparing', 'Out for Delivery', 'Completed', 'Rejected', 'Cancelled', 'Failed'];
  if (!validStatuses.includes(status)) {
    return { valid: false, error: `Status must be one of: ${validStatuses.join(', ')}` };
  }
  return { valid: true };
}

export function validateRestaurantForm(data: any): ValidationResult {
  if (!data.name) return { valid: false, error: 'Restaurant name is required' };
  const nameVal = validateString(data.name, 2, 100, 'Restaurant name');
  if (!nameVal.valid) return nameVal;
  
  if (!data.contact) return { valid: false, error: 'Contact is required' };
  const contactVal = validatePhone(data.contact);
  if (!contactVal.valid) return contactVal;
  
  if (!data.address) return { valid: false, error: 'Address is required' };
  const addressVal = validateString(data.address, 5, 250, 'Address');
  if (!addressVal.valid) return addressVal;
  
  return { valid: true };
}

export function validateMenuItemForm(data: any): ValidationResult {
  if (!data.name) return { valid: false, error: 'Item name is required' };
  const nameVal = validateString(data.name, 2, 100, 'Item name');
  if (!nameVal.valid) return nameVal;
  
  if (!data.price && data.price !== 0) return { valid: false, error: 'Price is required' };
  const priceVal = validatePrice(data.price);
  if (!priceVal.valid) return priceVal;
  
  return { valid: true };
}
