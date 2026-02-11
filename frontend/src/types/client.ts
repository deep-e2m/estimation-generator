/**
 * Client type definitions
 */

export interface Client {
  id: string;
  name: string;
  email?: string;
  created_at: string;
  updated_at: string;
}

export interface ClientCreate {
  name: string;
  email?: string;
}

export interface ClientListResponse {
  clients: Client[];
}
