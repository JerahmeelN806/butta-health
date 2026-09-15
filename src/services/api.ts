import type {
  AiConsent,
  AiExtractionResponse,
  Attachment,
  DailyCheckIn,
  DashboardSnapshot,
  ExtractedRecord,
  HealthRecord,
  NotificationPreferences,
  RecordType,
} from "../types";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api").replace(/\/$/, "");

export type AppUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt?: string;
  updatedAt?: string;
  demo?: boolean;
};

export type HealthProfileInput = {
  dateOfBirth: string | null;
  sex: string | null;
  bloodGroup: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | null;
  allergies: string[];
  existingConditions: string[];
  currentMedications: string[];
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
};

export type HealthProfile = HealthProfileInput & {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type HealthEventFilters = {
  type?: RecordType;
  severity?: HealthRecord["severity"];
  status?: HealthRecord["status"];
  from?: string;
  to?: string;
  search?: string;
  cursor?: string;
  limit?: number;
};

type SuccessResponse<T> = { success: true; data: T };
type ErrorResponse = { success: false; error?: { message?: string } };

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Paths where a 401 is an expected, routine outcome (not logged in yet, bad
// credentials) rather than a sign that a previously-valid session just died.
const AUTH_BOOTSTRAP_PATHS = new Set(["/auth/login", "/auth/register", "/auth/me", "/auth/logout"]);

let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

function reportIfSessionExpired(path: string, status: number) {
  if (status === 401 && !AUTH_BOOTSTRAP_PATHS.has(path)) {
    onSessionExpired?.();
  }
}

async function request<T>(path: string, options: NonNullable<Parameters<typeof fetch>[1]> = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError("The Butta Health API is not available locally.", 0);
  }

  const payload = (await response.json().catch(() => null)) as SuccessResponse<T> | ErrorResponse | null;
  if (!response.ok || !payload || !payload.success) {
    reportIfSessionExpired(path, response.status);
    const message = payload && !payload.success ? payload.error?.message : undefined;
    throw new ApiError(message || "We could not complete that request.", response.status);
  }

  return payload.data;
}

async function requestForm<T>(path: string, formData: FormData): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
  } catch {
    throw new ApiError("The Butta Health API is not available locally.", 0);
  }

  const payload = (await response.json().catch(() => null)) as SuccessResponse<T> | ErrorResponse | null;
  if (!response.ok || !payload || !payload.success) {
    reportIfSessionExpired(path, response.status);
    const message = payload && !payload.success ? payload.error?.message : undefined;
    throw new ApiError(message || "We could not complete that request.", response.status);
  }

  return payload.data;
}

export const buttaApi = {
  register(input: { firstName: string; lastName: string; email: string; password: string }) {
    return request<{ user: AppUser }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  login(input: { email: string; password: string }) {
    return request<{ user: AppUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  me() {
    return request<{ user: AppUser }>("/auth/me");
  },

  getProfile() {
    return request<{ profile: HealthProfile }>("/health-profile");
  },

  saveProfile(profile: HealthProfileInput) {
    return request<{ profile: HealthProfile }>("/health-profile", {
      method: "PUT",
      body: JSON.stringify(profile),
    });
  },

  getHealthEvents(filters: HealthEventFilters = {}) {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== "") query.set(key, String(value));
    });
    const suffix = query.size ? `?${query.toString()}` : "";
    return request<{ events: HealthRecord[]; nextCursor: string | null }>(`/health-events${suffix}`);
  },

  createHealthEvent(event: ExtractedRecord) {
    return request<{ healthEvent: HealthRecord }>("/health-events", {
      method: "POST",
      body: JSON.stringify(event),
    });
  },

  updateHealthEvent(id: string, event: Partial<ExtractedRecord> & { status?: HealthRecord["status"] }) {
    return request<{ healthEvent: HealthRecord }>(`/health-events/${id}`, {
      method: "PATCH",
      body: JSON.stringify(event),
    });
  },

  deleteHealthEvent(id: string) {
    return request<{ message: string }>(`/health-events/${id}`, { method: "DELETE" });
  },

  getDashboard(timezone: string) {
    return request<{ dashboard: DashboardSnapshot }>(`/dashboard?timezone=${encodeURIComponent(timezone)}`);
  },

  getTodayCheckIn(timezone: string) {
    return request<{ checkIn: DailyCheckIn }>(`/check-ins/today?timezone=${encodeURIComponent(timezone)}`);
  },

  respondToCheckIn(id: string, input: { notes: string; severity?: HealthRecord["severity"]; symptoms?: string[] }) {
    return request<{ checkIn: DailyCheckIn; healthEvent: HealthRecord }>(`/check-ins/${id}/respond`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  getNotificationPreferences() {
    return request<{ preferences: NotificationPreferences }>("/notification-preferences");
  },

  saveNotificationPreferences(preferences: NotificationPreferences) {
    const input = {
      eventReminders: preferences.eventReminders,
      weeklySummary: preferences.weeklySummary,
      dailyCheckIn: preferences.dailyCheckIn,
      checkInTime: preferences.checkInTime,
      timezone: preferences.timezone,
    };
    return request<{ preferences: NotificationPreferences }>("/notification-preferences", {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  logout() {
    return request<{ message: string }>("/auth/logout", { method: "POST" });
  },

  getAiConsent() {
    return request<{ consent: AiConsent }>("/ai-consent");
  },

  setAiConsent(granted: boolean) {
    return request<{ consent: AiConsent }>("/ai-consent", {
      method: "PUT",
      body: JSON.stringify({ granted }),
    });
  },

  extractHealthEvent(input: { observation: string; source: ExtractedRecord["source"]; symptomTags?: string[] }) {
    return request<AiExtractionResponse>("/health-events/extract", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  uploadAttachments(files: File[]) {
    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    return requestForm<{ attachments: Attachment[] }>("/attachments", form);
  },

  attachToHealthEvent(healthEventId: string, attachmentIds: string[]) {
    return request<{ attachments: Attachment[] }>(`/health-events/${healthEventId}/attachments`, {
      method: "POST",
      body: JSON.stringify({ attachmentIds }),
    });
  },
};
