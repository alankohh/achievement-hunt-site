import { useGetAchievements, useGetIteration, useGetTeams } from "api/query";
import {
  AchievementTeamExtendedType,
  TeamDataType,
} from "api/types/AchievementTeamType";
import { EventIterationType } from "api/types/EventIterationType.ts";
import "assets/css/achievements.css";
import AchievementContainer from "components/achievements/AchievementContainer";
import AchievementNavigationBar, {
  getDefaultNav,
} from "components/achievements/AchievementNavigationBar.tsx";
import AchievementProgress from "components/achievements/AchievementProgress.tsx";
import { SessionContext } from "contexts/SessionContext";
import {
  useDispatchStateContext,
  useStateContext,
} from "contexts/StateContext.ts";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { AppState } from "types/AppStateType.ts";
import { getMyTeam } from "util/helperFunctions";
import { Timer } from "components/common/Timer.tsx";
import { AchievementExtendedType } from "api/types/AchievementType.ts";

function HiddenAchievementCompletionPage({
  eventStart,
}: {
  eventStart: number;
}) {
  return (
    <div style={{ margin: "auto", textAlign: "center", marginTop: "20px" }}>
      <Timer endsAt={eventStart} preText="Starting in" finishedText="Begin!" />
    </div>
  );
}

function LimitedAchievementCompletionPage({
  state,
  iteration,
  achievements,
  teamData,
}: {
  state: AppState;
  iteration: EventIterationType;
  achievements: AchievementExtendedType[];
  teamData: TeamDataType;
}) {
  return (
    <AchievementContainer
      state={state}
      iteration={iteration}
      baseAchievements={achievements}
      teamData={teamData}
    />
  );
}

function FullAchievementCompletionPage({
  team,
  state,
  iteration,
  achievements,
  teamData,
}: {
  team: AchievementTeamExtendedType | null;
  state: AppState;
  iteration: EventIterationType;
  achievements: AchievementExtendedType[];
  teamData: TeamDataType;
}) {
  return (
    <>
      <AchievementProgress
        team={team}
        iteration={iteration}
        achievements={achievements}
      />
      <AchievementContainer
        state={state}
        iteration={iteration}
        baseAchievements={achievements}
        teamData={teamData}
      />
    </>
  );
}

function TextPage({ text }: { text: string }) {
  return (
    <div className="achievements-layout">
      <h1>{text}</h1>
    </div>
  );
}

export default function AchievementCompletionPage() {
  const session = useContext(SessionContext);

  const { data: iteration, isLoading: iterationLoading } = useGetIteration();

  const iterationStart = useMemo(
    () => (iteration !== undefined ? Date.parse(iteration.start) : null),
    [iteration, iteration?.start],
  );
  const iterationEnd = useMemo(
    () => (iteration !== undefined ? Date.parse(iteration.end) : null),
    [iteration, iteration?.end],
  );
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (iterationStart === null) {
      return;
    }

    if (Date.now() >= iterationStart) {
      setShowContent(true);
      return;
    }

    const timeoutId = setTimeout(
      () => {
        setShowContent(true);
      },
      Math.min(iterationStart - Date.now(), 2147483647),
    );
    return () => clearTimeout(timeoutId);
  }, [iterationStart]);

  const [iterationEnded, setIterationEnded] = useState(false);

  useEffect(() => {
    if (iteration === undefined) {
      return;
    }

    const iterationEnd = Date.parse(iteration.end);

    if (Date.now() >= iterationEnd) {
      setIterationEnded(true);
      return;
    }

    const timeoutId = setTimeout(
      () => setIterationEnded(true),
      Math.min(iterationEnd - Date.now(), 2147483647),
    );
    return () => clearTimeout(timeoutId);
  }, [iterationEnd]);

  const getNextbatchAt = useCallback(() => {
    if (iterationStart === null || iterationStart >= Date.now()) {
      return null;
    }

    const interval = 16 * 60 * 60 * 1000;
    const nextBatch = Math.ceil((Date.now() - iterationStart) / interval);
    return iterationStart + interval * nextBatch;
  }, [iterationStart]);
  const [nextBatchAt, setNextBatchAt] = useState<number | null>(null);

  useEffect(() => {
    if (nextBatchAt === null) {
      if (iterationStart !== null) {
        setNextBatchAt(getNextbatchAt);
      }
      return;
    }
    const timeoutId = setTimeout(
      () => setNextBatchAt(getNextbatchAt),
      Math.max(nextBatchAt - Date.now(), 0) + 1000,
    );
    return () => clearTimeout(timeoutId);
  }, [iterationStart, nextBatchAt, getNextbatchAt]);

  const { data: teamData, isLoading: teamsLoading } = useGetTeams(showContent);
  const team = useMemo(
    () =>
      teamData === undefined
        ? null
        : getMyTeam(session.user?.id, teamData.teams),
    [teamData, teamData?.teams, session.user],
  );
  const fetchAchievements = useMemo(
    () =>
      showContent &&
      (team !== null ||
        (session.user !== null &&
          (session.user.is_admin || session.user.is_achievement_creator))),
    [
      showContent,
      team,
      session.user,
      session.user?.is_admin,
      session.user?.is_achievement_creator,
    ],
  );
  const { data: achievements, isLoading: achievementsLoading } =
    useGetAchievements(fetchAchievements);

  const state = useStateContext();
  const dispatchState = useDispatchStateContext();

  if (iterationLoading || achievementsLoading || teamsLoading) {
    return <TextPage text="Loading..." />;
  }

  if (iteration === undefined) {
    return <TextPage text="Failed to load" />;
  }

  if (!showContent) {
    return <HiddenAchievementCompletionPage eventStart={iterationStart!} />;
  }

  if (team === null && !iterationEnded && !fetchAchievements) {
    return (
      <TextPage text="You must be playing to view the achievements while the event is ongoing." />
    );
  }

  if (
    (fetchAchievements && achievements === undefined) ||
    teamData == undefined
  ) {
    return <TextPage text="Failed to load" />;
  }

  // TODO: fix
  if (state.achievementsFilter === null && achievements !== undefined) {
    dispatchState({ id: 5, achievementsFilter: getDefaultNav(achievements) });
  }

  return (
    <>
      <Helmet>
        <title>CTA - Achievements</title>
      </Helmet>

      <div className="achievements-layout">
        <div style={{ margin: "auto", textAlign: "center" }}>
          <Timer
            endsAt={iterationEnd!}
            preText="Ends in"
            finishedText="Event ended"
          />
        </div>
        {nextBatchAt !== null && nextBatchAt !== iterationEnd ? (
          <div style={{ margin: "auto", textAlign: "center" }}>
            <Timer
              endsAt={nextBatchAt!}
              preText="Next batch in"
              finishedText="Batch released"
            />
          </div>
        ) : (
          ""
        )}

        <AchievementNavigationBar
          key="achievements"
          state={state}
          dispatchState={dispatchState}
          achievements={achievements}
          isStaff={false}
        />

        {achievements !== undefined ? (
          <div className="achievements">
            {team !== null ? (
              <FullAchievementCompletionPage
                state={state}
                team={team}
                iteration={iteration}
                achievements={achievements}
                teamData={teamData}
              />
            ) : (
              <LimitedAchievementCompletionPage
                state={state}
                iteration={iteration}
                teamData={teamData}
                achievements={achievements}
              />
            )}
          </div>
        ) : (
          ""
        )}
      </div>
    </>
  );
}
