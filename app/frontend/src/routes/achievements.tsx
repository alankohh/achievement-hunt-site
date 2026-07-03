import { useGetAchievements, useGetIteration, useGetTeams } from "api/query";
import { AchievementTeamExtendedType } from "api/types/AchievementTeamType";
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
import { useContext, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { AppState } from "types/AppStateType.ts";
import { getMyTeam } from "util/helperFunctions";
import { Timer } from "components/common/Timer.tsx";

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
}: {
  state: AppState;
  iteration: EventIterationType;
}) {
  return <AchievementContainer state={state} iteration={iteration} />;
}

function FullAchievementCompletionPage({
  team,
  state,
  iteration,
}: {
  team: AchievementTeamExtendedType | null;
  state: AppState;
  iteration: EventIterationType;
}) {
  return (
    <>
      <AchievementProgress team={team} iteration={iteration} />
      <AchievementContainer state={state} iteration={iteration} />
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

        <AchievementNavigationBar
          key="achievements"
          state={state}
          dispatchState={dispatchState}
          achievements={achievements}
          isStaff={false}
        />

        <div className="achievements">
          {team !== null ? (
            <FullAchievementCompletionPage
              state={state}
              team={team}
              iteration={iteration}
            />
          ) : (
            <LimitedAchievementCompletionPage
              state={state}
              iteration={iteration}
            />
          )}
        </div>
      </div>
    </>
  );
}
