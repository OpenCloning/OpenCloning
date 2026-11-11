export const TEST_USERS = [
  {
    id: 'bootstrap',
    label: 'Bootstrap User',
    email: 'bootstrap+clerk_test@example.com',
    token: 'test:bootstrap|bootstrap+clerk_test@example.com|Bootstrap User',
  },
  {
    id: 'viewer',
    label: 'View Only User',
    email: 'view-only-user@example.com',
    token: 'test:viewer|view-only-user@example.com|View Only User',
  },
  {
    id: 'other',
    label: 'Other Workspace User',
    email: 'other-workspace-user@example.com',
    token: 'test:other|other-workspace-user@example.com|Other Workspace User',
  },
];

export function buildTestToken({ subject, email, displayName }) {
  return `test:${subject}|${email}|${displayName}`;
}
