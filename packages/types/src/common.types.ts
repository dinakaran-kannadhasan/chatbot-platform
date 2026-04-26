export interface BaseDocument {
  readonly id: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ApiResponse<T = void> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}
