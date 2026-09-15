import {
  History,
  Home,
  PlusCircle,
  Settings,
  UserRound,
} from "lucide-react";
import type { HealthRecord, NavItem } from "./types";

export const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "profile", label: "Health Profile", icon: UserRound },
  { id: "capture", label: "Log Event", icon: PlusCircle },
  { id: "timeline", label: "Health History", icon: History },
  { id: "settings", label: "Settings", icon: Settings },
];

export const starterRecords: HealthRecord[] = [
  {
    id: "BTR-2409-0181",
    type: "SYMPTOM",
    title: "Mild temple headache",
    eventDate: "2026-09-13T19:30:00.000Z",
    severity: "Mild",
    symptoms: ["Temple pressure", "Head pain", "Evening onset"],
    treatment: "Rested in a dark room and increased water intake.",
    notes:
      "Patient reported a slight headache since yesterday evening. No diagnosis inferred.",
    source: "Voice",
    status: "Confirmed",
  },
  {
    id: "BTR-2409-0174",
    type: "SYMPTOM",
    title: "Dizziness after standing",
    eventDate: "2026-09-14T08:15:00.000Z",
    severity: "Moderate",
    symptoms: ["Lightheadedness", "Standing trigger", "Morning event"],
    treatment: "Sat down and drank water.",
    notes:
      "Orthostatic pattern observed from patient language. Track hydration and recurrence.",
    source: "Typed",
    status: "Needs monitoring",
  },
  {
    id: "BTR-2409-0163",
    type: "DIGESTIVE",
    title: "Frequent stool change",
    eventDate: "2026-09-11T11:40:00.000Z",
    severity: "Not specified",
    symptoms: ["Frequent stool", "Digestive change", "Bristol type 4"],
    treatment: "Logged hydration and meals.",
    notes: "Digestive observation recorded for doctor review context.",
    source: "Preset",
    status: "Confirmed",
  },
  {
    id: "BTR-2409-0149",
    type: "MEDICATION",
    title: "Acetaminophen taken",
    eventDate: "2026-09-09T21:05:00.000Z",
    severity: "Not specified",
    symptoms: ["Headache relief attempt"],
    treatment: "Acetaminophen, patient-entered dose pending confirmation.",
    notes: "Medication event saved with patient supplied context only.",
    source: "Typed",
    status: "Prepared",
  },
];

export const presets = [
  "Headaches / head pain",
  "Dizziness / lightheaded",
  "Digestive changes",
  "Medication taken",
  "Sleep disruption",
  "Hydration change",
];

export const companionTips = [
  {
    title: "Hydration check",
    body: "Record fluids over the next few hours and note whether standing-related dizziness changes.",
  },
  {
    title: "Rest environment",
    body: "For headache tracking, log light sensitivity, sound sensitivity, rest duration, and any relief pattern.",
  },
  {
    title: "Progression watch",
    body: "Mark whether symptoms improve, stay stable, or worsen over the next 24 to 48 hours.",
  },
];
