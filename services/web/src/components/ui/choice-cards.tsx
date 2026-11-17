import styles from "./choice-cards.module.css";

export interface Choice<T extends string> {
  value: T;
  label: string;
  hint: string;
}

// Radio buttons drawn as cards. Keyboard and screen readers treat them as a
// normal radio group.
export function ChoiceCards<T extends string>({
  name,
  legend,
  choices,
  value,
  onChange,
}: {
  name: string;
  legend: string;
  choices: Choice<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{legend}</legend>
      <div
        className={styles.grid}
        style={{ gridTemplateColumns: `repeat(${choices.length}, minmax(0, 1fr))` }}
      >
        {choices.map((choice) => (
          <label key={choice.value} className={styles.card}>
            <input
              type="radio"
              name={name}
              value={choice.value}
              checked={value === choice.value}
              onChange={() => onChange(choice.value)}
              className={styles.input}
            />
            <span className={styles.label}>{choice.label}</span>
            <span className={styles.hint}>{choice.hint}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
