import {
  AchievementTeamExtendedType,
  AchievementTeamType,
} from "api/types/AchievementTeamType.ts";
import {
  AchievementCompletionType,
  AnonymousAchievementCompletionType,
} from "api/types/AchievementCompletionType.ts";

export function toTitleCase(str: string) {
  switch (str) {
    case "pfc":
      return "PFC";
    case "pp":
      return "PP";
    default:
      return str.toLowerCase().replace(/\b\w/g, (s) => s.toUpperCase());
  }
}

export function timeAgo(
  timestamp: string | number,
  upperBound: number | null = null,
  suffix: string = "ago",
) {
  const times: [number, string][] = [
    [60, "minute"],
    [60, "hour"],
    [24, "day"],
  ];
  if (upperBound === null) {
    upperBound = Date.now();
  }
  const completion =
    typeof timestamp === "string" ? Date.parse(timestamp) : timestamp;

  let leftover1 = Math.round((upperBound - completion) / 1000);
  let label1 = "second";
  let leftover2: number | null = null;
  let label2: string | null = null;
  for (const [div, label] of times) {
    if (leftover1 < div) {
      break;
    }

    leftover2 = leftover1 % div;
    label2 = label1;
    leftover1 = Math.floor(leftover1 / div);
    label1 = label;
  }

  if (leftover1 !== 1) {
    label1 += "s";
  }

  if (leftover2 === null) {
    return `${leftover1} ${label1} ${suffix}`;
  }

  if (leftover2 !== 1) {
    label2 += "s";
  }

  return `${leftover1} ${label1} ${leftover2} ${label2} ${suffix}`;
}

export function dateToText(timestamp: string) {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const date = new Date(Date.parse(timestamp));
  return `${months[date.getUTCMonth()]} ${date.getUTCDate()} (${date.getUTCHours().toString().padStart(2, "0")}:${date.getUTCMinutes().toString().padStart(2, "0")} UTC)`;
}

export function getMyTeam(
  userId: number | undefined,
  teams?: Array<AchievementTeamExtendedType | AchievementTeamType>,
): AchievementTeamExtendedType | null {
  if (userId === undefined) {
    return null;
  }

  if (teams !== undefined)
    for (const team of teams) {
      if ("players" in team) {
        for (const player of team.players) {
          if (player.user.id === userId) {
            return team as AchievementTeamExtendedType;
          }
        }
      }
    }

  return null;
}

export function getMyCompletion(
  cs: (AchievementCompletionType | AnonymousAchievementCompletionType)[],
  myTeam: AchievementTeamExtendedType | null,
) {
  if (myTeam === null) return null;

  const playerIds = myTeam.players.map((p) => p.user.id);

  for (const c of cs) {
    if ("player" in c && playerIds.includes(c.player.user.id)) {
      return c;
    }
  }

  return null;
}

export const scoringFuncs = (() => {
  const c0 = -Math.atanh(0.7);
  const c1 = Math.atanh(0.97);

  const a = (x: number) => (1 - Math.tanh(x)) / 2;
  const b = (x: number) => (a((c1 - c0) * x + c0) - a(c1)) / (a(c0) - a(c1));
  const f = (completions: number, teams: number) =>
    10 + 90 * Math.pow(b((completions - 1) / (teams - 1)), 2);
  const g = (timeBucket: number, completions: number, teams: number) =>
    10 +
    20 * Math.pow(b((timeBucket - 1) / (teams - 1)), 2) +
    70 * Math.pow(b((completions - 1) / (teams - 1)), 2);
  const h = (placement: number, teams: number) =>
    10 + 90 * Math.pow(b((placement - 1) / (teams - 1)), 3);
  const p = (completions: number, teams: number) =>
    Math.round(Math.max(f(completions, teams), 10));
  const p_s = (timeBucket: number, completions: number, teams: number) =>
    Math.round(Math.max(g(timeBucket, completions, teams), 10));
  const p_c = (placement: number, teams: number) =>
    Math.round(Math.max(h(placement, teams), 10));

  return {
    p,
    p_s,
    p_c,
  };
})();

export function calculateScore(
  teams: number,
  completions: number,
  placement: number, // time or competition placement
  isSecret: boolean,
  isCompetition: boolean,
) {
  if (teams <= 1) return 100;

  if (isCompetition) {
    return scoringFuncs.p_c(placement, teams);
  }

  completions = Math.max(completions, placement);

  if (isSecret) {
    return scoringFuncs.p_s(placement, completions, teams);
  }

  return scoringFuncs.p(completions, teams);
}

export function getCompetitionScorings(teams: number): number[] {
  const scorings = [];
  for (let i = 1; i <= teams; i++) {
    scorings.push(scoringFuncs.p_c(i, teams));
  }
  return scorings;
}

export function parseMeaningfulTags(tagsString: string): boolean[] {
  const tags = tagsString
    .toLowerCase()
    .split(",")
    .map((s) => s.trim());
  const isCompetition = tags.includes("competition");
  const isSecret = tags.includes("secret");
  return [isCompetition, isSecret];
}

export function* cleanTags(tags: string) {
  for (let tag of tags.split(",")) {
    tag = tag.trim().toLowerCase();
    if (tag === "") {
      continue;
    }

    yield tag;
  }
}

export const MODE_MAP = {
  "mode-o": "standard",
  "mode-t": "taiko",
  "mode-f": "catch",
  "mode-m": "mania",
  "mode-u": "multiple",
};

export function parseTags(tags: string, includeMode: boolean = true): string[] {
  let mode: string | null = null;
  const filteredTags: string[] = [];
  for (let tag of cleanTags(tags)) {
    if (tag.startsWith("mode-")) {
      // @ts-ignore: type
      mode = MODE_MAP[tag];
      continue;
    }

    if (filteredTags.includes(tag)) {
      continue;
    }

    filteredTags.push(tag);
  }

  if (!includeMode) {
    return filteredTags;
  }

  return [`Mode: ${mode ?? "any"}`].concat(
    filteredTags.sort((a, b) => a.localeCompare(b)),
  );
}

export function parseMode(tags: string): keyof typeof MODE_MAP | "any" {
  for (const tag of cleanTags(tags)) {
    if (tag.startsWith("mode-")) {
      // @ts-ignore: type
      return tag;
    }
  }

  return "any";
}

export function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function sortedConcat<T>(
  arr: T[],
  item: T,
  compFunc: (a: T, b: T) => number,
): T[] {
  for (const [i, existingItem] of arr.entries()) {
    const comp = compFunc(existingItem, item);
    if (comp === 0) return arr;

    if (comp > 0) {
      return arr.slice(0, i).concat([item], arr.slice(i));
    }
  }

  arr.push(item);
  return arr;
}

type AnyDict = Record<string, any>;

export function splitProps<
  T1 extends Partial<{ [K in keyof T2]: T1[K] }> &
    Partial<{ [K in keyof T3]: T1[K] }>,
  T2 extends AnyDict,
  T3 extends AnyDict,
>(
  props: T1,
  elementDefaults: T2,
  otherDefaults: T3,
): [
  Required<{ [K in keyof T2]: Exclude<T1[K], undefined> }> & AnyDict,
  Required<{ [K in keyof T3]: Exclude<T1[K], undefined> }>,
] {
  const elementProps: AnyDict = {};
  const otherProps: AnyDict = {};

  for (const [k, v] of Object.entries(props)) {
    if (k in elementDefaults) {
      elementProps[k] = v;
    } else if (k in otherDefaults) {
      otherProps[k] = v;
    } else {
      elementProps[k] = v;
    }
  }

  for (const [k, v] of Object.entries(elementDefaults)) {
    if (!(k in elementProps)) {
      elementProps[k] = v;
    }
  }

  for (const [k, v] of Object.entries(otherDefaults)) {
    if (!(k in otherProps)) {
      otherProps[k] = v;
    }
  }

  return [
    elementProps as Required<{ [K in keyof T2]: Exclude<T1[K], undefined> }>,
    otherProps as Required<{ [K in keyof T3]: Exclude<T1[K], undefined> }>,
  ];
}

export function interweavingPush<T>(arr: T[], newItems: T[], join: T) {
  for (let i = 0; i < newItems.length; i++) {
    arr.push(newItems[i]);
    if (i !== newItems.length - 1) {
      arr.push(join);
    }
  }
}
