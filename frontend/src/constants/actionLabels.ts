// Action code to label mapping for audit logs
export const ACTION_LABELS: Record<string, string> = {
  // Auth & Identity
  'auth.login.success': 'User logged in',
  'auth.login.failure': 'Login failed',
  'auth.logout': 'User logged out',
  'auth.register': 'User registered',
  'auth.token.refresh': 'Token refreshed',
  'auth.account.locked': 'Account locked',
  'auth.password.reset_requested': 'Password reset requested',
  'auth.email.verified': 'Email verified',
  
  // User Management (Admin)
  'user.role.changed': 'User role changed',
  'user.deactivated': 'User deactivated',
  'user.activated': 'User activated',
  
  // Projects
  'project.created': 'Project created',
  'project.updated': 'Project updated',
  'project.status.changed': 'Project status changed',
  'project.deleted': 'Project deleted',
  
  // Project Sharing (RBAC)
  'share.created': 'Project shared',
  'share.updated': 'Share access changed',
  'share.removed': 'Share removed',
  
  // Approvals
  'approval.requested': 'Approval requested',
  'approval.approved': 'Approval granted',
  'approval.disapproved': 'Approval rejected',
  
  // Quotes
  'quote.created': 'Quote created',
  'quote.updated': 'Quote updated',
  'quote.deleted': 'Quote deleted',
  'quote.status.changed': 'Quote status changed',
  'quote.exported': 'Quote exported',
  
  // Documents & Knowledge
  'document.uploaded': 'Document uploaded',
  'document.deleted': 'Document deleted',
  'knowledge.ingested': 'Knowledge ingested',
  'knowledge.deleted': 'Knowledge deleted',
  
  // Authorization Failures (Security)
  'authz.denied': 'Access denied (403)',
};

export function getActionLabel(action: string): string {
  return ACTION_LABELS[action] || action;
}
