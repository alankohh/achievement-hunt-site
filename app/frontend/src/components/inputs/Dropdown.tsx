import { splitProps } from "util/helperFunctions.ts";
import "assets/css/inputs/dropdown.css";
import { useMemo } from "react";

type DropdownProps = {
  className?: string;
  options: { [_k: string]: string } | [string, string][];
  onChange?: (e: React.FormEvent<HTMLSelectElement>) => void;
  value?: string;
  disabled?: boolean;
  name?: string;
  defaultValue?: string;
};

const elementDefaults = {
  className: "",
};
const otherDefaults = {
  options: {},
  value: null,
};

export default function Dropdown(props: DropdownProps) {
  const [elementProps, otherProps] = useMemo(
    () => splitProps(props, elementDefaults, otherDefaults),
    [props],
  );

  const className = useMemo(
    () => elementProps.className + " dropdown",
    [elementProps.className],
  );
  const options: [string, string][] = useMemo(
    () =>
      Array.isArray(otherProps.options)
        ? (otherProps.options as [string, string][])
        : Object.entries(otherProps.options),
    [otherProps.options],
  );

  return (
    <select {...elementProps} className={className}>
      {options.map(([k, v]) => (
        <option
          key={v}
          value={v}
          selected={otherProps.value !== null && otherProps.value === v}
        >
          {k}
        </option>
      ))}
    </select>
  );
}
