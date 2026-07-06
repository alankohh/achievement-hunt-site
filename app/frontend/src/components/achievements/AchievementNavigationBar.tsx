import { AchievementType } from "api/types/AchievementType.ts";
import classNames from "classnames";
import Button from "components/inputs/Button.tsx";
import TextInput from "components/inputs/TextInput.tsx";
import { StateDispatch } from "contexts/StateContext.ts";
import { useCallback, useRef, useState } from "react";
import { AppState } from "types/AppStateType.ts";
import { parseTags, sortedConcat, toTitleCase } from "util/helperFunctions.ts";

export type NavItem = {
  label: string;
  active: boolean;
};

export type BoolNavItem = {
  value: boolean;
} & NavItem;

export type NavRowItems = {
  items: NavItem[];
};

export type SortedNavRowItems = {
  sort: "desc" | "asc";
} & NavRowItems;

export type BoolNavRowItems = {
  items: BoolNavItem[];
};

export type NavItems = {
  rows: {
    mode: NavRowItems;
    tags: NavRowItems;
    sort: SortedNavRowItems;
    filters: BoolNavRowItems;
  };
  isStaff: boolean;
};

export function getDefaultNav(
  achievements: AchievementType[],
  isStaff: boolean = false,
): NavItems {
  let tags: string[] = [];
  for (const achievement of achievements) {
    for (const tag of parseTags(achievement.tags, false)) {
      tags = sortedConcat(tags, tag, (a, b) => a.localeCompare(b));
    }
  }

  const sortItems: NavItem[] = isStaff
    ? [
        { label: "last active", active: true },
        { label: "creation time", active: false },
        { label: "votes", active: false },
        { label: "difficulty", active: false },
        { label: "quality", active: false },
      ]
    : [
        { label: "completions", active: true },
        { label: "player", active: false },
        { label: "date completed", active: false },
        { label: "release", active: false },
        { label: "difficulty", active: false },
      ];

  const modes: NavItem[] = [
    { label: "any", active: false },
    { label: "standard", active: false },
    { label: "taiko", active: false },
    { label: "mania", active: false },
    { label: "catch", active: false },
  ];

  const filters: BoolNavItem[] = isStaff
    ? [
        { label: "my achievements", active: false, value: false },
        { label: "solved", active: false, value: false },
        { label: "upvoted", active: false, value: false },
        { label: "rated difficulty", active: false, value: false },
        { label: "rated quality", active: false, value: false },
      ]
    : [{ label: "completed", active: false, value: false }];

  return {
    rows: {
      mode: {
        items: modes,
      },
      tags: { items: tags.map((t) => ({ label: t, active: false })) },
      sort: {
        items: sortItems,
        sort: "desc",
      },
      filters: { items: filters },
    },
    isStaff,
  };
}

function AchievementNavigationBarRow({
  label,
  sort,
  children,
  onItemClick,
  onLabelClick,
}: {
  label: string;
  sort: string | undefined;
  children: (NavItem | BoolNavItem)[];
  onItemClick: (
    label: keyof NavItems["rows"],
    item: NavItem | BoolNavItem,
  ) => void;
  onLabelClick: (label: keyof NavItems["rows"]) => void;
}) {
  const isSorted = sort !== undefined;

  let labelText = toTitleCase(label);
  if (isSorted) labelText += sort === "desc" ? " ↓" : " ↑";

  const getItemCls = (item: NavItem | BoolNavItem) => {
    if ("value" in item) {
      return classNames("achievement-nav-bar__row__options__item", {
        active: item.active,
        on: item.value,
        off: !item.value,
      });
    }
    return classNames("achievement-nav-bar__row__options__item", {
      active: item.active,
    });
  };

  return (
    <div className="achievement-nav-bar__row prevent-select">
      <p
        className={classNames("achievement-nav-bar__row__label", {
          "sort-type": isSorted,
        })}
        onClick={
          isSorted
            ? () => onLabelClick(label as keyof NavItems["rows"])
            : undefined
        }
      >
        {labelText}
      </p>
      <div className="achievement-nav-bar__row__options">
        {children.map((item) => (
          <p
            key={item.label}
            className={getItemCls(item)}
            onClick={() => onItemClick(label as keyof NavItems["rows"], item)}
          >
            {toTitleCase(item.label)}
          </p>
        ))}
      </div>
    </div>
  );
}

export default function AchievementNavigationBar({
  state,
  dispatchState,
  achievements,
  isStaff,
}: {
  state: AppState | null;
  dispatchState: StateDispatch;
  achievements: AchievementType[] | undefined;
  isStaff: boolean;
}) {
  const searchFieldTimeoutRef = useRef<null | number>(null);
  const [searchField, setSearchField] = useState<string>("");
  const [resetting, setResetting] = useState<boolean>(false);

  const refreshState = useCallback(() => {
    if (!achievements) return;

    dispatchState({
      id: 5,
      achievementsFilter: getDefaultNav(achievements, isStaff),
    });
    dispatchState({ id: 6, achievementsSearchFilter: "" });
    setSearchField("");
  }, [achievements, dispatchState, getDefaultNav, isStaff, setSearchField]);

  const onItemClick = useCallback(
    (label: keyof NavItems["rows"], item: NavItem | BoolNavItem) => {
      if (state === null || state.achievementsFilter === null) return;

      dispatchState({
        id: 10,
        label: label,
        item: item.label,
        multiSelect: label !== "sort",
        active: item.active,
        value: "value" in item ? item.value : undefined,
      });
    },
    [state, state?.achievementsFilter, dispatchState],
  );

  const onLabelClick = useCallback(
    (label: keyof NavItems["rows"]) => {
      dispatchState({ id: 11, label });
    },
    [dispatchState],
  );

  const onSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // dispatch after 500ms of no change to prevent lag
      if (searchFieldTimeoutRef.current !== null) {
        clearTimeout(searchFieldTimeoutRef.current);
      }
      searchFieldTimeoutRef.current = setTimeout(() => {
        dispatchState({
          id: 6,
          achievementsSearchFilter: e.target.value,
        });
      }, 500);

      setSearchField(e.target.value);
    },
    [setSearchField, dispatchState],
  );

  // reset navigator when switching pages (staff vs achievements)
  const isReady =
    state !== null &&
    state.achievementsFilter !== null &&
    state.achievementsFilter.isStaff === isStaff;
  if (!resetting && !isReady) {
    refreshState();
    setResetting(true);
  } else if (resetting && isReady) {
    setResetting(false);
  }

  return (
    <div className="achievement-nav-bar">
      {!isReady || resetting ? (
        <div>Loading...</div>
      ) : (
        <>
          <div className="achievement-nav-bar__row--input">
            <TextInput
              placeholder="Search"
              value={searchField}
              onChange={onSearchChange}
            />
          </div>
          {Object.entries(
            (state.achievementsFilter!.rows ?? {}) as NavItems["rows"],
          ).map(([label, children]) => (
            <AchievementNavigationBarRow
              key={label}
              label={label}
              sort={"sort" in children ? children.sort : undefined}
              children={children.items}
              onItemClick={onItemClick}
              onLabelClick={onLabelClick}
            />
          ))}
          <Button onClick={refreshState}>Reset to Default</Button>
        </>
      )}
    </div>
  );
}
