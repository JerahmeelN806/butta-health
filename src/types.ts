import type { LucideIcon } from "lucide-react";

export type RecordType = "SYMPTOM" | "MEDICATION" | "DIGESTIVE" | "DOCTOR_VISIT" | "CHECK_IN";

export type HealthRecord = {
  id: string;
  type: RecordType;
  title: string;
  eventDate: string;
  severity: "Mild" | "Moderate" | "Severe" | "Not specified";
  symptoms: string[];
  treatment: string;
  notes: string;
  source: "Voice" | "Typed" | "Preset";
  status: "Confirmed" | "Needs monitoring" | "Prepared";
};

export type ExtractedRecord = Omit<HealthRecord, "id" | "status" | "type"> & {
  type: Exclude<RecordType, "CHECK_IN">;
};

export type DoctorSummary = {
  chiefComplaint: string;
  frequency: string;
  selectedCount: number;
  records: HealthRecord[];
  generatedAt: string;
};

export type DashboardSnapshot = {
  profileCompletion: number;
  totalEvents: number;
  eventsThisMonth: number;
  monitoringCount: number;
  symptomCount: number;
  memberSince: string;
  latestEvent: HealthRecord | null;
  recentEvents: HealthRecord[];
  activity: Array<{ date: string; label: string; count: number }>;
  timezone: string;
  generatedAt: string;
};

export type DailyCheckIn = {
  id: string;
  promptType: "FIRST_ENTRY" | "DAILY_REFLECTION" | "SYMPTOM_FOLLOW_UP" | "MEDICATION_FOLLOW_UP";
  promptText: string;
  scheduledFor: string;
  respondedAt: string | null;
  healthEventId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiSafetyMetadata = {
  urgent: boolean;
  advisory: string | null;
};

export type AiExtractionResponse = {
  draft: ExtractedRecord;
  educationalContext: string[];
  safety: AiSafetyMetadata;
};

export type Attachment = {
  id: string;
  status: "PENDING" | "ATTACHED";
  originalName: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/heic";
  sizeBytes: number;
  createdAt: string;
  url: string;
};

export type AiConsent = {
  granted: boolean;
  policyVersion: string;
  grantedAt: string | null;
  revokedAt: string | null;
  updatedAt: string | null;
};

export type NotificationPreferences = {
  eventReminders: boolean;
  weeklySummary: boolean;
  dailyCheckIn: boolean;
  checkInTime: string;
  timezone: string;
  createdAt?: string;
  updatedAt?: string;
};

export type NavItem = {
  id: ViewId;
  label: string;
  icon: LucideIcon;
};

export type ViewId =
  | "dashboard"
  | "profile"
  | "capture"
  | "timeline"
  | "settings"
  | "companion"
  | "doctor-prep"
  | "doctor-summary";
