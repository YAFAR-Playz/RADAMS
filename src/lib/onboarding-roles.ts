import type { Role } from "@/lib/roles";

// Roles with tour content built so far — extended as each role's step list
// ships (see src/lib/onboarding-tours). Owner has no org of its own to
// meaningfully clone into and is out of scope for this feature.
export const ONBOARDING_TOUR_ROLES: Role[] = ["head", "assistant", "finance", "registration", "hr", "admin"];

export function roleHasOnboardingTour(role: Role): boolean {
  return ONBOARDING_TOUR_ROLES.includes(role);
}
