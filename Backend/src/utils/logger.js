export function timestamp() {
  return new Date().toISOString();
}

export function logInfo(...args) {
  console.log(`[INFO ${timestamp()}]`, ...args);
}

export function logError(...args) {
  console.error(`[ERROR ${timestamp()}]`, ...args);
}
