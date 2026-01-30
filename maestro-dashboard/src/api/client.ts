

import { z } from 'zod';
import type { APIError } from '../types/api';
import { logClientEvent } from '../utils/clientLogger';

const DEFAULT_TIMEOUT = 30000; // 30 seconds

type RequestConfig = RequestInit & {
    params?: Record<string, string | number | boolean | undefined>;
    skipInterceptors?: boolean;
    timeout?: number;
};

type RequestInterceptor = (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;
type ResponseInterceptor = (response: Response) => Response | Promise<Response>;

// Simple event emitter for centralized state
type StateListener<T> = (state: T) => void;

class ApiState {
    private loadingListeners: Set<StateListener<boolean>> = new Set();
    private errorListeners: Set<StateListener<APIError>> = new Set();
    private activeRequests = 0;

    subscribeLoading(listener: StateListener<boolean>) {
        this.loadingListeners.add(listener);
        return () => this.loadingListeners.delete(listener);
    }

    subscribeError(listener: StateListener<APIError>) {
        this.errorListeners.add(listener);
        return () => this.errorListeners.delete(listener);
    }

    notifyLoading(isLoading: boolean) {
        this.loadingListeners.forEach(l => l(isLoading));
    }

    notifyError(error: APIError) {
        this.errorListeners.forEach(l => l(error));
    }

    startRequest() {
        this.activeRequests++;
        if (this.activeRequests === 1) {
            this.notifyLoading(true);
        }
    }

    endRequest() {
        this.activeRequests--;
        if (this.activeRequests <= 0) {
            this.activeRequests = 0;
            this.notifyLoading(false);
        }
    }
}

export const apiState = new ApiState();

export class ApiClient {
    private baseUrl: string;
    public requestInterceptors: Set<RequestInterceptor> = new Set();
    public responseInterceptors: Set<ResponseInterceptor> = new Set();
    private inFlightRequests = new Map<string, Promise<any>>();

    constructor(baseUrl: string = '/api') {
        this.baseUrl = baseUrl;
    }

    // Allow registering global interceptors
    public addRequestInterceptor(interceptor: RequestInterceptor) {
        this.requestInterceptors.add(interceptor);
        return () => this.requestInterceptors.delete(interceptor);
    }

    public addResponseInterceptor(interceptor: ResponseInterceptor) {
        this.responseInterceptors.add(interceptor);
        return () => this.responseInterceptors.delete(interceptor);
    }

    private async request<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
        // Generate cache key from endpoint + method + params + body
        // Default to GET if method is undefined, though strictly it should be passed
        const method = config.method || 'GET';
        const cacheKey = this.getCacheKey(method, endpoint, config.params, config.body as string);

        // Return existing promise if request is in-flight
        if (this.inFlightRequests.has(cacheKey)) {
            return this.inFlightRequests.get(cacheKey)!;
        }

        // Create new request promise
        const requestPromise = this.executeRequest<T>(endpoint, config);
        this.inFlightRequests.set(cacheKey, requestPromise);

        try {
            const result = await requestPromise;
            return result;
        } finally {
            this.inFlightRequests.delete(cacheKey);
        }
    }

    private shouldLogEndpoint(endpoint: string): boolean {
        return endpoint.startsWith("/logs") || endpoint.startsWith("/conversations");
    }

    private getSessionIdFromParams(params?: RequestConfig["params"]): string | undefined {
        if (!params) return undefined;
        const value = params["session_id"];
        return typeof value === "string" ? value : undefined;
    }

    private getCacheKey(method: string, endpoint: string, params?: Record<string, any>, body?: string): string {
        const paramStr = params ? JSON.stringify(params) : '';
        const bodyStr = body || '';
        return `${method}:${endpoint}:${paramStr}:${bodyStr}`;
    }

    private async executeRequest<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
        let { params, skipInterceptors, ...init } = config;

        // Run request interceptors
        if (!skipInterceptors) {
            for (const interceptor of this.requestInterceptors) {
                const interceptorResult: RequestConfig = await interceptor({ params, skipInterceptors, ...init });
                params = interceptorResult.params;
                skipInterceptors = interceptorResult.skipInterceptors;
                init = interceptorResult;
            }
        }

        let url = `${this.baseUrl}${endpoint}`;
        if (params) {
            const searchParams = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined) {
                    searchParams.append(key, String(value));
                }
            });
            const queryString = searchParams.toString();
            if (queryString) {
                url += `?${queryString}`;
            }
        }

        const headers: HeadersInit = {
            ...init.headers,
        };

        // Only add Content-Type if body is present
        if (init.body && typeof init.body === 'string') {
            (headers as Record<string, string>)['Content-Type'] = 'application/json';
        }

        apiState.startRequest();

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout || DEFAULT_TIMEOUT);

        try {
            let response = await fetch(url, {
                ...init,
                headers,
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            // Run response interceptors
            if (!skipInterceptors) {
                for (const interceptor of this.responseInterceptors) {
                    response = await interceptor(response);
                }
            }

            if (!response.ok) {
                await this.handleError(response);
            }

            // Handle 204 No Content
            if (response.status === 204) {
                return {} as T;
            }

            return await response.json();
        } catch (error) {
            const apiError = this.normalizeError(error);
            apiState.notifyError(apiError);
            throw apiError;
        } finally {
            apiState.endRequest();
        }
    }

    private async handleError(response: Response): Promise<never> {
        let errorData: any;
        try {
            errorData = await response.json();
        } catch {
            errorData = { detail: response.statusText };
        }

        const error: APIError = {
            detail: errorData.detail || errorData.message || 'An unexpected error occurred',
            status: response.status,
        };

        apiState.notifyError(error);
        throw error;
    }

    private normalizeError(error: any): APIError {
        if (this.isAPIError(error)) {
            return error;
        }
        if (error instanceof DOMException && error.name === 'AbortError') {
            return {
                detail: 'Request timed out',
                status: 408
            };
        }
        return {
            detail: error instanceof Error ? error.message : 'Network error occurred',
            status: 0
        };
    }

    private isAPIError(error: any): error is APIError {
        return error && typeof error === 'object' && 'detail' in error;
    }

    // Public methods

    public get<T>(endpoint: string, params?: RequestConfig['params'], init?: RequestInit): Promise<T> {
        return this.request<T>(endpoint, { ...init, method: 'GET', params });
    }

    public post<T>(endpoint: string, body?: any, init?: RequestInit): Promise<T> {
        const config: RequestConfig = { ...init, method: 'POST' };
        if (body !== undefined) {
            config.body = JSON.stringify(body);
        }
        return this.request<T>(endpoint, config);
    }

    public put<T>(endpoint: string, body?: any, init?: RequestInit): Promise<T> {
        const config: RequestConfig = { ...init, method: 'PUT' };
        if (body !== undefined) {
            config.body = JSON.stringify(body);
        }
        return this.request<T>(endpoint, config);
    }

    public delete<T>(endpoint: string, init?: RequestInit): Promise<T> {
        return this.request<T>(endpoint, { ...init, method: 'DELETE' });
    }

    // Validated methods
    public async getValidated<T>(endpoint: string, schema: z.ZodSchema<T>, params?: RequestConfig['params'], init?: RequestInit): Promise<T> {
        const raw = await this.get<unknown>(endpoint, params, init);
        if (this.shouldLogEndpoint(endpoint)) {
            await logClientEvent({
                session_id: this.getSessionIdFromParams(params),
                level: "debug",
                source: "ApiClient",
                message: "Received response for validated endpoint",
                data: {
                    endpoint,
                    type: Array.isArray(raw) ? "array" : typeof raw,
                    size: Array.isArray(raw) ? raw.length : undefined,
                },
            });
        }
        try {
            return this.validate(raw, schema);
        } catch (error) {
            if (this.shouldLogEndpoint(endpoint)) {
                await logClientEvent({
                    session_id: this.getSessionIdFromParams(params),
                    level: "error",
                    source: "ApiClient",
                    message: "Schema validation failed for endpoint",
                    data: {
                        endpoint,
                        error: error instanceof Error ? error.message : String(error),
                    },
                });
            }
            throw error;
        }
    }

    public async postValidated<T>(endpoint: string, schema: z.ZodSchema<T>, body?: any, init?: RequestInit): Promise<T> {
        const raw = await this.post<unknown>(endpoint, body, init);
        return this.validate(raw, schema);
    }

    public async putValidated<T>(endpoint: string, schema: z.ZodSchema<T>, body?: any, init?: RequestInit): Promise<T> {
        const raw = await this.put<unknown>(endpoint, body, init);
        return this.validate(raw, schema);
    }

    private validate<T>(data: unknown, schema: z.ZodSchema<T>): T {
        const result = schema.safeParse(data);
        if (result.success) {
            return result.data;
        }

        // Format errors more concisely
        const errorMessages = result.error.issues.map((e: z.ZodIssue) => {
            const path = e.path.length > 0 ? `${e.path.join('.')}` : 'root';
            return `${path}: ${e.message}`;
        });

        // Limit to first 3 errors to avoid overwhelming the user
        const displayErrors = errorMessages.slice(0, 3);
        const moreCount = errorMessages.length - 3;
        const detail = displayErrors.join('; ') + (moreCount > 0 ? ` (+${moreCount} more)` : '');

        const error: APIError = {
            detail: `Validation failed: ${detail}`,
            status: 422,
        };

        // Also log full error to console for debugging
        console.error('[API Validation Error]', result.error);

        apiState.notifyError(error);
        throw error;
    }
}

export const apiClient = new ApiClient();
