import { useGetAchievements, useGetTeams } from "api/query";
import { AchievementTeamExtendedType } from "api/types/AchievementTeamType.ts";
import {
  CompletedAchievementType,
  CompletionProgressType,
} from "api/types/AchievementType";
import "assets/css/achievements.css";
import { SessionContext } from "contexts/SessionContext.ts";
import { useContext, useMemo } from "react";
import { AppState } from "types/AppStateType.ts";
import { getSortedAchievements } from "util/achievementSorting.ts";
import {
  calculateScore,
  getCompetitionScorings,
  getMyCompletion,
  getMyTeam,
  parseMeaningfulTags,
  scoringFuncs,
} from "util/helperFunctions.ts";
import Achievement from "./Achievement";
import { AchievementPlayerType } from "api/types/AchievementPlayerType.ts";
import { EventIterationType } from "api/types/EventIterationType.ts";

function extendAchievementData(
  achievements: CompletedAchievementType[],
  nTeams: number,
  myTeam: AchievementTeamExtendedType | null,
) {
  for (const achievement of achievements) {
    const completion = getMyCompletion(achievement.completions, myTeam);
    if (completion) {
      achievement.completed = completion.is_complete ? "complete" : "partial";
    } else {
      achievement.completed = achievement.worth_points ? "incomplete" : "none";
    }

    if (!achievement.worth_points) {
      achievement.points = 0;
      continue;
    }

    const [isCompetition, isSecret] = parseMeaningfulTags(achievement.tags);

    if (isCompetition && completion === null) continue;

    if (completion && (completion.is_complete || completion.placement)) {
      achievement.points = calculateScore(
        nTeams,
        achievement.completion_count,
        isCompetition
          ? completion!.placement!.place
          : completion!.time_placement,
        isSecret,
        isCompetition,
      );
    } else {
      achievement.points = calculateScore(
        nTeams,
        achievement.completion_count,
        achievement.completion_count + 1, // TODO: fix to be accurate (?)
        isSecret,
        isCompetition,
      );
    }
  }
}

export default function AchievementContainer({
  state,
  iteration,
}: {
  state: AppState;
  iteration: EventIterationType;
}) {
  const session = useContext(SessionContext);
  const { data: baseAchievements } = useGetAchievements();
  const { data: teamData } = useGetTeams();

  const iterationEnded = useMemo(
    () => Date.parse(iteration.end) <= Date.now(),
    [iteration.end],
  );

  const teams = useMemo(
    () => (teamData === undefined ? null : teamData.teams),
    [teamData],
  );
  const myTeam = useMemo(
    () =>
      teams === null || session.user === null
        ? null
        : getMyTeam(session.user.id, teams),
    [teams, session.user],
  );
  const [playersMap, teamsMap] = useMemo(() => {
    if (teams === null) {
      return [null, null];
    }

    const playersMap: { [playerId: number]: AchievementPlayerType } = {};
    const teamsMap: { [playerId: number]: AchievementTeamExtendedType } = {};
    for (const team of teams) {
      if ("players" in team) {
        for (const player of team.players) {
          playersMap[player.id] = player;
          teamsMap[player.id] = team;
        }
      }
    }
    return [playersMap, teamsMap];
  }, [teams]);

  const achievements = useMemo(() => {
    if (baseAchievements === undefined || teamData === undefined) {
      return null;
    }
    const ach = baseAchievements.map((a) => ({
      ...a,
      completed: "none" as CompletionProgressType,
      points: null,
    }));
    extendAchievementData(ach, teamData.effective_team_count, myTeam);
    return ach;
  }, [baseAchievements, teamData, myTeam]);

  const sortedAchievements = useMemo(() => {
    if (achievements === null || state.achievementsFilter === null) {
      return null;
    }
    return getSortedAchievements(
      achievements,
      state.achievementsFilter,
      state.achievementsSearchFilter,
      state.hideCompletedAchievements,
      myTeam,
      session.user,
    );
  }, [
    achievements,
    state.achievementsFilter,
    state.achievementsSearchFilter,
    state.hideCompletedAchievements,
    myTeam,
  ]);

  const competitionScorings = useMemo(
    () =>
      !teamData ? [] : getCompetitionScorings(teamData.effective_team_count),
    [teamData?.effective_team_count],
  );

  if (
    state.achievementsFilter === null ||
    sortedAchievements === null ||
    teamData === undefined
  )
    return (
      <div className="achievements__container">
        <div>Loading achievements...</div>
      </div>
    );

  return (
    <div className="achievements__container">
      {Object.entries(sortedAchievements).map(([group, achievements]) => (
        <>
          <div key={`group-${group}`} className="achievement-category">
            {group}
          </div>
          {group.toLowerCase().includes("search") &&
          achievements.length === 0 ? (
            <p>No achievements found!</p>
          ) : (
            achievements.map((achievement, index) => (
              <Achievement
                key={index}
                achievement={achievement}
                completed={achievement.completed}
                points={achievement.points}
                playersMap={playersMap!}
                teamsMap={teamsMap!}
                iterationEnded={iterationEnded}
                competitionScorings={competitionScorings}
              />
            ))
          )}
        </>
      ))}
    </div>
  );
}
