import { AchievementPlayerType } from "api/types/AchievementPlayerType.ts";

export type AchievementCompletionType = {
  time_completed: string;
  time_placement: number;
  player: AchievementPlayerType;
  placement?: AchievementCompletionPlacementType | null;
  extra: Record<string, any>;
};

export type AnonymousAchievementCompletionType = {
  placement: AchievementCompletionPlacementType;
};

export type AchievementCompletionPlacementType = {
  value: number;
  place: number;
};

export type AchievementCompletionExtendedType = {
  achievement_name: string;
  achievement_tags: string;
  placement: AchievementCompletionPlacementType | null;
  completions: number;
} & AchievementCompletionType;
