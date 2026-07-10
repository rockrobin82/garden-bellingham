import "server-only";

import type { P24Config } from "@/lib/przelewy24/config";
import {
  P24ApiError,
  P24NetworkError,
  type P24ApiResponse,
} from "@/lib/przelewy24/types";

export type P24ClientOptions = {
  apiUrl: string;
  posId: number;
  apiKey: string;
  fetch?: typeof fetch;
};

export class P24Client {
  private readonly apiUrl: string;
  private readonly posId: number;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: P24ClientOptions) {
    this.apiUrl = options.apiUrl.replace(/\/+$/, "");
    this.posId = options.posId;
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetch ?? fetch;
  }

  private buildUrl(path: string): string {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${this.apiUrl}${normalizedPath}`;
  }

  private buildAuthHeader(): string {
    const credentials = `${this.posId}:${this.apiKey}`;
    return `Basic ${Buffer.from(credentials).toString("base64")}`;
  }

  async request<T>(
    method: "GET" | "POST" | "PUT",
    path: string,
    body?: unknown,
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: this.buildAuthHeader(),
    };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    let response: Response;

    try {
      response = await this.fetchImpl(this.buildUrl(path), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      throw new P24NetworkError("Przelewy24 request failed", { cause: error });
    }

    let payload: P24ApiResponse<T> | { error?: string; message?: string };

    try {
      payload = (await response.json()) as
        | P24ApiResponse<T>
        | { error?: string; message?: string };
    } catch {
      throw new P24ApiError("Przelewy24 returned a non-JSON response", {
        statusCode: response.status,
      });
    }

    if (!response.ok) {
      const message =
        ("error" in payload && payload.error) ||
        ("message" in payload && payload.message) ||
        `Przelewy24 HTTP ${response.status}`;

      throw new P24ApiError(message, {
        statusCode: response.status,
        responseCode:
          "responseCode" in payload ? payload.responseCode : undefined,
      });
    }

    if ("responseCode" in payload && payload.responseCode !== 0) {
      throw new P24ApiError(`Przelewy24 responseCode ${payload.responseCode}`, {
        statusCode: response.status,
        responseCode: payload.responseCode,
      });
    }

    if (!("data" in payload)) {
      throw new P24ApiError("Przelewy24 response is missing data", {
        statusCode: response.status,
      });
    }

    return payload.data;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }
}

export function createP24Client(config: P24Config): P24Client {
  return new P24Client({
    apiUrl: config.apiUrl,
    posId: config.posId,
    apiKey: config.apiKey,
  });
}
