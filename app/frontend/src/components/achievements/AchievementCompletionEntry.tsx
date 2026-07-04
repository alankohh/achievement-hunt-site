import { timeAgo } from "util/helperFunctions.ts";
import {
  AnonymousAchievementCompletionType,
  AchievementCompletionType,
} from "api/types/AchievementCompletionType.ts";
import { AchievementPlayerType } from "api/types/AchievementPlayerType.ts";
import { AchievementTeamExtendedType } from "api/types/AchievementTeamType.ts";
import { useMemo } from "react";

// <img
//         className="achievement__players__entry__pfp"
//         src={player.user.avatar}
//         alt=""
//       ></img>
//       <div>
//         <p>
//           <b>{player.user.username}</b>
//         </p>
//         <p style={{ fontSize: "14px" }}>
//           {timeAgo(lowerBound, upperBound, suffix)}
//         </p>
//       </div>

function getTimeText(
  timeFormat: "since-release" | "normal",
  completedAt: string | null,
  releaseTime: string,
): string | null {
  if (completedAt === null) {
    return null;
  }

  const completed = Date.parse(completedAt);
  if (timeFormat === "since-release") {
    const release = Date.parse(releaseTime);
    if (release > completed) {
      return timeAgo(completed, release, "before release (by accident)");
    }
    return timeAgo(release, completed, "after release");
  }
  return timeAgo(completed);
}

function AchievementCompletionEntryPlayer({
  releaseTime,
  player,
  timeFormat,
  part,
  value,
  timestamp,
}: {
  releaseTime: string;
  player: AchievementPlayerType;
  timeFormat: "since-release" | "normal";
  part: string | null;
  value: number | null;
  timestamp: string;
}) {
  const timeText = useMemo(
    () => getTimeText(timeFormat, timestamp, releaseTime),
    [timeFormat, timestamp, releaseTime],
  );
  return (
    <div className="achievement__players__entry">
      <div className="achievement__players__entry__spacing"></div>
      {part !== null ? <p className="placement-text place">Part {part}</p> : ""}
      {value !== null ? <p className="placement-text value">{value}</p> : ""}
      <img
        className="achievement__players__entry__pfp"
        src={player.user.avatar}
        alt=""
      ></img>
      <div>
        <p>
          <b>{player.user.username}</b>
        </p>
        <p style={{ fontSize: "14px" }}>{timeText}</p>
      </div>
    </div>
  );
}

function AchievementCompletionEntryTeam({
  completion,
  releaseTime,
  teamsMap,
  timeFormat,
  competitionScorings,
}: {
  completion: AchievementCompletionType | AnonymousAchievementCompletionType;
  releaseTime: string;
  teamsMap: { [playerId: number]: AchievementTeamExtendedType };
  timeFormat: "since-release" | "normal";
  competitionScorings: number[];
}) {
  const timeText = useMemo(
    () =>
      getTimeText(
        timeFormat,
        "time_completed" in completion ? completion.time_completed : null,
        releaseTime,
      ),
    [timeFormat, completion, releaseTime],
  );
  const team = useMemo(
    () => ("player" in completion ? teamsMap[completion.player.id] : null),
    [completion],
  );

  const [placement, placeValue] = useMemo(
    () =>
      "placement" in completion &&
      completion.placement !== null &&
      completion.placement !== undefined
        ? [completion.placement!.place, completion.placement!.value]
        : [null, null],
    [completion, completion.placement],
  );
  const points = useMemo(
    () =>
      placement !== null && competitionScorings.length >= placement
        ? competitionScorings[placement - 1]
        : null,
    [placement, competitionScorings],
  );

  return (
    <div className="achievement__players__entry">
      {placement !== null ? (
        <>
          <p className="placement-text place">#{placement}</p>
          <p className="placement-text value">{placeValue}</p>
        </>
      ) : (
        ""
      )}
      {team ? (
        <div>
          <p>
            <b>
              {team.name} ({team.anonymous_name})
            </b>
          </p>
          <p style={{ fontSize: "14px" }}>{timeText}</p>
        </div>
      ) : (
        ""
      )}
      {points !== null ? (
        <>
          <div style={{ flexGrow: 1 }}></div>
          <p>
            <b>{points}pts</b>
          </p>
        </>
      ) : (
        ""
      )}
    </div>
  );
}

export default function AchievementCompletionEntry({
  completion,
  releaseTime,
  playersMap,
  teamsMap,
  timeFormat,
  competitionScorings,
}: {
  completion: AchievementCompletionType | AnonymousAchievementCompletionType;
  releaseTime: string;
  playersMap: { [playerId: number]: AchievementPlayerType };
  teamsMap: { [playerId: number]: AchievementTeamExtendedType };
  timeFormat: "since-release" | "normal";
  competitionScorings: number[];
}) {
  const players = useMemo(() => {
    if ("extra" in completion && completion.extra !== null) {
      return Object.entries(completion.extra.parts).map(([part, info]) => ({
        part,
        value: info.value === undefined ? null : info.value,
        timestamp: info.timestamp,
        player: playersMap[info.player],
      }));
    }

    if ("player" in completion) {
      return [
        {
          part: null,
          value: null,
          timestamp: completion.time_completed,
          player: completion.player,
        },
      ];
    }

    return [];
  }, [completion, playersMap]);

  return (
    <>
      <AchievementCompletionEntryTeam
        completion={completion}
        releaseTime={releaseTime}
        teamsMap={teamsMap}
        timeFormat={timeFormat}
        competitionScorings={competitionScorings}
      />
      {players.map((p) => (
        <AchievementCompletionEntryPlayer
          key={`${p.player.id}-${p.part}`}
          releaseTime={releaseTime}
          player={p.player}
          timeFormat={timeFormat}
          part={p.part}
          value={p.value}
          timestamp={p.timestamp}
        />
      ))}
    </>
  );
}
