import { startTransition, type FormEvent } from "react";

/**
 * onSubmit handler that hands the form data to a useActionState action.
 * Passing the action to <form action> would make React reset the form after
 * every submit, so a failed submit would also wipe what the user typed.
 */
export function submitTo(action: (data: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  };
}
