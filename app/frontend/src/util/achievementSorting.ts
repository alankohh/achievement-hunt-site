import {
  AchievementExtendedType,
  AchievementType,
  CompletedAchievementType,
  StaffAchievementType,
} from "api/types/AchievementType.ts";
import {
  AchievementCompletionType,
  AnonymousAchievementCompletionType,
} from "api/types/AchievementCompletionType.ts";
import { AchievementTeamExtendedType } from "api/types/AchievementTeamType.ts";
import { getMyCompletion, sortedConcat } from "util/helperFunctions.ts";
import {
  BoolNavItem,
  NavItems,
  NavRowItems,
} from "components/achievements/AchievementNavigationBar.tsx";
import { AchievementBatchType } from "api/types/AchievementBatchType.ts";
import { UserType } from "api/types/UserType.ts";

function intersects(a: string[], b: string[]): boolean {
  for (const item of b) {
    if (a.includes(item)) {
      return true;
    }
  }

  return false;
}

function matchesSearch(
  achievement: AchievementType | StaffAchievementType,
  searchFilter: string[],
) {
  for (const word of searchFilter) {
    if (
      word != "" &&
      !achievement.name.toLowerCase().includes(word) &&
      !achievement.description.toLowerCase().includes(word) &&
      achievement.beatmaps.filter(
        (bm) =>
          bm.info.artist.toLowerCase().includes(word) ||
          bm.info.title.toLowerCase().includes(word) ||
          bm.info.version.toLowerCase().includes(word),
      ).length == 0 &&
      !(
        "creator" in achievement &&
        achievement.creator !== null &&
        achievement.creator!.username.toLowerCase().includes(word)
      )
    )
      return false;
  }

  return true;
}

function matchesMode(
  achievement: AchievementType,
  modes: NavRowItems,
): boolean {
  // if nothing is checked
  if (modes.items.filter((item) => item.active).length === 0) return true;

  for (const tag of achievement.tags.split(",")) {
    if (tag.startsWith("mode-"))
      // corresponding mode tag is active
      return modes.items[["o", "t", "m", "f"].indexOf(tag[tag.length - 1]) + 1]
        .active;
  }

  // any mode tag is active
  return modes.items[0].active;
}

function checkFilterCondition(
  achievement: AchievementType,
  user: UserType | null,
  boolName: string,
): boolean {
  switch (boolName) {
    case "my achievements": // staff page
      return user!.id === achievement.creator?.id;
    case "solved": // staff page
      return (achievement as StaffAchievementType).staff_solved;
    case "completed": // achievements page
      return "completed" in achievement
        ? (achievement as CompletedAchievementType).completed === "complete"
        : false;
    case "upvoted": // staff page
      return (
        user!.id === achievement.creator?.id ||
        ((achievement as StaffAchievementType).user_rating?.upvoted ?? false)
      );
    case "rated difficulty": // staff page
      return (
        user!.id === achievement.creator?.id ||
        ((achievement as StaffAchievementType).user_rating?.difficulty ?? 0) !==
          0
      );
    case "rated quality": // staff page
      return (
        user!.id === achievement.creator?.id ||
        ((achievement as StaffAchievementType).user_rating?.quality ?? 0) !== 0
      );
    default:
      throw new Error(`Invalid achievement filter: ${boolName}`);
  }
}

function matchFilters(
  achievement: AchievementType,
  user: UserType | null,
  bools: BoolNavItem[],
): boolean {
  for (const bool of bools) {
    if (!(checkFilterCondition(achievement, user, bool.label) === bool.value)) {
      return false;
    }
  }

  return true;
}

function getGrouping(
  sort: string,
  myTeam: AchievementTeamExtendedType | null,
  achievements: AchievementType[],
): [
  string[],
  (
    | ((a: CompletedAchievementType) => string)
    | ((a: StaffAchievementType) => string)
  ),
  (
    | ((a: CompletedAchievementType, b: CompletedAchievementType) => number)
    | ((a: StaffAchievementType, b: StaffAchievementType) => number)
  ),
] {
  const getTimestamp = (
    cs: (AchievementCompletionType | AnonymousAchievementCompletionType)[],
  ): number => {
    const c = getMyCompletion(cs, myTeam);
    return c === null ? 0 : Date.parse(c.time_completed);
  };

  const getTimeGroup = (a: CompletedAchievementType): string => {
    const timestamp = getTimestamp(a.completions);
    const timeAgo = (Date.now() - timestamp) / 1000;
    if (timeAgo < 60 * 60) return "Past hour";
    else if (timeAgo < 60 * 60 * 24) return "Past 24 hours";
    else if (timeAgo < 60 * 60 * 24 * 3) return "Past 3 days";
    else if (timeAgo < 60 * 60 * 24 * 7) return "Past week";
    else return "Over a week ago";
  };

  const getLastActive = (a: StaffAchievementType): number => {
    return Math.max(
      Date.parse(a.last_edited_at),
      ...a.comments.map((c) => Date.parse(c.posted_at)),
    );
  };

  switch (sort) {
    case "completions":
      return [
        ["1+ completion(s)", "No completions"],
        (a: CompletedAchievementType) =>
          a.completion_count > 0 ? "1+ completion(s)" : "No completions",
        (a: CompletedAchievementType, b: CompletedAchievementType) =>
          a.completion_count - b.completion_count,
      ];
    case "player":
      return [
        ["*", "Not completed"],
        (a: CompletedAchievementType) =>
          a.completed
            ? getMyCompletion(a.completions, myTeam)!.player.user.username
            : "Not completed",
        (a: CompletedAchievementType, b: CompletedAchievementType) =>
          b.name.localeCompare(a.name),
      ];
    case "date completed":
      return [
        [
          "Past hour",
          "Past 24 hours",
          "Past 3 days",
          "Past week",
          "Over a week ago",
          "Not completed",
        ],
        (a: CompletedAchievementType) =>
          a.completed ? getTimeGroup(a) : "Not completed",
        (a: CompletedAchievementType, b: CompletedAchievementType) =>
          getTimestamp(a.completions) - getTimestamp(b.completions),
      ];
    case "release": {
      let batches: AchievementBatchType[] = [];
      for (const achievement of achievements) {
        if (batches.findIndex((b) => b.id == achievement.batch!.id) === -1)
          batches = sortedConcat(
            batches,
            achievement.batch!,
            (a, b) => Date.parse(b.release_time) - Date.parse(a.release_time),
          );
      }

      const batchIds = batches.map((b) => b.id);

      return [
        batchIds.map((_, i) => `Release ${batchIds.length - i}`),
        (a: CompletedAchievementType) =>
          `Release ${batchIds.length - batchIds.indexOf(a.batch!.id)}`,
        (a: CompletedAchievementType, b: CompletedAchievementType) =>
          a.id - b.id,
      ];
    }
    case "votes":
      return [
        ["*"],
        () => "values",
        (a: StaffAchievementType, b: StaffAchievementType) =>
          a.upvotes - b.upvotes,
      ];
    case "creation time":
      return [
        ["*"],
        () => "values",
        (a: AchievementType, b: AchievementType) =>
          Date.parse(a.created_at) - Date.parse(b.created_at),
      ];
    case "last active":
      return [
        ["*"],
        () => "values",
        (a: StaffAchievementType, b: StaffAchievementType) =>
          getLastActive(a) - getLastActive(b),
      ];
    case "difficulty":
      return [
        ["*"],
        () => "values",
        (a: StaffAchievementType, b: StaffAchievementType) =>
          (a.avg_difficulty_rating ?? 0) - (b.avg_difficulty_rating ?? 0),
      ];
    case "quality":
      return [
        ["*"],
        () => "values",
        (a: StaffAchievementType, b: StaffAchievementType) =>
          (a.avg_quality_rating ?? 0) - (b.avg_quality_rating ?? 0),
      ];
    default:
      throw new Error(
        "unexpected sort type, was there a typo? missing a sort type?",
      );
  }
}

export function getSortedAchievements<T extends AchievementType>(
  achievements: T[],
  filters: NavItems,
  searchText: string,
  hideCompletedAchievements: boolean = false,
  team: AchievementTeamExtendedType | null = null,
  user: UserType | null,
): { [_k: string]: T[] } {
  const activeTags = filters.rows.tags.items
    .filter((item) => item.active)
    .map((item) => item.label.toLowerCase());
  const searchFilter = searchText.toLowerCase().split(" ");
  const sort = filters.rows.sort.items.filter((i) => i.active)[0].label;
  const activeFilters = filters.rows.filters.items.filter((b) => b.active);

  const [groupSort, groupFunc, sortFunc] = getGrouping(
    sort,
    team,
    achievements,
  );
  const sortedAchievements: { [key: string]: T[] } = {};

  for (const achievement of achievements) {
    if (!matchFilters(achievement, user, activeFilters)) continue;
    if (!matchesMode(achievement, filters.rows.mode)) continue;
    if (!matchesSearch(achievement, searchFilter)) continue;

    if (
      activeTags.length != 0 &&
      !intersects(
        activeTags,
        achievement.tags
          .toLowerCase()
          .split(",")
          .map((t) => t.trim()),
      )
    )
      continue;

    if (
      hideCompletedAchievements &&
      "completed" in achievement &&
      achievement.completed
    )
      continue;

    // get group to put this achievement into
    // @ts-ignore
    const group = groupFunc(achievement);
    if (!(group in sortedAchievements)) sortedAchievements[group] = [];

    // create sort function based on current sort direction
    const directionalSortFunc: (a: T, b: T) => boolean =
      filters.rows.sort.sort === "desc"
        ? // @ts-ignore
          (a, b) => sortFunc(a, b) < 0
        : // @ts-ignore
          (a, b) => sortFunc(a, b) > 0;

    // insert achievements into groups sorted
    let i = 0;
    const items = sortedAchievements[group];
    while (i < items.length && directionalSortFunc(achievement, items[i])) {
      i += 1;
    }
    sortedAchievements[group] = items
      .slice(0, i)
      .concat([achievement], items.slice(i, items.length));
  }

  const getGroupIndex = (group: string) => {
    let i = groupSort.indexOf(group);
    return i == -1 ? groupSort.indexOf("*") : i;
  };

  const sortGroups = (g1: string, g2: string) => {
    const i1 = getGroupIndex(g1);
    const i2 = getGroupIndex(g2);
    if (filters.rows.sort.sort === "desc")
      return i1 == i2 ? g1.localeCompare(g2) : i1 - i2;
    return i1 == i2 ? g2.localeCompare(g1) : i2 - i1;
  };

  return Object.fromEntries(
    Object.keys(sortedAchievements)
      .sort(sortGroups)
      .map((k) => [k, sortedAchievements[k]]),
  );
}
