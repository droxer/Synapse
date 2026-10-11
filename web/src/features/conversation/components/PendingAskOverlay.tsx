"use client";

import { InputPrompt } from "./InputPrompt";
import { useConversationState, useConversationActions } from "../hooks/use-conversation-context";

export function PendingAskOverlay() {
  const { pendingAsk, respondError } = useConversationState();
  const { handlePromptSubmit } = useConversationActions();

  if (!pendingAsk) return null;

  return (
    <div>
      <InputPrompt
        title={pendingAsk.title}
        question={pendingAsk.question}
        options={pendingAsk.options}
        allowFreeform={pendingAsk.allowFreeform}
        onSubmit={handlePromptSubmit}
      />
      {respondError && (
        <div
          role="alert"
          className="surface-overlay fixed top-4 left-1/2 z-[80] w-[calc(100%-2rem)] max-w-[36rem] -translate-x-1/2 break-words px-4 py-2.5 text-body-sm text-destructive"
        >
          {respondError}
        </div>
      )}
    </div>
  );
}
