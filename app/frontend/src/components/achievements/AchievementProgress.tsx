import { useGetAchievements } from "api/query";
import { AchievementTeamExtendedType } from "api/types/AchievementTeamType";
import { AchievementExtendedType } from "api/types/AchievementType";
import { WebsocketContext } from "contexts/WebsocketContext";
import { useContext, useMemo } from "react";
import { EventIterationType } from "api/types/EventIterationType.ts";
import {
  StateContext,
  useDispatchStateContext,
} from "contexts/StateContext.ts";
import Button from "components/inputs/Button.tsx";
import Dropdown from "components/inputs/Dropdown.tsx";

const MODES = {
  "All Modes": "any",
  Standard: "osu",
  Taiko: "taiko",
  Mania: "mania",
  Catch: "fruits",
};

export default function AchievementProgress({
  team,
  iteration,
}: {
  team: AchievementTeamExtendedType | null;
  iteration: EventIterationType;
}) {
  const { state: wsState, sendSubmit } = useContext(WebsocketContext)!;
  const appState = useContext(StateContext);
  const dispatchAppState = useDispatchStateContext();

  const { data: achievements } = useGetAchievements();

  const eventEnded: boolean = Date.now() >= Date.parse(iteration.end);

  // count number of completed achievements
  const achievementCount = useMemo(() => {
    if (!achievements || !team) {
      return 0;
    }

    let achievementCount = 0;
    for (const achievement of achievements) {
      for (const completion of achievement.completions) {
        if (!("player" in completion) || !completion.is_complete) {
          continue;
        }
        for (const player of team.players) {
          if (completion.player.id === player.id) {
            achievementCount += 1;
            break;
          }
        }
      }
    }
    return achievementCount;
  }, [achievements, team]);

  if (team === null || achievements === undefined) {
    return <div>Loading team progress...</div>;
  }

  const submitDisabled =
    !wsState.connected || eventEnded || !appState?.submitEnabled;
  const submitCls = "submit-button" + (submitDisabled ? " disabled" : "");

  function doSubmit() {
    if (submitDisabled) return;
    sendSubmit();
  }

  function onModeSelected(evt: React.FormEvent<HTMLSelectElement>) {
    dispatchAppState({ id: 13, mode: evt.currentTarget.value });
  }

  const progress = (achievementCount / achievements.length) * 100;

  return (
    <div className="achievements-progress">
      <div className="achievements-progress__left-box">
        <div
          className="achievements-progress__pie"
          style={{
            backgroundImage: `conic-gradient(#fff ${progress}%, var(--background-color) ${progress}%, var(--background-color) 100%)`,
          }}
        ></div>
      </div>
      <div className="achievements-progress__right-box">
        <h1>
          Achievement progress:{" "}
          {`${achievementCount}/${
            (achievements as AchievementExtendedType[]).length
          }`}
        </h1>
        <div className="achievements-progress__input-row">
          <Dropdown
            className="achievements-progress__dropdown"
            options={MODES}
            onChange={onModeSelected}
          />
          <Button
            children="Submit"
            className={submitCls + " achievements-progress__button"}
            onClick={doSubmit}
            unavailable={submitDisabled}
          />
        </div>
      </div>
    </div>
  );
}
