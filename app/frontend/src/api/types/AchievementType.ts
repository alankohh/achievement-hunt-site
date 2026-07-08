import {
  AchievementCompletionType,
  AnonymousAchievementCompletionType,
} from "api/types/AchievementCompletionType.ts";
import { AchievementCommentType } from "api/types/AchievementCommentType.ts";
import { UserType } from "api/types/UserType.ts";
import { BeatmapConnectionType } from "api/types/BeatmapConnectionType.ts";
import { AchievementBatchType } from "api/types/AchievementBatchType.ts";
import { SolutionAlgorithmData } from "util/solutionAlgorithm.ts";
import { AchievementRatingType } from "api/types/AchievementRatingType.ts";

export type AchievementType = {
  id: number;
  name: string;
  description: string;
  audio: string;
  beatmaps: BeatmapConnectionType[];
  tags: string;
  created_at: string;
  last_edited_at: string;
  batch: AchievementBatchType | null;
  worth_points: boolean;
  solution_parts: number;
  avg_difficulty_rating: number | null;
  solution?: string;
  creator?: { id: number; username: string } | null;
};

export type AchievementExtendedType = {
  completion_count: number;
  completions: (
    | AchievementCompletionType
    | AnonymousAchievementCompletionType
  )[];
} & AchievementType;

export type CompletionProgressType =
  | "incomplete"
  | "complete"
  | "partial"
  | "none";
export type CompletedAchievementType = AchievementExtendedType & {
  completed: CompletionProgressType;
  points: number | null;
  isScoreApproximated: boolean;
};

export type StaffAchievementType = {
  solution: string;
  comments: AchievementCommentType[];
  upvotes: number;
  avg_difficulty_rating: number | null;
  avg_quality_rating: number | null;
  user_rating: AchievementRatingType | null;
  creator: UserType | null;
  solution_algorithm: SolutionAlgorithmData;
  algorithm_enabled: boolean;
  staff_solved: boolean;
} & AchievementType;

export const TAG_DESCRIPTIONS = {
  secret: "The solution to this achievement is not explicitly stated.",
  chat: "Completing this achievement involves sending an in-game DM to Sheppsu as part of the solution (messages checked by the server).",
  competition:
    "This achievement has a leaderboard and points are awarded based on your placement. Completions can be overruled with better ones by anyone on your team.",
  expert: "This achievement cannot be completed with the use of NF.",
  gimmick:
    "Completing this achievement requires a gimmick skill or non-conventional way of playing.",
  knowledge:
    "Finding the solution requires some non-basic level of knowledge about osu, osu history, or related (or requires research).",
  lazer:
    "This achievement must be completed on the lazer client or does not work on stable for all applicable modes of the achievement.",
  stable:
    "This achievement must be completed on the stable client or does not work on lazer for all applicable modes of the achievement.",
  math: "Finding the solution involves at least somewhat heavy use of math.",
  puzzle:
    "The achievement involves some kind of puzzle (e.g. sudoku, logic puzzle).",
  skill:
    "Completing the achievement involves a decent level of skill (this tag is somewhat subjective).",
  trivia:
    "This achievement incorporates some trivia-style general knowledge unrelated to osu!.",
  password:
    "Completing this achievement requires inputting the correct password. Find the input box on the achievement.",
  score:
    "Completing this achievement requires submitting at least one score.",
  "multi-part":
    "This achievement has multiple parts that can be completed in any order. The achievement will glow yellow while partially completed.",
};
export const OTHER_DESCRIPTIONS = {
  mode: {
    any: "This achievement is completable in any game mode.",
    standard:
      "This achievement must be completed in standard or is related to the standard game mode.",
    catch:
      "This achievement must be completed in catch or is related to the catch game mode.",
    taiko:
      "This achievement must be completed in taiko or is related to the taiko game mode.",
    mania:
      "This achievement must be completed in mania or is related to the mania game mode.",
    multiple:
      "This achievement is possible in, or requires, multiple game modes, but not necessarily all of them.",
  },
  completions:
    "This shows the number of teams that have completed the achievement. This number updates infrequently by design.",
  difficulty: "This shows the average difficulty rated by the staff out of 10.",
};
