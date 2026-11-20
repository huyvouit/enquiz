export enum AccountStatus {
  ACTIVE = 'active',
  /** Self-registered teacher waiting for an admin to approve the account. */
  PENDING = 'pending',
  /** Blocked by an admin. Every request is rejected with 401. */
  DISABLED = 'disabled',
}
