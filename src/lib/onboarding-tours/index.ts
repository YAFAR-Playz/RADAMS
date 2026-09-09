import type { Role } from "@/lib/roles";
import type { TourStep } from "./types";
import { HEAD_TOUR } from "./head";
import { ASSISTANT_TOUR } from "./assistant";
import { FINANCE_TOUR } from "./finance";
import { REGISTRATION_TOUR } from "./registration";
import { HR_TOUR } from "./hr";
import { ADMIN_TOUR } from "./admin";

const TOURS: Partial<Record<Role, TourStep[]>> = {
  head: HEAD_TOUR,
  assistant: ASSISTANT_TOUR,
  finance: FINANCE_TOUR,
  registration: REGISTRATION_TOUR,
  hr: HR_TOUR,
  admin: ADMIN_TOUR,
};

export function getTourSteps(role: Role): TourStep[] {
  return TOURS[role] ?? [];
}

export type { TourStep };
