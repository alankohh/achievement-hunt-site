import {
  useChangeAcceptingFreeAgents,
  useGetCompletions,
  useGetTeamInvites,
  useLeaveTeam,
  useRenameTeam,
  useRescindTeamInvite,
  useSendTeamInvite,
  useTransferTeamAdmin,
} from "api/query.ts";
import React, { FormEvent, useContext, useMemo, useState } from "react";
import { AchievementPlayerType } from "api/types/AchievementPlayerType.ts";
import {
  AchievementTeamExtendedType,
  TeamDataType,
} from "api/types/AchievementTeamType.ts";
import "assets/css/form.css";
import "assets/css/team.css";
import { EventContext, EventDispatch } from "contexts/EventContext.ts";
import { PopupContext, PopupContextType } from "contexts/PopupContext.ts";
import { SessionContext } from "contexts/SessionContext.ts";
import Player from "components/team/Player.tsx";
import Button from "components/inputs/Button.tsx";
import { TeamInviteType } from "api/types/InviteType.ts";
import TextInput from "components/inputs/TextInput.tsx";
import {
  IoIosArrowDown,
  IoIosArrowUp,
  IoIosCloseCircle,
  IoIosCloseCircleOutline,
} from "react-icons/io";
import { EventIterationType } from "api/types/EventIterationType.ts";
import { calculateScore, parseMeaningfulTags } from "util/helperFunctions.ts";
import classNames from "classnames";
import Dropdown from "components/inputs/Dropdown.tsx";
import { anonNameNouns, anonNameAdjectives } from "util/anonNames.ts";

function NameChangePopup({
  onSubmit,
  defaultAnonAdjective,
  defaultAnonNoun,
  defaultName,
}: {
  onSubmit: (evt: FormEvent<HTMLFormElement>) => void;
  defaultAnonAdjective: string;
  defaultAnonNoun: string;
  defaultName: string;
}) {
  // TODO: fix layout on mobile
  const adjectives = useMemo(
    () => Object.fromEntries(anonNameAdjectives.map((w) => [w, w])),
    [],
  );
  const nouns = useMemo(
    () => Object.fromEntries(anonNameNouns.map((w) => [w, w])),
    [],
  );

  return (
    <form onSubmit={onSubmit}>
      <div className="form-container">
        <div className="form-container__input">
          <p>Team name: </p>
          <TextInput name="team-name" defaultValue={defaultName} />
        </div>
        <div className="form-container__input">
          <p>Anonymous name: </p>
          <Dropdown
            name="anon-name-adjective"
            options={adjectives}
            defaultValue={defaultAnonAdjective}
          />
          <Dropdown
            name="anon-name-noun"
            options={nouns}
            defaultValue={defaultAnonNoun}
          />
        </div>
        <div className="form-container__input center">
          <Button type="submit" children="Submit" width="200px" />
        </div>
      </div>
    </form>
  );
}

export default function TeamCard({
  team,
  iteration,
  teamData,
}: {
  team: AchievementTeamExtendedType;
  iteration: EventIterationType;
  teamData: TeamDataType;
}) {
  const session = useContext(SessionContext);
  const dispatchEventMsg = useContext(EventContext);
  const { setPopup } = useContext(PopupContext) as PopupContextType;

  let player = null;
  if (session.user !== null) {
    const players = team.players.filter((p) => p.user.id === session.user!.id);
    if (players.length === 1) {
      player = players[0];
    }
  }

  const iterationStarted = Date.parse(iteration.start) <= Date.now();
  const showInvites =
    player !== null &&
    player.team_admin &&
    !iterationStarted &&
    team.players.length != 5;

  const { data: invites, isLoading: invitesLoading } =
    useGetTeamInvites(showInvites);
  const { data: completions } = useGetCompletions(iterationStarted);
  const renameTeam = useRenameTeam();
  const leaveTeam = useLeaveTeam();
  const sendTeamInvite = useSendTeamInvite();
  const changeAcceptingFreeAgents = useChangeAcceptingFreeAgents();

  const [debounce, setDebounce] = useState(false);
  const [showScoring, setShowScoring] = useState(false);
  const [faType, setFaType] = useState(team.free_agent_type);

  const user = team.players.find(
    (player) => player.user.id === session.user?.id,
  );

  let invitesElement;
  if (!showInvites) {
    invitesElement = "";
  } else if (invitesLoading) {
    invitesElement = <h1>Loading...</h1>;
  } else if (invites === undefined) {
    invitesElement = <h1>Failed to load</h1>;
  } else if (invites.length === 0) {
    invitesElement = <h1>No out-going invites</h1>;
  } else {
    invitesElement = invites.map((invite) => (
      <InviteItem key={invite.id} invite={invite} />
    ));
  }

  let extendedCompletions = null;
  let score = null;
  if (completions !== undefined) {
    extendedCompletions = completions.map((c) => ({ ...c, score: 0 }));
    score = 0;

    for (const completion of extendedCompletions) {
      if (!completion.is_complete && completion.placement !== null) {
        continue;
      }

      const [isCompetition, isSecret] = parseMeaningfulTags(
        completion.achievement_tags,
      );
      const nTeams = teamData.effective_team_count;
      const scoreAdded = calculateScore(
        nTeams,
        completion.completions,
        isCompetition ? completion.placement!.place : completion.time_placement,
        isSecret,
        isCompetition,
      );
      completion.score = scoreAdded;
      score += scoreAdded;
    }
  }

  const [anonNameAdjective, anonNameNoun] = useMemo(() => {
    const split = team.anonymous_name.split(" ");
    return [split[0], split[1]];
  }, [team.anonymous_name]);

  const renameTeamPopup = () => {
    setPopup({
      title: "Rename Team",
      content: (
        <NameChangePopup
          onSubmit={doRenameTeam}
          defaultAnonAdjective={anonNameAdjective}
          defaultAnonNoun={anonNameNoun}
          defaultName={team.name}
        />
      ),
    });
  };

  const transferTeamAdminPopup = () => {
    setPopup({
      title: "Transfer admin",
      content: (
        <TransferTeamAdminComponent
          ownTeam={team}
          dispatchEventMsg={dispatchEventMsg}
        />
      ),
    });
  };

  const doRenameTeam = (evt: FormEvent<HTMLFormElement>) => {
    evt.preventDefault();

    if (debounce) {
      return;
    }

    const data = new FormData(evt.currentTarget);
    const name = data.get("team-name") as string;
    const anonName =
      data.get("anon-name-adjective") + " " + data.get("anon-name-noun");
    if (name.length < 1 || name.length > 32) {
      return dispatchEventMsg({
        type: "error",
        msg: "Team name must be between 1 and 32 characters",
      });
    }

    setDebounce(true);

    renameTeam.mutate(
      { name, anonymous_name: anonName },
      {
        onSuccess: () => {
          dispatchEventMsg({
            type: "info",
            msg: `Team ${team.name} successfully renamed to ${name} (${anonName})`,
          });
        },
        onSettled: () => {
          renameTeam.reset();
          setDebounce(false);
        },
      },
    );

    setPopup(null);
  };

  const doLeaveTeam = () => {
    if (debounce) {
      return;
    }

    setDebounce(true);

    leaveTeam.mutate(
      {},
      {
        onSettled: () => {
          leaveTeam.reset();
          setDebounce(false);
        },
      },
    );
  };

  const doSendInvite = (evt: FormEvent<HTMLFormElement>) => {
    evt.preventDefault();

    if (debounce) {
      return;
    }

    console.log(evt);

    let userIdStr = (
      new FormData(evt.currentTarget).get("user-id") as string
    ).trim();
    if (userIdStr.length === 0) {
      return;
    }

    if (userIdStr.endsWith("/")) {
      userIdStr = userIdStr.slice(0, userIdStr.length - 1);
    }
    const userIdSplit = userIdStr.split("/");
    const userId = parseInt(userIdSplit[userIdSplit.length - 1]);

    if (isNaN(userId)) {
      dispatchEventMsg({ type: "error", msg: "Invalid user id/link" });
      return;
    }

    setDebounce(true);

    sendTeamInvite.mutate(
      { user_id: userId },
      {
        onSettled: () => {
          sendTeamInvite.reset();
          setDebounce(false);
          (
            (evt.target as HTMLFormElement).children.item(0) as HTMLInputElement
          ).value = "";
        },
      },
    );
  };

  const doChangeAcceptingFreeAgent = (val: null | number) => {
    if (debounce) {
      return;
    }

    setDebounce(true);

    let freeAgents = !team.accepts_free_agents;
    if (val !== null) {
      setFaType(val);
      freeAgents = team.accepts_free_agents;
    }

    changeAcceptingFreeAgents.mutate(
      { enable: freeAgents, type: val ?? faType },
      {
        onSettled: () => {
          changeAcceptingFreeAgents.reset();
          setDebounce(false);
        },
      },
    );
  };

  return (
    <div className="card scroll">
      <div className="card--teams__container your-team">
        <p className="card--teams__container__text center grow">
          {team.name} | {team.anonymous_name}
        </p>
      </div>
      <h1 className="card__title">Players</h1>
      <div className="card--teams__container players">
        {team.players.map((player, i) => (
          <Player key={i} player={player} />
        ))}
      </div>
      {score == 0 ? (
        ""
      ) : (
        <>
          <div
            className="card--teams__score-title-container clickable"
            onClick={() => setShowScoring(!showScoring)}
          >
            <h1 className={classNames("card__title")}>
              Real-time score: {score}
            </h1>
            {showScoring ? (
              <IoIosArrowUp size={48} />
            ) : (
              <IoIosArrowDown size={48} />
            )}
          </div>
          {showScoring && (
            <div className={"card--teams__container score"}>
              {extendedCompletions!
                .sort((a, b) => b.score - a.score)
                .map((completion) => (
                  <div className="card--teams__score-container__row">
                    <p>{completion.achievement_name}</p>
                    <p>{completion.score}pts</p>
                  </div>
                ))}
            </div>
          )}
        </>
      )}
      <div className="card--teams__container buttons">
        <Button
          children="Leave team"
          onClick={doLeaveTeam}
          holdToUse={true}
          unavailable={
            (user?.team_admin && team.players.length > 1) ||
            debounce ||
            iterationStarted
          }
        />
      </div>
      {user?.team_admin && (
        <>
          <div className="card--teams__container buttons">
            <Button
              children="Rename Team"
              onClick={renameTeamPopup}
              unavailable={debounce}
            />
            <Button
              children="Transfer Leadership"
              onClick={transferTeamAdminPopup}
              unavailable={debounce}
            />
          </div>
          {!showInvites ? (
            ""
          ) : (
            <>
              <h1 className="card__title">Invites</h1>
              <div className="card--teams__invites--outgoing">
                {invitesElement}
              </div>
              <form
                className="card--teams__container buttons"
                onSubmit={doSendInvite}
              >
                <TextInput
                  style={{ flexGrow: 1 }}
                  placeholder="User id/link"
                  name="user-id"
                />
                <Button
                  children="Invite"
                  type="submit"
                  unavailable={debounce}
                />
              </form>
              <div className="card--teams__row">
                <p className="card--teams__description">
                  You may opt into accepting free agents (players without a
                  team). If opted in, they will be added to your team when
                  screening returns. Additionally, you may specify a preference
                  for casual or competitive free agents.
                </p>
                <div className="card--teams__form__item__col">
                  <Button
                    className="team-rigid-btn"
                    children={team.accepts_free_agents ? "Opt out" : "Opt in"}
                    unavailable={debounce}
                    onClick={() => doChangeAcceptingFreeAgent(null)}
                  />
                  {team.accepts_free_agents && (
                    <Dropdown
                      options={{ Casual: "1", Competitive: "2" }}
                      value={faType.toString()}
                      onChange={(e) =>
                        doChangeAcceptingFreeAgent(
                          parseInt(e.currentTarget.value),
                        )
                      }
                      disabled={debounce}
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function InviteItem({ invite }: { invite: TeamInviteType }) {
  const rescindTeamInvite = useRescindTeamInvite(invite.id);
  const [debounce, setDebounce] = useState(false);

  const doRescindTeamInvite = () => {
    if (debounce) {
      return;
    }

    setDebounce(true);

    rescindTeamInvite.mutate(
      {},
      {
        onSettled: () => {
          rescindTeamInvite.reset();
          setDebounce(false);
        },
      },
    );
  };

  return (
    <div className="card--teams__invites__item--outgoing">
      <a href={`https://osu.ppy.sh/u/${invite.user_id}`} target="_blank">
        {invite.username}
      </a>
      {debounce ? (
        <IoIosCloseCircle
          size={32}
          onClick={doRescindTeamInvite}
          className="clickable"
        />
      ) : (
        <IoIosCloseCircleOutline
          size={32}
          onClick={doRescindTeamInvite}
          className="clickable"
        />
      )}
    </div>
  );
}

function TransferTeamAdminComponent({
  ownTeam,
  dispatchEventMsg,
}: {
  ownTeam: AchievementTeamExtendedType;
  dispatchEventMsg: EventDispatch;
}) {
  const session = useContext(SessionContext);
  const { setPopup } = useContext(PopupContext) as PopupContextType;
  const transferTeamAdmin = useTransferTeamAdmin();
  const [selectedPlayer, setSelectedPlayer] = useState<
    AchievementPlayerType | undefined
  >(undefined);

  const playerList = ownTeam.players.filter(
    (player) => player.user.id !== session.user?.id,
  );

  const onTransferTeamAdmin = (newUserId: number) => {
    transferTeamAdmin.mutate(
      { prevAdminId: session.user?.id, newAdminId: newUserId },
      {
        onSuccess: () => {
          transferTeamAdmin.reset();
          dispatchEventMsg({
            type: "info",
            msg: "Team admin transferred!",
          });
          setPopup(null);
        },
      },
    );
  };

  return (
    <div>
      <p>Select the player to transfer admin to: </p>
      <div className="card--teams__container players">
        {playerList.map((player, i) => (
          <Player
            key={i}
            player={player}
            selectedPlayer={selectedPlayer}
            setSelectedPlayer={setSelectedPlayer}
          />
        ))}
      </div>
      <Button
        children="Submit"
        unavailable={selectedPlayer === undefined}
        onClick={() => onTransferTeamAdmin(selectedPlayer?.user.id as number)}
      />
    </div>
  );
}
