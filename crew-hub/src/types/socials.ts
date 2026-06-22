export const SOCIAL_PLATFORMS = [
  { id: "instagram", name: "Instagram", sortOrder: 1 },
  { id: "facebook", name: "Facebook", sortOrder: 2 },
  { id: "linkedin", name: "LinkedIn", sortOrder: 3 },
] as const;

export type SocialPlatformId = (typeof SOCIAL_PLATFORMS)[number]["id"];

export type SocialPost = {
  id: string;
  platformId: SocialPlatformId;
  postedAt: string;
  note?: string;
  loggedBy: string;
  createdAt: string;
};
