/**
 * API Client for communicating with the NestJS backend
 * Handles authentication tokens and requests to /api/v1 endpoints
 * 
 * Security:
 * - Access token: stored in-memory only (not persisted)
 * - Refresh token: stored in HttpOnly cookie (set by backend)
 */

const LOCAL_API_URL = "http://localhost:3001/api/v1";
const API_URL = process.env.NEXT_PUBLIC_API_URL || LOCAL_API_URL;
const PROFILE_CACHE_KEY = 'uts_profile_cache_v1';
const AUTH_HINT_COOKIE = "uts_auth_hint";
const ROLE_HINT_COOKIE = "uts_role_hint";

// In-memory token storage (not persisted, cleared on page refresh)
let accessToken: string | null = null;

// Callbacks for token state changes
type TokenChangeCallback = (token: string | null) => void;
const tokenChangeCallbacks: Set<TokenChangeCallback> = new Set();

// Callbacks for profile updates
type ProfileUpdateCallback = (profile: Partial<UserProfile>) => void;
const profileUpdateCallbacks: Set<ProfileUpdateCallback> = new Set();

function readCachedProfile(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

function writeCachedProfile(profile: UserProfile): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore cache write failures (e.g. private mode quota limits).
  }
}

function clearCachedProfile(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    // Ignore cache clear failures.
  }
}

function setAuthHintCookie(isAuthenticated: boolean, role?: string | null): void {
  if (typeof document === "undefined") return;
  if (isAuthenticated) {
    document.cookie = `${AUTH_HINT_COOKIE}=1; Path=/; SameSite=Lax`;
    if (role) {
      document.cookie = `${ROLE_HINT_COOKIE}=${role}; Path=/; SameSite=Lax`;
    }
  } else {
    document.cookie = `${AUTH_HINT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
    document.cookie = `${ROLE_HINT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  }
}

export interface AccessTokenResponse {
  access_token: string;
  requires_password_change: boolean;
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
  private static buildCandidateApiUrls(): string[] {
    const normalizedPrimary = API_URL.replace(/\/+$/, "");
    const normalizedLocal = LOCAL_API_URL.replace(/\/+$/, "");

    // Try configured URL first, then localhost fallback when different.
    return normalizedPrimary === normalizedLocal
      ? [normalizedPrimary]
      : [normalizedPrimary, normalizedLocal];
  }

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
    const existing = readCachedProfile();
    if (existing) {
      writeCachedProfile({ ...existing, ...profile });
    }
    profileUpdateCallbacks.forEach(callback => callback(profile));
  }

  static getCachedProfile(): UserProfile | null {
    return readCachedProfile();
  }

  private static setAccessToken(token: string | null): void {
    accessToken = token;
    if (token) {
      // Decode role from JWT payload (for middleware routing hint only)
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
          const payload = JSON.parse(atob(padded)) as { role?: string };
          setAuthHintCookie(true, payload.role ?? null);
        } else {
          setAuthHintCookie(true);
        }
      } catch {
        setAuthHintCookie(true);
      }
    } else {
      setAuthHintCookie(false);
      clearCachedProfile();
    }
    this.notifyTokenChange(token);
  }

  static async request<T>(
    endpoint: string,
    options: RequestInit = {},
    skipAuthRedirect = false,
    hasRetriedAfterRefresh = false,
  ): Promise<T> {
    const urls = this.buildCandidateApiUrls().map((baseUrl) => `${baseUrl}${endpoint}`);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    // Add access token if it exists (from in-memory storage)
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    let response: Response | null = null;
    let lastNetworkError: unknown = null;

    for (const url of urls) {
      try {
        // #region agent log
        fetch('http://127.0.0.1:7709/ingest/ec09a340-7727-4b91-930d-cfdbd393ea72',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d7b561'},body:JSON.stringify({sessionId:'d7b561',runId:'initial',hypothesisId:'H4',location:'frontend/lib/api-client.ts:180',message:'request attempt',data:{endpoint,url,hasAccessToken:Boolean(accessToken),method:(options.method??'GET')},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        // #region agent log
        fetch('/api/_debug',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'initial',hypothesisId:'H4',location:'frontend/lib/api-client.ts:181',message:'request attempt (relay)',data:{endpoint,url,hasAccessToken:Boolean(accessToken),method:(options.method??'GET')},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        response = await fetch(url, {
          ...options,
          headers,
          credentials: 'include', // Important: include cookies for refresh token
        });
        break;
      } catch (error) {
        // #region agent log
        fetch('http://127.0.0.1:7709/ingest/ec09a340-7727-4b91-930d-cfdbd393ea72',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d7b561'},body:JSON.stringify({sessionId:'d7b561',runId:'initial',hypothesisId:'H5',location:'frontend/lib/api-client.ts:189',message:'request network error',data:{endpoint,url,errorMessage:error instanceof Error ? error.message : 'unknown'},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        lastNetworkError = error;
      }
    }

    if (!response) {
      // Network error (server not reachable, CORS, etc.)
      throw new ApiError(
        'Unable to connect to the server. Please check your internet connection and try again.',
        0,
        'NETWORK_ERROR',
        lastNetworkError instanceof Error ? lastNetworkError.message : 'Unknown network error'
      );
    }

    if (!response.ok) {
      // If the access token is expired, try to refresh once and retry the original request.
      // This keeps sessions alive as long as the HttpOnly refresh cookie is valid.
      if (
        response.status === 401 &&
        !skipAuthRedirect &&
        !hasRetriedAfterRefresh &&
        !endpoint.startsWith("/auth/")
      ) {
        try {
          await this.refresh();
          return await this.request<T>(endpoint, options, skipAuthRedirect, true);
        } catch {
          // Fall through to the normal 401 handling below.
        }
      }

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
          // For login/refresh flows, don't clear session or redirect.
          if (skipAuthRedirect) {
            throw new ApiError(
              errorMessage || 'Unauthorized. Please sign in again.',
              401,
              'UNAUTHORIZED',
              errorDetails
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
    const profile = await this.request<UserProfile>('/users/me');
    writeCachedProfile(profile);
    return profile;
  }

  static async updateProfile(data: UpdateProfileData): Promise<UserProfile> {
    const updated = await this.request<UserProfile>('/users/me/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    writeCachedProfile(updated);
    this.notifyProfileUpdate(updated);
    return updated;
  }

  static async updatePreferences(data: UpdatePreferencesData): Promise<UserPreferences> {
    return this.request<UserPreferences>('/users/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  static async updateMyPassword(newPassword: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/users/me/password', {
      method: 'PATCH',
      body: JSON.stringify({ new_password: newPassword }),
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
