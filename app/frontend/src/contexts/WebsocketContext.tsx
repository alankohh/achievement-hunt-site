import { QueryClient, QueryClientContext } from "@tanstack/react-query";
import { AchievementCompletionPlacementType } from "api/types/AchievementCompletionType";
import { AchievementPlayerType } from "api/types/AchievementPlayerType";
import { TeamDataType } from "api/types/AchievementTeamType";
import { AchievementExtendedType } from "api/types/AchievementType";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { timeAgo } from "util/helperFunctions";
import { EventContext, EventType } from "./EventContext";
import { SessionContext } from "./SessionContext";
import {
  StateDispatch,
  useDispatchStateContext,
  useStateContext,
} from "./StateContext";

export type ChatMessage = {
  name: string;
  message: string;
  sent_at: string;
};

type WSAchievementType = {
  id: number;
  name: string;
  parts: number;
  completed_parts: number;
  time: string;
  time_placement: number;
  placement: AchievementCompletionPlacementType | null;
  extra: Record<string, any>;
  is_complete: boolean;
};

type RefreshReturnType = {
  achievements: WSAchievementType[];
  score: number;
  player: AchievementPlayerType;
  last_score?: string;
  score_gain: number;
};

type CooldownsReturnType = {
  ends_at: number | null;
  achievements: { [achievementId: string]: number };
};

function onCompletedAchievement(
  data: RefreshReturnType,
  queryClient: QueryClient,
) {
  // add completions to achievements
  queryClient.setQueryData(
    ["achievements"],
    (achievements: AchievementExtendedType[]) => {
      const newAchievements = [];
      for (const achievement of achievements) {
        const completedAch = data.achievements
          .filter((a) => a.id === achievement.id)
          .pop();
        if (completedAch === undefined) {
          newAchievements.push(achievement);
          continue;
        }

        newAchievements.push({
          ...achievement,
          completions: [
            {
              time_completed: completedAch.time,
              time_placement: completedAch.time_placement,
              player: data.player,
              placement:
                completedAch.placement === null ||
                completedAch.placement === undefined ||
                completedAch.placement.value === null
                  ? undefined
                  : completedAch.placement,
              extra: completedAch.extra,
              is_complete: completedAch.is_complete,
            },
          ],
        });
      }

      return newAchievements;
    },
  );

  // update score
  queryClient.setQueryData(["teams"], (teamData: TeamDataType) => {
    const newTeams = [];

    for (const team of teamData.teams) {
      if (!("players" in team)) {
        newTeams.push(team);
        continue;
      }

      let added = false;

      for (const player of team.players) {
        if (player.id === data.player.id) {
          newTeams.push({ ...team, points: data.score });
          added = true;
          break;
        }
      }

      if (!added) newTeams.push(team);
    }
  });
}

function handleMessage(
  evt: MessageEvent<string>,
  dispatchEventMsg: React.Dispatch<{ type: EventType; msg: string }>,
  queryClient: QueryClient,
  ws: WebSocket,
  dispatchAppState: StateDispatch,
) {
  const data = JSON.parse(evt.data);
  if (data.error !== undefined) {
    dispatchEventMsg({
      type: "error",
      msg: `Unexpected error from websocket server: ${data.error}`,
    });
    return;
  }

  switch (data.code) {
    case 1: {
      const achievements = data.achievements as WSAchievementType[];
      let msg =
        achievements.length === 0
          ? "No achievements completed. Submission on cooldown."
          : `You completed ${achievements.length} achievement(s)! ${achievements
              .map((achievement) =>
                achievement.parts === 1
                  ? achievement.name
                  : `${achievement.name} (${achievement.completed_parts}/${achievement.parts})`,
              )
              .join(", ")}.`;

      if (data.last_score !== undefined) {
        msg +=
          " Last score: " +
          (data.last_score === null ? "no scores" : timeAgo(data.last_score));
      }

      msg = `${data.player.user.username}: ${msg}`;

      dispatchEventMsg({ type: "info", msg: msg });

      if (achievements.length > 0) {
        onCompletedAchievement(data, queryClient);
      }

      ws.send(
        JSON.stringify({
          code: 3,
        }),
      ); // get submission cooldowns

      break;
    }
    case 2: {
      const current_path = window.location.pathname.slice(1);
      if (current_path !== "teams") {
        dispatchEventMsg({
          type: "info",
          msg: `New team chat message from ${data.msg.name}! Go to your dashboard to read it.`,
        });
      }
      queryClient.setQueryData(
        ["teams", "messages"],
        (messages: ChatMessage[]) => {
          return [...messages, data.msg];
        },
      );

      break;
    }
    case 3: {
      // set cooldowns on submission (score + passwords)
      const cooldowns = data as CooldownsReturnType;
      if (cooldowns.ends_at !== null) {
        dispatchAppState({ id: 3, enable: false });
        setTimeout(
          () => dispatchAppState({ id: 3, enable: true }),
          Math.max(0, cooldowns.ends_at * 1000 - Date.now()),
        );
      }
      // enable all, then disable the ones on cooldown
      dispatchAppState({ id: 14, achievementId: null, enable: true });
      for (const [achievementId, endsAt] of Object.entries(
        cooldowns.achievements,
      )) {
        dispatchAppState({
          id: 14,
          achievementId: parseInt(achievementId),
          enable: false,
        });
        setTimeout(
          () =>
            dispatchAppState({
              id: 14,
              achievementId: parseInt(achievementId),
              enable: true,
            }),
          Math.max(0, endsAt * 1000 - Date.now()),
        );
      }

      break;
    }
  }
}

export type WebsocketState = {
  connected: boolean;
};

export type WebsocketContextType = {
  state: WebsocketState;
  sendSubmit: () => void;
  sendPwGuess: (achievementId: number, guess: string) => void;
  sendChatMessage: (msg: string) => void;
  resetConnection: () => void;
} | null;

export const WebsocketContext = createContext<WebsocketContextType>(null);

export function WebsocketContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  const queryClient = useContext(QueryClientContext)!;
  const dispatchEventMsg = useContext(EventContext);
  const session = useContext(SessionContext);
  const appState = useStateContext();
  const dispatchAppState = useDispatchStateContext();

  const wsRef = useRef<WebSocket | null>(null);
  const wsAttempts = useRef(0);
  const wsReconnectTimer = useRef<null | number>(null);
  const [wsConnected, setWsConnected] = useState(false);

  const loggedIn = session.user !== null;
  useEffect(() => {
    if (!loggedIn) {
      return;
    }

    connect();
  }, [loggedIn]);

  const connect = useCallback(() => {
    // reconnect already in progress or already connected
    if (wsReconnectTimer.current !== null || wsRef.current !== null) {
      return;
    }

    const ws = (wsRef.current = new WebSocket(session.wsUri));

    ws.addEventListener("open", () => {
      wsAttempts.current = 0;
      setWsConnected(true);
      ws.send(JSON.stringify({ code: 3 })); // get submission cooldowns
    });

    ws.addEventListener("error", () => {
      ws.close();
    });

    ws.addEventListener("close", (e) => {
      wsRef.current = null;
      setWsConnected(false);
      if (e.code !== 1000 && wsAttempts.current < 10) {
        wsReconnectTimer.current = setTimeout(() => {
          wsAttempts.current += 1;
          wsReconnectTimer.current = null;
          connect();
        }, 1000);
      }
    });

    ws.addEventListener("message", (evt) => {
      handleMessage(evt, dispatchEventMsg, queryClient, ws, dispatchAppState);
    });
  }, [session.wsUri, dispatchEventMsg, queryClient, dispatchAppState]);

  const wsReady = useCallback(() => {
    return (
      wsRef.current !== null && wsRef.current.readyState === WebSocket.OPEN
    );
  }, []);

  const sendSubmit = useCallback(() => {
    if (!wsReady() || !appState.submitEnabled) {
      return;
    }

    wsRef.current!.send(
      JSON.stringify({ code: 1, mode: appState.submissionMode }),
    );

    // disable submission
    dispatchAppState({
      id: 3,
      enable: false,
    });
  }, [appState.submitEnabled, appState.submissionMode]);

  const sendPwGuess = useCallback((achievementId: number, guess: string) => {
    if (!wsReady()) {
      return;
    }

    wsRef.current!.send(
      JSON.stringify({
        code: 1,
        mode: appState.submissionMode,
        achievement: achievementId,
        guess,
      }),
    );

    // disable submission
    dispatchAppState({
      id: 14,
      achievementId,
      enable: false,
    });
  }, []);

  const sendChatMessage = useCallback(
    (msg: string) => {
      if (!wsReady() || !session.user) {
        return;
      }

      wsRef.current!.send(JSON.stringify({ code: 2, msg: msg }));
    },
    [session.user],
  );

  const resetConnection = useCallback(() => {
    if (wsReady()) {
      wsRef.current!.close();
    }
  }, []);

  return (
    <WebsocketContext.Provider
      value={{
        state: {
          connected: wsConnected,
        },
        sendSubmit,
        sendPwGuess,
        sendChatMessage,
        resetConnection,
      }}
    >
      {children}
    </WebsocketContext.Provider>
  );
}
