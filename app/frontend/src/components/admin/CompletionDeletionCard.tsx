import TextArea from "components/inputs/TextArea.tsx";
import Button from "components/inputs/Button.tsx";
import React, { useCallback, useContext, useMemo, useState } from "react";
import {
  useDeleteCompletion,
  useGetAchievements,
  useGetTeams,
} from "api/query.ts";
import { AchievementTeamExtendedType } from "api/types/AchievementTeamType.ts";
import Dropdown from "components/inputs/Dropdown.tsx";
import { EventContext } from "contexts/EventContext.ts";

export default function CompletionDeletionCard() {
  const { data: teamData, isLoading: teamsLoading } = useGetTeams();
  const { data: achievements, isLoading: achievementsLoading } =
    useGetAchievements();
  const deleteCompletionMut = useDeleteCompletion();
  const eventDispatch = useContext(EventContext);

  const [scoreIds, setScoreIds] = useState("");

  const deleteCompletion = useCallback(
    (evt: React.FormEvent<HTMLButtonElement>) => {
      const data = new FormData((evt.target as HTMLButtonElement).form!);
      deleteCompletionMut.mutate(
        {
          player_id: parseInt(data.get("player-id") as string),
          achievement_id: parseInt(data.get("achievement-id") as string),
          blacklist_scores: (data.get("score-ids") as string)
            .split("\n")
            .map((n) => parseInt(n.trim()))
            .filter((n) => !isNaN(n)),
        },
        {
          onSuccess: () =>
            eventDispatch({
              type: "info",
              msg: "Successfully removed the completion.",
            }),
          onSettled: () => deleteCompletionMut.reset(),
        },
      );
    },
    [deleteCompletionMut],
  );

  const playerOptions: [string, string][] = useMemo(() => {
    if (!teamData) {
      return [];
    }

    const players: [string, string][] = [];
    for (const team of teamData.teams) {
      for (const player of (team as AchievementTeamExtendedType).players) {
        players.push([player.user.username, player.id.toString()]);
      }
    }

    return players.sort((a, b) => a[0].localeCompare(b[0]));
  }, [teamData]);
  const achievementOptions: [string, string][] = useMemo(() => {
    if (!achievements) {
      return [];
    }

    const options: [string, string][] = [];
    for (const achievement of achievements) {
      options.push([achievement.name, achievement.id.toString()]);
    }
    return options.sort((a, b) => a[0].localeCompare(b[0]));
  }, [achievements]);

  if (teamsLoading || achievementsLoading) {
    return (
      <div className="card">
        <h1 className="card__title">Loading...</h1>
      </div>
    );
  }

  if (!teamData || !achievements) {
    return (
      <div className="card">
        <h1 className="card__title">Failed to load</h1>
      </div>
    );
  }

  return (
    <div className="card">
      <h1 className="card__title">Delete Completion</h1>
      <form className="card--admin__container">
        <Dropdown options={playerOptions} name="player-id" />
        <Dropdown options={achievementOptions} name="achievement-id" />
        <TextArea
          value={scoreIds}
          setValue={setScoreIds}
          placeholder="Enter score ids (to blacklist) each on a new line"
          className="staff__textarea"
          name="score-ids"
        />
        <Button
          children="Delete"
          holdToUse={true}
          caution={true}
          unavailable={deleteCompletionMut.isPending}
          onClick={deleteCompletion}
          width="100%"
        />
      </form>
    </div>
  );
}
