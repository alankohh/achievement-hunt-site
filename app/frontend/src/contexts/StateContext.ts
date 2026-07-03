import {
  NavItems,
  SortedNavRowItems,
} from "components/achievements/AchievementNavigationBar.tsx";
import { act, createContext, useContext, useReducer } from "react";
import { AppState, defaultState } from "types/AppStateType.ts";

interface BaseStateActionType {
  id: number;
}

interface ToggleSubmission extends BaseStateActionType {
  id: 3;
  enable: boolean;
}

interface FilterType extends BaseStateActionType {
  id: 5;
  achievementsFilter: NavItems;
}

interface SearchFilterType extends BaseStateActionType {
  id: 6;
  achievementsSearchFilter: string;
}

interface AdjustAudioType extends BaseStateActionType {
  id: 9;
  value: number;
  isMuted: boolean;
}

interface ActivateNavItem extends BaseStateActionType {
  id: 10;
  label: keyof NavItems["rows"];
  item: string;
  multiSelect: boolean;
  active: boolean;
  value?: boolean;
}

interface SwitchNavItemSort extends BaseStateActionType {
  id: 11;
  label: keyof NavItems["rows"];
}

interface ChangeSubmissionMode extends BaseStateActionType {
  id: 13;
  mode: string;
}

interface TogglePasswordSubmission extends BaseStateActionType {
  id: 14;
  achievementId: number | null;
  enable: boolean;
}

type StateActionType =
  | ToggleSubmission
  | FilterType
  | SearchFilterType
  | AdjustAudioType
  | ActivateNavItem
  | SwitchNavItemSort
  | ChangeSubmissionMode
  | TogglePasswordSubmission;

function stateReducer(state: AppState, action: StateActionType): AppState {
  switch (action.id) {
    case 3:
      return {
        ...state,
        submitEnabled: action.enable,
      };
    case 5: // filter change
      return {
        ...state,
        achievementsFilter: action.achievementsFilter,
      };
    case 6: // search change
      return {
        ...state,
        achievementsSearchFilter: action.achievementsSearchFilter,
      };
    case 9: {
      // audio adjustment
      localStorage.setItem("volume", action.value.toString());
      localStorage.setItem("isMuted", action.isMuted ? "t" : "f");
      return {
        ...state,
        volume: {
          value: action.value,
          isMuted: action.isMuted,
        },
      };
    }
    case 10: {
      const newFilter = { ...state.achievementsFilter! };

      if (action.multiSelect) {
        for (const item of newFilter.rows[action.label].items) {
          if (item.label === action.item) {
            if ("value" in item) {
              // if bool row item
              if (!action.active) {
                item.value = true;
                item.active = true;
              } else if (action.value) {
                item.value = false;
              } else {
                item.active = false;
              }
            } else {
              item.active = !action.active;
            }

            break;
          }
        }
      } else {
        for (const item of newFilter.rows[action.label].items)
          item.active = item.label === action.item;
      }

      return {
        ...state,
        achievementsFilter: newFilter,
      };
    }
    case 11: {
      const newFilter = { ...state.achievementsFilter! };

      const row = newFilter.rows[action.label] as SortedNavRowItems;
      row.sort = row.sort === "desc" ? "asc" : "desc";

      return {
        ...state,
        achievementsFilter: newFilter,
      };
    }
    case 13:
      return {
        ...state,
        submissionMode: action.mode,
      };
    case 14: {
      if (action.achievementId === null) {
        return {
          ...state,
          pwSubmitEnabled: {},
        };
      }
      return {
        ...state,
        pwSubmitEnabled: {
          ...state.pwSubmitEnabled,
          [action.achievementId]: action.enable,
        },
      };
    }
  }
}

export type StateDispatch = React.Dispatch<StateActionType>;

export const StateContext = createContext<AppState | null>(null);
export const StateDispatchContext = createContext<StateDispatch | null>(null);

export function useStateReducer() {
  return useReducer(stateReducer, defaultState());
}

export function useStateContext(): AppState {
  return useContext(StateContext)!;
}

export function useDispatchStateContext(): StateDispatch {
  return useContext(StateDispatchContext)!;
}
