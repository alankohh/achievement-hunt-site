import { NavItems } from "components/achievements/AchievementNavigationBar.tsx";

export function defaultState(): AppState {
  return {
    submitEnabled: true,
    pwSubmitEnabled: {},
    achievementsFilter: null,
    achievementsSearchFilter: "",
    hideCompletedAchievements: false,
    showMyAchievements: false,
    volume: {
      value: parseFloat(localStorage.getItem("volume") ?? "0.5"),
      isMuted: localStorage.getItem("isMuted") === "t",
    },
    submissionMode: "any",
  };
}

export type AppState = {
  submitEnabled: boolean;
  pwSubmitEnabled: { [achievementId: number]: boolean };
  achievementsFilter: NavItems | null;
  achievementsSearchFilter: string;
  hideCompletedAchievements: boolean;
  showMyAchievements: boolean;
  volume: {
    value: number;
    isMuted: boolean;
  };
  submissionMode: string;
};
