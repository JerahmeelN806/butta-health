import { starterRecords } from "../data";
import type { DailyCheckIn, DoctorSummary, ExtractedRecord, HealthRecord } from "../types";
import { DEMO_CHECK_IN_KEY, DEMO_EVENTS_KEY } from "./demoStorage";

const delay = (ms = 400) => new Promise((resolve) => window.setTimeout(resolve, ms));

function readRecords(): HealthRecord[] {
  const raw = window.localStorage.getItem(DEMO_EVENTS_KEY);
  if (!raw) {
    window.localStorage.setItem(DEMO_EVENTS_KEY, JSON.stringify(starterRecords));
    return starterRecords;
  }

  try {
    return JSON.parse(raw) as HealthRecord[];
  } catch {
    window.localStorage.setItem(DEMO_EVENTS_KEY, JSON.stringify(starterRecords));
    return starterRecords;
  }
}

function writeRecords(records: HealthRecord[]) {
  window.localStorage.setItem(DEMO_EVENTS_KEY, JSON.stringify(records));
}

function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function parseObservation(
  input: string,
  source: ExtractedRecord["source"],
  symptomTags: string[] = [],
): ExtractedRecord {
  const text = input.trim();
  const lower = text.toLowerCase();

  const digestive = /(stool|digest|nausea|stomach|bowel|diarrhea|constipat)/.test(lower);
  const medication = /(took|taken|medication|dose|pill|tablet|acetaminophen|ibuprofen)/.test(lower);
  const dizziness = /(dizz|lightheaded|standing|faint)/.test(lower);
  const headache = /(headache|head pain|temple|migraine)/.test(lower);
  const severe = /(severe|intense|worst|sharp|unable)/.test(lower);
  const moderate = /(moderate|dizzy|persistent|recurring|again)/.test(lower);

  const type = medication ? "MEDICATION" : digestive ? "DIGESTIVE" : "SYMPTOM";
  const detectedSymptoms = [
    headache && "Head pain",
    dizziness && "Lightheadedness",
    digestive && "Digestive change",
    medication && "Medication event",
    /(yesterday|last night|evening)/.test(lower) && "Delayed onset",
    /(morning|today)/.test(lower) && "Recent event",
  ].filter(Boolean) as string[];
  const symptoms = [...new Set([...symptomTags, ...detectedSymptoms])];

  const title =
    medication
      ? "Medication logged"
      : digestive
        ? "Digestive observation"
        : headache && dizziness
          ? "Headache with standing dizziness"
          : headache
            ? "Headache observation"
            : dizziness
              ? "Dizziness observation"
              : titleCase(text.split(".")[0]?.slice(0, 48) || "Patient observation");

  return {
    type,
    title,
    eventDate: new Date().toISOString(),
    severity: severe ? "Severe" : moderate ? "Moderate" : headache || dizziness ? "Mild" : "Not specified",
    symptoms: symptoms.length ? symptoms : ["Patient-reported observation"],
    treatment: medication ? "Medication details pending patient confirmation." : "No treatment confirmed yet.",
    notes: text,
    source,
  };
}

export function buildDoctorSummary(records: HealthRecord[], recordIds: string[]): DoctorSummary {
  const selectedRecords = recordIds.length
    ? records.filter((record) => recordIds.includes(record.id))
    : records.slice(0, 4);
  const symptomRecords = selectedRecords.filter((record) => record.type === "SYMPTOM");
  const topTitle = symptomRecords[0]?.title || selectedRecords[0]?.title || "Longitudinal health review";

  return {
    chiefComplaint: topTitle,
    frequency: `${symptomRecords.length} symptom records selected from ${selectedRecords.length} total entries`,
    selectedCount: selectedRecords.length,
    records: selectedRecords,
    generatedAt: new Date().toISOString(),
  };
}

export const mockBackend = {
  async getRecords() {
    await delay();
    return readRecords().sort(
      (a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime(),
    );
  },

  async createRecord(payload: Omit<HealthRecord, "id" | "status">) {
    await delay();

    if (!payload.title || !payload.notes) {
      throw new Error("400: title and notes are required");
    }

    const record: HealthRecord = {
      ...payload,
      id: `BTR-${new Date().getFullYear().toString().slice(2)}${String(new Date().getMonth() + 1).padStart(2, "0")}-${Math.floor(
        1000 + Math.random() * 8999,
      )}`,
      status: payload.severity === "Severe" ? "Needs monitoring" : "Confirmed",
    };

    const next = [record, ...readRecords()];
    writeRecords(next);
    return record;
  },

  async getDoctorSummary(recordIds: string[]): Promise<DoctorSummary> {
    await delay();
    return buildDoctorSummary(readRecords(), recordIds);
  },

  async getTodayCheckIn(): Promise<DailyCheckIn> {
    await delay(180);
    const current = new Date();
    const today = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
    const stored = window.localStorage.getItem(DEMO_CHECK_IN_KEY);
    if (stored) {
      try {
        const checkIn = JSON.parse(stored) as DailyCheckIn;
        if (checkIn.scheduledFor === today) return checkIn;
      } catch {
        window.localStorage.removeItem(DEMO_CHECK_IN_KEY);
      }
    }

    const now = new Date().toISOString();
    const checkIn: DailyCheckIn = {
      id: `demo-check-in-${today}`,
      promptType: "DAILY_REFLECTION",
      promptText: "What has changed in how you feel since your last health entry?",
      scheduledFor: today,
      respondedAt: null,
      healthEventId: null,
      createdAt: now,
      updatedAt: now,
    };
    window.localStorage.setItem(DEMO_CHECK_IN_KEY, JSON.stringify(checkIn));
    return checkIn;
  },

  async respondToCheckIn(checkIn: DailyCheckIn, notes: string) {
    const healthEvent = await this.createRecord({
      type: "CHECK_IN",
      title: "Daily health check-in",
      eventDate: new Date().toISOString(),
      severity: "Not specified",
      symptoms: [],
      treatment: "",
      notes,
      source: "Typed",
    });
    const updated = {
      ...checkIn,
      respondedAt: new Date().toISOString(),
      healthEventId: healthEvent.id,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(DEMO_CHECK_IN_KEY, JSON.stringify(updated));
    return { checkIn: updated, healthEvent };
  },
};
