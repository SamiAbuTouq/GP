/**
 * API Client for communicating with the NestJS backend
 * Handles authentication tokens and requests to /api/v1 endpoints
 * 
 * Security:
 * - Access token: stored in-memory only (not persisted)
 * - Refresh token: stored in HttpOnly cookie (set by backend)
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

// In-memory token storage (not persisted, cleared on page refresh)
let accessToken: string | null = null;

// Callbacks for token state changes
type TokenChangeCallback = (token: string | null) => void;
const tokenChangeCallbacks: Set<TokenChangeCallback> = new Set();

// Callbacks for profile updates
type ProfileUpdateCallback = (profile: Partial<UserProfile>) => void;
const profileUpdateCallbacks: Set<ProfileUpdateCallback> = new Set();

export interface AccessTokenResponse {
  access_token: string;
}

// Custom error class for API errors with detailed information
export class ApiError extends Error {
  public statusCode: number;
  public errorType: 'INVALID_CREDENTIALS' | 'NETWORK_ERROR' | 'SERVER_ERROR' | 'VALIDATION_ERROR' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'UNKNOWN';
  public details?: string;

  constructor(
    message: string,
    statusCode: number,
    errorType: ApiError['errorType'],
    details?: string
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorType = errorType;
    this.details = details;
  }
}

export class ApiClient {
  // Subscribe to token changes
  static onTokenChange(callback: TokenChangeCallback): () => void {
    tokenChangeCallbacks.add(callback);
    return () => tokenChangeCallbacks.delete(callback);
  }

  private static notifyTokenChange(token: string | null): void {
    tokenChangeCallbacks.forEach(callback => callback(token));
  }

  // Subscribe to profile changes
  static onProfileUpdate(callback: ProfileUpdateCallback): () => void {
    profileUpdateCallbacks.add(callback);
    return () => profileUpdateCallbacks.delete(callback);
  }

  static notifyProfileUpdate(profile: Partial<UserProfile>): void {
    profileUpdateCallbacks.forEach(callback => callback(profile));
  }

  private static setAccessToken(token: string | null): void {
    accessToken = token;
    this.notifyTokenChange(token);
  }

  static async request<T>(
    endpoint: string,
    options: RequestInit = {},
    skipAuthRedirect = false
  ): Promise<T> {
    const url = `${API_URL}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    // Add access token if it exists (from in-memory storage)
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    let response: Response;
    
    try {
      response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // Important: include cookies for refresh token
      });
    } catch (error) {
      // Network error (server not reachable, CORS, etc.)
      throw new ApiError(
        'Unable to connect to the server. Please check your internet connection and try again.',
        0,
        'NETWORK_ERROR',
        error instanceof Error ? error.message : 'Unknown network error'
      );
    }

    if (!response.ok) {
      // Try to parse error response from backend
      let errorMessage = 'An unexpected error occurred';
      let errorDetails: string | undefined;
      
      try {
        const errorBody = await response.json();
        errorMessage = errorBody.message || errorMessage;
        errorDetails = errorBody.error || errorBody.statusCode?.toString();
      } catch {
        // Response is not JSON, use status text
        errorMessage = response.statusText || errorMessage;
      }

      // Handle specific status codes
      switch (response.status) {
        case 400:
          throw new ApiError(
            errorMessage || 'Invalid request. Please check your input.',
            400,
            'VALIDATION_ERROR',
            errorDetails
          );
        case 401:
          // For login endpoint, don't redirect - just throw the error
          if (skipAuthRedirect) {
            throw new ApiError(
              'Invalid email or password. Please check your credentials and try again.',
              401,
              'INVALID_CREDENTIALS'
            );
          }
          // For other endpoints, clear token and let auth context handle redirect
          this.setAccessToken(null);
          throw new ApiError(
            'Your session has expired. Please sign in again.',
            401,
            'UNAUTHORIZED'
          );
        case 403:
          throw new ApiError(
            errorMessage || 'You do not have permission to perform this action.',
            403,
            'FORBIDDEN',
            errorDetails
          );
        case 404:
          throw new ApiError(
            errorMessage || 'The requested resource was not found.',
            404,
            'NOT_FOUND',
            errorDetails
          );
        case 500:
        case 502:
        case 503:
        case 504:
          throw new ApiError(
            'The server is temporarily unavailable. Please try again later.',
            response.status,
            'SERVER_ERROR',
            errorDetails
          );
        default:
          throw new ApiError(
            errorMessage,
            response.status,
            'UNKNOWN',
            errorDetails
          );
      }
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  /**
   * Login with email and password
   * Backend sets refresh token in HttpOnly cookie
   * Access token is stored in-memory only
   */
  static async login(email: string, password: string): Promise<AccessTokenResponse> {
    const data = await this.request<AccessTokenResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }, true);

    // Store access token in memory only
    this.setAccessToken(data.access_token);

    return data;
  }

  /**
   * Refresh access token using HttpOnly cookie
   * Called automatically on page load to restore session
   */
  static async refresh(): Promise<AccessTokenResponse> {
    const data = await this.request<AccessTokenResponse>('/auth/refresh', {
      method: 'POST',
    }, true);

    // Store new access token in memory
    this.setAccessToken(data.access_token);

    return data;
  }

  /**
   * Logout - clears in-memory token and backend clears cookie
   */
  static async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', {
        method: 'POST',
      });
    } finally {
      // Always clear in-memory token
      this.setAccessToken(null);
    }
  }

  /**
   * Check if we have an access token in memory
   */
  static getAccessToken(): string | null {
    return accessToken;
  }

  /**
   * Check if authenticated (has access token in memory)
   */
  static isAuthenticated(): boolean {
    return accessToken !== null;
  }

  // User Profile & Preferences
  static async getProfile(): Promise<UserProfile> {
    return this.request<UserProfile>('/users/me');
  }

  static async updateProfile(data: UpdateProfileData): Promise<UserProfile> {
    const updated = await this.request<UserProfile>('/users/me/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    this.notifyProfileUpdate(updated);
    return updated;
  }

  static async updatePreferences(data: UpdatePreferencesData): Promise<UserPreferences> {
    return this.request<UserPreferences>('/users/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }
}

// Types for user profile and preferences
export interface UserProfile {
  user_id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  department: string | null;
  theme_preference: string;
  date_format: string;
  time_format: string;
  avatar_url?: string | null;
}

export interface UpdateProfileData {
  first_name?: string;
  last_name?: string;
  avatar_base64?: string;
}

export interface UpdatePreferencesData {
  theme_preference?: string;
  date_format?: string;
  time_format?: string;
}

export interface UserPreferences {
  theme_preference: string;
  date_format: string;
  time_format: string;
}
