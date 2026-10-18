import type { ArtisanAvailabilityStatus, ArtisanVerificationStatus } from './generated/enums';

/**
 * The signed-in artisan, as GET /artisans/me/profile answers (smart-depannage-serveur:
 * ArtisansService.getMyProfile). Written by hand, not generated: only the fields the app reads.
 * The bank details (IBAN, BIC) and the documents also travel in that answer; the app does not read
 * them and drops them on arrival with `slimProfile`, so they never sit in a screen's state. (The server
 * still sends them to their owner: slimming the route is a decision for the server, not made here.)
 */
export interface ArtisanSelf {
  id: number;
  userId: number;
  specialty: string | null;
  specialties: string[];
  yearsExperience: number;
  companyName: string | null;
  bio: string | null;
  profilePhotoUrl: string | null;
  verificationStatus: ArtisanVerificationStatus;
  availabilityStatus: ArtisanAvailabilityStatus;
  isAcceptingJobs: boolean;
  lastSeenAt: string | null;
  averageRating: number;
  ratingCount: number;
  /**
   * The jobs this artisan closed, counted on the jobs themselves. (`completedJobsCount` is a stored counter that only
   * the old manual "complete" route moves, so it is behind for jobs closed with a photo.)
   */
  completedMissions: number;
  user: {
    id: number;
    name: string | null;
    email: string;
    phone: string | null;
    latitude: number | null;
    longitude: number | null;
    /** When the account was created (an ISO date): "member since". */
    createdAt: string;
  };
  serviceZones: Array<{ id: number; label: string | null; city: string | null; radiusKm: number; isActive: boolean }>;
}

/**
 * The profile as the screens keep it: only the fields of `ArtisanSelf`, copied one by one. Whatever else the server
 * adds to that answer (the bank details, the documents, a column of tomorrow) is left behind instead of being kept
 * in memory by default.
 */
export function slimProfile(raw: ArtisanSelf): ArtisanSelf {
  return {
    id: raw.id,
    userId: raw.userId,
    specialty: raw.specialty ?? null,
    specialties: Array.isArray(raw.specialties) ? [...raw.specialties] : [],
    yearsExperience: raw.yearsExperience,
    companyName: raw.companyName ?? null,
    bio: raw.bio ?? null,
    profilePhotoUrl: raw.profilePhotoUrl ?? null,
    verificationStatus: raw.verificationStatus,
    availabilityStatus: raw.availabilityStatus,
    isAcceptingJobs: raw.isAcceptingJobs,
    lastSeenAt: raw.lastSeenAt ?? null,
    averageRating: raw.averageRating,
    ratingCount: raw.ratingCount,
    completedMissions: raw.completedMissions,
    user: {
      id: raw.user.id,
      name: raw.user.name ?? null,
      email: raw.user.email,
      phone: raw.user.phone ?? null,
      latitude: raw.user.latitude ?? null,
      longitude: raw.user.longitude ?? null,
      createdAt: raw.user.createdAt,
    },
    serviceZones: (Array.isArray(raw.serviceZones) ? raw.serviceZones : []).map((zone) => ({
      id: zone.id,
      label: zone.label ?? null,
      city: zone.city ?? null,
      radiusKm: zone.radiusKm,
      isActive: zone.isActive,
    })),
  };
}

/** What PATCH /artisans/me/online, /offline and /location answer: the profile as it is now. */
export type ArtisanAvailabilityAnswer = Pick<ArtisanSelf, 'availabilityStatus' | 'isAcceptingJobs' | 'lastSeenAt'>;

/** What POST /artisans/me/missions/:id/reject answers. */
export interface MissionRefusalAnswer {
  message: string;
  /** The job went back to the dispatcher's queue. */
  returnedToQueue: boolean;
}
