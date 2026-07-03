import { AchievementCompletionType } from "api/types/AchievementCompletionType.ts";
import {
  AchievementExtendedType,
  CompletionProgressType,
  OTHER_DESCRIPTIONS,
  TAG_DESCRIPTIONS,
} from "api/types/AchievementType";
import classNames from "classnames";
import AchievementCompletionEntry from "components/achievements/AchievementCompletionEntry.tsx";
import AudioPlayer from "components/audio/AudioPlayer.tsx";
import { parseTags, toTitleCase } from "util/helperFunctions";
import React, {
  MouseEventHandler,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { IoIosArrowDown, IoIosArrowUp } from "react-icons/io";
import Button from "components/inputs/Button.tsx";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import TextInput from "components/inputs/TextInput.tsx";
import { WebsocketContext } from "contexts/WebsocketContext.tsx";
import { AchievementPlayerType } from "api/types/AchievementPlayerType.ts";
import { AchievementTeamExtendedType } from "api/types/AchievementTeamType.ts";
import { useStateContext } from "contexts/StateContext.ts";

function getTagDescription(tag: string) {
  const i = tag.indexOf(":");
  if (i === -1) {
    // @ts-ignore
    return TAG_DESCRIPTIONS[tag] ?? "No description for this tag";
  }
  const key = tag.substring(0, i);
  const value = tag.substring(i + 2);
  // @ts-ignore
  const description = OTHER_DESCRIPTIONS[key] ?? "No description for this tag";
  if (typeof description === "string") {
    return description;
  }
  return description[value];
}

export default function Achievement({
  achievement,
  completed,
  points,
  playersMap,
  teamsMap,
  iterationEnded,
}: {
  achievement: AchievementExtendedType;
  completed: CompletionProgressType;
  points: number | null;
  playersMap: { [playerId: number]: AchievementPlayerType };
  teamsMap: { [playerId: number]: AchievementTeamExtendedType };
  iterationEnded: boolean;
}) {
  const [showCompletions, setShowCompletions] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const popupRef = useRef<null | HTMLDivElement>(null);

  const wsCtx = useContext(WebsocketContext);
  const appState = useStateContext();

  const completions = achievement.completions;
  const tags = useMemo(() => parseTags(achievement.tags), [achievement.tags]);
  const hasPasswordTag = useMemo(() => tags.includes("password"), [tags]);
  const hasCompetitionTag = useMemo(() => tags.includes("competition"), [tags]);
  const tagsWithExtra = useMemo(() => {
    const extra = [`Completions: ${achievement.completion_count}`];
    if (achievement.avg_difficulty_rating !== null) {
      extra.push(
        `Difficulty: ${Math.round(achievement.avg_difficulty_rating * 100) / 100}`,
      );
    }
    return extra.concat(tags);
  }, [achievement.completion_count, achievement.avg_difficulty_rating, tags]);

  const infoCls = useMemo(() => {
    switch (completed) {
      case "none":
        return "achievement__container neutral";
      case "complete":
        return "achievement__container complete";
      case "incomplete":
        return "achievement__container incomplete";
      case "partial":
        return "achievement__container partial";
    }
  }, [completed]);

  const dropdownArrowProps = useMemo(
    () => ({
      size: 36,
      onClick: () => setShowCompletions((v) => !v),
      className: "clickable",
    }),
    [setShowCompletions],
  );

  const onTagClicked: MouseEventHandler<HTMLDivElement> = useCallback(
    (evt) => {
      if (popupRef.current === null) return;

      const popup = popupRef.current;
      const target = evt.target as HTMLDivElement;

      popup.innerText = getTagDescription(target.innerText.toLowerCase());
      popup.style.display = "block";

      const rect = target.getBoundingClientRect();
      const centerX = (rect.left + rect.right) / 2;
      const centerY = (rect.top + rect.bottom) / 2;

      const popupLeft = window.scrollX + centerX - 150;
      const popupTop = window.scrollY + centerY - popup.offsetHeight - 40;

      popup.style.left = `${popupLeft}px`;
      popup.style.top = `${popupTop}px`;
    },
    [popupRef.current, TAG_DESCRIPTIONS],
  );

  const submitEnabled = useMemo(() => {
    const enabled = appState.pwSubmitEnabled[achievement.id];
    return enabled === undefined ? true : enabled;
  }, [appState.pwSubmitEnabled]);

  const onPasswordSubmitted = useCallback(
    (e: React.SubmitEvent) => {
      e.preventDefault();

      if (completed === "complete" || !submitEnabled) {
        return;
      }

      if (wsCtx) {
        const data = new FormData(e.target);
        wsCtx.sendPwGuess(achievement.id, data.get("guess") as string);
      }
    },
    [achievement.id, wsCtx, completed, submitEnabled],
  );

  useEffect(() => {
    const onClick = (evt: PointerEvent) => {
      const popup = popupRef.current;
      const target = evt.target as Node | HTMLElement | null;
      if (
        popup === null ||
        target === null ||
        ("classList" in target &&
          target.classList.contains("achievement-tag")) ||
        target == popup ||
        popup.contains(target)
      )
        return;

      if (popup.style.display === "block") popup.style.display = "none";
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [popupRef.current]);

  // for CTA2 achievement
  const dataAttributes = useMemo(() => {
    if (achievement.id === 219) {
      return {
        "data-beatmap-id": 1138718,
        "data-misses": 4,
        "data-100s": 4,
      };
    }
    return {};
  }, [achievement.id]);

  const hasHiddenBeatmap = useCallback(() => {
    for (const bm of achievement.beatmaps) {
      if (bm.hide) return true;
    }
    return false;
  }, [achievement.beatmaps]);

  const showSolutionBtn = useMemo(
    () => achievement.solution || hasHiddenBeatmap(),
    [achievement.solution, hasHiddenBeatmap],
  );

  const beatmapsToShow = useMemo(() => {
    if (showSolution) {
      return achievement.beatmaps;
    }
    return achievement.beatmaps.filter((b) => !b.hide);
  }, [showSolution, achievement.beatmaps]);

  const sortedCompletions = useMemo(
    () =>
      completions.sort(
        hasCompetitionTag
          ? (a, b) => a.placement!.place - b.placement!.place
          : (a, b) =>
              Date.parse((a as AchievementCompletionType).time_completed) -
              Date.parse((b as AchievementCompletionType).time_completed),
      ),
    [hasCompetitionTag, completions],
  );

  return (
    <>
      <div className="achievement__tag-description" ref={popupRef}></div>
      <div className="achievement">
        <div className={infoCls}>
          <div className="achievement__container__info">
            <div style={{ display: "flex" }}>
              <h1
                style={{ flexGrow: "1", wordBreak: "break-word" }}
                {...dataAttributes}
              >
                {achievement.name}
              </h1>
              <div style={{ flexBasis: "120px" }}></div>
            </div>
            <p className="achievement__points">
              {points === null ? "" : `${points}pts`}
            </p>
            <div className="achievement__container__info__description">
              <Markdown remarkPlugins={[remarkGfm]}>
                {achievement.description}
              </Markdown>
              {showSolutionBtn && (
                <>
                  <Button
                    children={showSolution ? "Hide solution" : "Show solution"}
                    width="auto"
                    className="achievement__show-solution-btn"
                    onClick={() => setShowSolution(!showSolution)}
                  />
                  {showSolution && (
                    <span style={{ color: "#ffc0c0" }}>
                      <Markdown remarkPlugins={[remarkGfm]}>
                        {achievement.solution!}
                      </Markdown>
                    </span>
                  )}
                </>
              )}
            </div>
            {hasPasswordTag && !showSolutionBtn && (
              <form
                className="achievement__info-row"
                onSubmit={(e) => onPasswordSubmitted(e)}
              >
                <TextInput
                  name="guess"
                  placeholder="Guess password"
                  autocomplete="off"
                  className="achievement__password-input"
                />
                <Button
                  children="Submit"
                  type="submit"
                  unavailable={completed == "complete" || !submitEnabled}
                />
              </form>
            )}
            {achievement.creator && (
              <p className="achievement__creator">
                Creator:{" "}
                <a
                  className="rendered-text"
                  href={`https://osu.ppy.sh/u/${achievement.creator.id}`}
                  target="_blank"
                >
                  {achievement.creator.username}
                </a>
              </p>
            )}
            <div className="achievement__container__info__tags">
              {tagsWithExtra.map((tag) => (
                <div
                  key={tag}
                  className="achievement-tag clickable"
                  onClick={onTagClicked}
                >
                  {toTitleCase(tag)}
                </div>
              ))}
              <div style={{ flexGrow: 1 }}></div>
              {completions.length > 0 ? (
                showCompletions ? (
                  <IoIosArrowUp {...dropdownArrowProps} />
                ) : (
                  <IoIosArrowDown {...dropdownArrowProps} />
                )
              ) : (
                ""
              )}
            </div>
          </div>
        </div>

        {achievement.audio === null || achievement.audio === "" ? (
          ""
        ) : (
          <AudioPlayer currentSong={achievement.audio} />
        )}

        {beatmapsToShow.map((beatmap) => (
          <a
            key={beatmap.info.id}
            href={`https://osu.ppy.sh/b/${beatmap.info.id}`}
            target="_blank"
          >
            <div
              className={classNames("achievement__beatmap", {
                red: beatmap.hide,
              })}
            >
              <img
                className="achievement__beatmap__cover"
                src={beatmap.info.cover}
                alt=""
              ></img>
              <div className="achievement__beatmap__info">
                <p className="achievement-beatmap-text">
                  {beatmap.info.artist} - {beatmap.info.title}
                </p>
                <p className="achievement-beatmap-text">
                  [{beatmap.info.version}]
                </p>
              </div>
              <h1 className="achievement__beatmap__star-rating achievement-beatmap-text">
                {Math.round(beatmap.info.star_rating * 100) / 100}*
              </h1>
            </div>
          </a>
        ))}
        <hr
          className={classNames({
            hide:
              achievement.beatmaps.length == 0 ||
              completions.length === 0 ||
              !showCompletions,
          })}
        />

        {completions.length == 0 || !showCompletions ? (
          ""
        ) : (
          <div className="achievement__players">
            {sortedCompletions.map((completion, i) => (
              <AchievementCompletionEntry
                key={i}
                completion={completion}
                releaseTime={achievement.batch!.release_time}
                playersMap={playersMap}
                teamsMap={teamsMap}
                timeFormat={iterationEnded ? "since-release" : "normal"}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
