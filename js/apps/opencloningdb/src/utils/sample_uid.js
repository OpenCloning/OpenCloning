const isControlCharacter = (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127;

/**
 * Why uid cannot be a sample UID, '' if it can. Same rule as the backend (validate_sample_uid), which strips the UID:
 * UIDs go in URL paths (/sequence_samples/{uid}), the server decodes %2F before routing, so a '/' would point the
 * request to another route, and encodePathSegment refuses '.' and '..'.
 */
export function sampleUidError(uid) {
  const trimmed = uid.trim();
  if (!trimmed) {
    return 'A UID cannot be empty';
  }
  if (trimmed === '.' || trimmed === '..' || /[/\\]/.test(trimmed) || [...trimmed].some(isControlCharacter)) {
    return 'A UID cannot be "." or "..", or contain "/", "\\" or control characters';
  }
  return '';
}
