/**
 * Client API service
 */

import { apiClient } from './api';
import type { Client, ClientCreate, ClientListResponse } from '@/types/client';
import type { ApiResponse } from '@/types';

class ClientService {
  /**
   * Get all clients for current user
   */
  async list(): Promise<ClientListResponse> {
    const response = await apiClient.get<ClientListResponse>('/api/v1/clients');
    return response.data;
  }

  /**
   * Create a new client
   */
  async create(data: ClientCreate): Promise<Client> {
    const response = await apiClient.post<ApiResponse<Client>>('/api/v1/clients', data);
    return response.data.data;
  }

  /**
   * Get a specific client by ID
   */
  async get(id: string): Promise<Client> {
    const response = await apiClient.get<ApiResponse<Client>>(`/api/v1/clients/${id}`);
    return response.data.data;
  }
}

export const clientService = new ClientService();
